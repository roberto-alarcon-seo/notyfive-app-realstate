import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateButton {
  type: 'quick_reply' | 'url';
  text: string;
  url?: string;
}

// Convert user-facing variables like {{nombre}} to Twilio format {{1}}
function convertVariablesToTwilioFormat(text: string, variableMap: Map<string, number>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedName = varName.trim();
    if (!variableMap.has(trimmedName)) {
      const nextIndex = variableMap.size + 1;
      variableMap.set(trimmedName, nextIndex);
    }
    return `{{${variableMap.get(trimmedName)}}}`;
  });
}

// Generate unique template name for Twilio (lowercase, underscores, no spaces)
function generateTwilioFriendlyName(name: string, tenantId: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 40);
  
  const shortTenantId = tenantId.substring(0, 8);
  const timestamp = Date.now().toString(36);
  
  return `${slug}_${shortTenantId}_${timestamp}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1) Verify auth and get tenant_id
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ code: 'FORBIDDEN', message: 'User has no tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.tenant_id;

    // 2) Parse request body
    const { template_id, idempotency_key } = await req.json();

    if (!template_id) {
      return new Response(
        JSON.stringify({ code: 'VALIDATION_ERROR', message: 'template_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Submitting template ${template_id} for approval (tenant: ${tenantId})`);

    // 3) Fetch template from database
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', template_id)
      .eq('tenant_id', tenantId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ code: 'NOT_FOUND', message: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4) IDEMPOTENCY CHECK: If already pending/approved, return current state
    if (template.approval_status === 'pending') {
      console.log(`⏭️ Template ${template_id} already pending, returning existing state`);
      return new Response(
        JSON.stringify({
          success: true,
          content_sid: template.twilio_template_sid,
          approval_status: 'pending',
          message: 'Plantilla ya está en revisión',
          already_submitted: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template.approval_status === 'approved') {
      console.log(`⏭️ Template ${template_id} already approved, returning existing state`);
      return new Response(
        JSON.stringify({
          success: true,
          content_sid: template.twilio_template_sid,
          approval_status: 'approved',
          message: 'Plantilla ya está aprobada',
          already_submitted: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5) Check if we already have a Twilio SID
    let contentSid = template.twilio_template_sid;
    
    // 6) Validate template data
    if (!template.body?.trim()) {
      return new Response(
        JSON.stringify({ code: 'VALIDATION_ERROR', message: 'El cuerpo del mensaje está vacío' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7) Get Twilio integration
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('account_sid, auth_token_encrypted, phone_number, messaging_service_sid, status')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .single();

    if (!integration || integration.status !== 'connected') {
      return new Response(
        JSON.stringify({ 
          code: 'NO_INTEGRATION', 
          message: 'No hay cuenta de Twilio conectada. Configúrala en el panel de administración.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration.phone_number && !integration.messaging_service_sid) {
      return new Response(
        JSON.stringify({ 
          code: 'NO_PHONE', 
          message: 'No hay número de WhatsApp configurado.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = atob(integration.auth_token_encrypted!);
    const twilioAuth = btoa(`${integration.account_sid}:${authToken}`);

    // 8) Create Twilio content ONLY if we don't have a SID yet
    // We always (re)compute the canonical variable_index_map from the current
    // template body/header/footer, so the send pipeline can map named variables
    // to the {{1}}, {{2}}, ... slots Twilio approved — regardless of order.
    const variableMap = new Map<string, number>();
    const computeMap = (text: string) => {
      text.replace(/\{\{([^}]+)\}\}/g, (_m, varName) => {
        const trimmed = varName.trim();
        if (!variableMap.has(trimmed)) {
          variableMap.set(trimmed, variableMap.size + 1);
        }
        return '';
      });
    };
    // Order matters: header first, then body, then footer — matches the
    // payload Twilio sees.
    if (template.header_type === 'text' && template.header_text) computeMap(template.header_text);
    if (template.body) computeMap(template.body);
    if (template.footer) computeMap(template.footer);

    const variableIndexMap: Record<string, number> = {};
    variableMap.forEach((idx, name) => { variableIndexMap[name] = idx; });

    if (!contentSid) {
      console.log('📤 No existing Twilio SID, creating new content...');

      const twilioBody = convertVariablesToTwilioFormat(template.body, variableMap);
      
      let twilioHeaderText = '';
      if (template.header_type === 'text' && template.header_text) {
        twilioHeaderText = convertVariablesToTwilioFormat(template.header_text, variableMap);
      }

      let twilioFooter = '';
      if (template.footer) {
        twilioFooter = convertVariablesToTwilioFormat(template.footer, variableMap);
      }

      const variables: Record<string, string> = {};
      const sampleValues = ['María García', 'Empresa XYZ', '12345', '10%', 'Premium', 'Lunes 15', 'PROMO2024'];
      variableMap.forEach((index, name) => {
        variables[index.toString()] = sampleValues[(index - 1) % sampleValues.length];
      });

      const friendlyName = generateTwilioFriendlyName(template.name, tenantId);

      const buttons = (template.buttons as TemplateButton[]) || [];
      const hasQuickReplies = buttons.some(b => b.type === 'quick_reply');
      const hasUrlButtons = buttons.some(b => b.type === 'url');
      
      const types: Record<string, unknown> = {};
      const isMediaHeader = ['image', 'video', 'document'].includes(template.header_type);
      
      if (isMediaHeader && template.media_url) {
        types['twilio/media'] = {
          body: twilioBody,
          media: [template.media_url]
        };
      } else if (hasQuickReplies) {
        const actions = buttons
          .filter(b => b.type === 'quick_reply' && b.text)
          .map((b, i) => ({
            title: b.text,
            id: `action_${i}`
          }));
        
        types['twilio/quick-reply'] = {
          body: twilioBody,
          actions
        };
      } else if (hasUrlButtons) {
        const urlButton = buttons.find(b => b.type === 'url');
        types['twilio/call-to-action'] = {
          body: twilioBody,
          actions: [{
            type: 'URL',
            title: urlButton?.text || 'Ver más',
            url: urlButton?.url || ''
          }]
        };
      } else {
        types['twilio/text'] = {
          body: twilioBody
        };
      }

      if (!types['twilio/text']) {
        types['twilio/text'] = {
          body: twilioBody
        };
      }

      const contentPayload = {
        friendly_name: friendlyName,
        language: 'es_MX',
        variables: Object.keys(variables).length > 0 ? variables : undefined,
        types
      };

      console.log('📤 Creating content in Twilio:', JSON.stringify(contentPayload, null, 2));

      const contentResponse = await fetch('https://content.twilio.com/v1/Content', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contentPayload),
      });

      const contentData = await contentResponse.json();
      console.log('📥 Twilio content response:', JSON.stringify(contentData, null, 2));

      if (!contentResponse.ok) {
        const errorMessage = contentData.message || contentData.error_message || 'Error al crear contenido en Twilio';
        console.error('❌ Twilio content creation failed:', errorMessage);
        return new Response(
          JSON.stringify({ 
            code: 'TWILIO_ERROR', 
            message: errorMessage,
            details: contentData
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      contentSid = contentData.sid;
      console.log(`✅ Content created: ${contentSid}`);
    } else {
      console.log(`✅ Using existing Twilio content SID: ${contentSid}`);
    }

    // 9) Submit for WhatsApp approval
    const categoryMap: Record<string, string> = {
      'utility': 'UTILITY',
      'marketing': 'MARKETING',
      'authentication': 'AUTHENTICATION'
    };
    
    // Twilio requires lowercase alphanumeric + underscores only for the approval name
    const approvalName = template.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const approvalPayload = {
      name: approvalName,
      category: categoryMap[template.category] || 'UTILITY'
    };

    console.log('📤 Submitting for WhatsApp approval:', JSON.stringify(approvalPayload, null, 2));

    const approvalResponse = await fetch(
      `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approvalPayload),
      }
    );

    const approvalData = await approvalResponse.json();
    console.log('📥 Twilio approval response:', JSON.stringify(approvalData, null, 2));

    if (!approvalResponse.ok) {
      const errorMessage = approvalData.message || approvalData.error_message || 'Error al enviar para aprobación';
      console.error('❌ Twilio approval submission failed:', errorMessage);
      
      // Check if it's already submitted (Twilio returns error for duplicate submissions)
      if (errorMessage.includes('already') || errorMessage.includes('pending')) {
        // Update status to pending anyway
        await supabase
          .from('templates')
          .update({
            twilio_template_sid: contentSid,
            approval_status: 'pending',
            last_synced_at: new Date().toISOString(),
            last_submit_idempotency_key: idempotency_key || null,
            variable_index_map: variableIndexMap,
          })
          .eq('id', template_id);
        
        return new Response(
          JSON.stringify({
            success: true,
            content_sid: contentSid,
            approval_status: 'pending',
            message: 'Plantilla ya enviada para aprobación',
            already_submitted: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      await supabase
        .from('templates')
        .update({
          twilio_template_sid: contentSid,
          approval_status: 'draft',
          last_synced_at: new Date().toISOString(),
          rejection_reason: `Error al enviar a aprobación: ${errorMessage}`
        })
        .eq('id', template_id);
      
      return new Response(
        JSON.stringify({ 
          code: 'APPROVAL_ERROR', 
          message: errorMessage,
          content_sid: contentSid,
          details: approvalData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10) Update template in database
    const newStatus = approvalData.status === 'approved' ? 'approved' : 'pending';

    const { error: updateError } = await supabase
      .from('templates')
      .update({
        twilio_template_sid: contentSid,
        approval_status: newStatus,
        last_synced_at: new Date().toISOString(),
        last_submit_idempotency_key: idempotency_key || null,
        rejection_reason: null,
        variable_index_map: variableIndexMap,
      })
      .eq('id', template_id);

    if (updateError) {
      console.error('❌ Failed to update template:', updateError);
    }

    console.log(`✅ Template ${template_id} submitted for approval successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        content_sid: contentSid,
        approval_status: newStatus,
        twilio_status: approvalData.status,
        message: 'Plantilla enviada para aprobación de WhatsApp'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in submit-template-for-approval:', error);
    return new Response(
      JSON.stringify({ 
        code: 'INTERNAL_ERROR', 
        message: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
