import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateNamingContext {
  category?: string;
  objective?: string;
  segment_name?: string;
  time_context?: string;
}

interface TemplateUpsertRequest {
  tenant_id?: string;
  source?: 'manual' | 'ai';
  source_module?: string;
  ai_conversation_id?: string;
  naming_context?: TemplateNamingContext;
  idempotency_key?: string; // For deduplication
  template: {
    id?: string;
    name?: string;
    display_name?: string;
    language?: string;
    category: 'marketing' | 'utility' | 'authentication';
    body: string;
    header?: {
      type: 'none' | 'text' | 'image' | 'video';
      text?: string;
      media_url?: string;
    };
    footer?: string;
    variables: string[];
  };
}

// Normalize text to snake_case (remove accents, special chars)
function normalizeToSnakeCase(text: string, maxLen = 20): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, maxLen);
}

// Generate a short hash from content (4 chars base36)
function generateShortId(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 4).padStart(4, '0');
}

// Generate content fingerprint for deduplication
function generateFingerprint(template: TemplateUpsertRequest['template'], tenantId: string): string {
  const parts = [
    template.body?.trim() || '',
    template.category || 'marketing',
    template.header?.type || 'none',
    template.header?.media_url || '',
    template.language || 'es_MX',
    tenantId
  ];
  return generateShortId(parts.join('|')) + '_' + generateShortId(template.body + tenantId);
}

// Map common objectives to normalized terms
function normalizeObjective(objective?: string): string {
  if (!objective) return 'mensaje';
  const lower = objective.toLowerCase();
  
  const objectiveMap: Record<string, string> = {
    'venta': 'venta',
    'ventas': 'venta',
    'promoción': 'promocion',
    'promocion': 'promocion',
    'oferta': 'oferta',
    'descuento': 'descuento',
    'reactivación': 'reactivacion',
    'reactivacion': 'reactivacion',
    'recordatorio': 'recordatorio',
    'recordar': 'recordatorio',
    'informativo': 'info',
    'información': 'info',
    'informacion': 'info',
    'bienvenida': 'bienvenida',
    'onboarding': 'onboarding',
    'seguimiento': 'seguimiento',
    'cobranza': 'cobranza',
    'pago': 'pago',
  };
  
  for (const [key, value] of Object.entries(objectiveMap)) {
    if (lower.includes(key)) return value;
  }
  return normalizeToSnakeCase(objective, 15);
}

// Detect seasonal/temporal context from text
function detectTimeContext(): string {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  
  if (month === 11) return 'navidad';
  if (month === 0 && day <= 15) return 'anio_nuevo';
  if (month === 1 && day <= 14) return 'san_valentin';
  if (month === 4 && day <= 10) return 'dia_madre';
  
  return '';
}

// Generate descriptive template name
function generateDescriptiveName(
  template: TemplateUpsertRequest['template'],
  context: TemplateNamingContext | undefined,
  tenantId: string
): { name: string; displayName: string } {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const parts: string[] = [];
  
  parts.push(normalizeToSnakeCase(template.category || 'marketing', 12));
  
  const objective = normalizeObjective(context?.objective);
  if (objective) parts.push(objective);
  
  if (context?.segment_name) {
    parts.push(normalizeToSnakeCase(context.segment_name, 15));
  }
  
  const timeContext = context?.time_context || detectTimeContext();
  if (timeContext) {
    parts.push(normalizeToSnakeCase(timeContext, 12));
  }
  
  parts.push(yyyymm);
  
  const shortId = generateShortId(template.body + tenantId);
  parts.push(shortId);
  
  let name = parts.join('_').substring(0, 64);
  
  const displayParts: string[] = [];
  
  const categoryLabels: Record<string, string> = {
    'marketing': 'Marketing',
    'utility': 'Utility',
    'authentication': 'Auth'
  };
  displayParts.push(categoryLabels[template.category] || template.category);
  
  if (context?.objective) {
    displayParts.push('-');
    displayParts.push(context.objective.charAt(0).toUpperCase() + context.objective.slice(1));
  }
  
  if (context?.segment_name) {
    displayParts.push('-');
    displayParts.push(context.segment_name);
  }
  
  const displayName = displayParts.join(' ').substring(0, 80) || `Plantilla ${yyyymm}`;
  
  return { name, displayName };
}

// Generate unique template name for Twilio
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
    const requestBody = await req.json() as TemplateUpsertRequest;
    const { template, source, source_module, ai_conversation_id, naming_context, idempotency_key } = requestBody;

    if (!template || !template.body?.trim()) {
      return new Response(
        JSON.stringify({ code: 'VALIDATION_ERROR', message: 'template.body is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Generate fingerprint for deduplication
    const fingerprint = generateFingerprint(template, tenantId);
    console.log(`🔍 Template fingerprint: ${fingerprint}`);

    // 4) Check for existing template by ID or fingerprint (deduplication)
    let existingTemplate: any = null;
    
    if (template.id) {
      // If ID provided, fetch that specific template
      const { data } = await supabase
        .from('templates')
        .select('id, twilio_template_sid, approval_status, fingerprint, name')
        .eq('id', template.id)
        .eq('tenant_id', tenantId)
        .single();
      existingTemplate = data;
    } else {
      // Check by fingerprint to find duplicate content
      const { data } = await supabase
        .from('templates')
        .select('id, twilio_template_sid, approval_status, fingerprint, name')
        .eq('tenant_id', tenantId)
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        console.log(`♻️ Found existing template with same fingerprint: ${data.id}`);
        existingTemplate = data;
      }
    }

    // 5) Generate name if not provided
    let templateName = template.name;
    let displayName = template.display_name;
    
    if (!templateName) {
      const generated = generateDescriptiveName(template, naming_context, tenantId);
      templateName = generated.name;
      displayName = displayName || generated.displayName;
    }

    // 6) Prepare template data
    const headerType = template.header?.type || 'none';
    const mediaUrl = template.header?.media_url || null;

    const templateData = {
      tenant_id: tenantId,
      name: templateName,
      display_name: displayName,
      category: template.category,
      body: template.body.trim(),
      header_type: headerType,
      header_text: template.header?.type === 'text' ? template.header?.text : null,
      media_url: mediaUrl,
      footer: template.footer || null,
      variables: template.variables || [],
      // Source tracking
      created_source: source || 'manual',
      created_by_module: source_module || 'templates',
      created_by_user_id: user.id,
      ai_conversation_id: ai_conversation_id || null,
      // Idempotency
      fingerprint,
      last_upsert_idempotency_key: idempotency_key || null,
    };

    let templateId: string;
    let existingTwilioSid: string | null = null;

    if (existingTemplate) {
      // Update existing template
      console.log(`📝 Updating existing template: ${existingTemplate.id}`);
      existingTwilioSid = existingTemplate.twilio_template_sid;

      const { error: updateError } = await supabase
        .from('templates')
        .update({
          ...templateData,
          // Only reset to draft if content actually changed (different fingerprint)
          ...(existingTemplate.fingerprint !== fingerprint ? { approval_status: 'draft' } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTemplate.id);

      if (updateError) {
        console.error('❌ Error updating template:', updateError);
        throw updateError;
      }

      templateId = existingTemplate.id;
    } else {
      // Insert new template
      console.log(`📝 Creating new template`);
      
      const { data: newTemplate, error: insertError } = await supabase
        .from('templates')
        .insert({
          ...templateData,
          approval_status: 'draft',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Error inserting template:', insertError);
        throw insertError;
      }

      templateId = newTemplate.id;
    }

    console.log(`✅ Template saved to DB with ID: ${templateId}`);

    // 7) Try to create in Twilio ONLY if no existing SID
    let twilioSid: string | null = existingTwilioSid;
    let twilioError: string | null = null;

    // Skip Twilio creation if we already have a SID
    if (twilioSid) {
      console.log(`✅ Using existing Twilio SID: ${twilioSid}`);
    } else {
      // Get Twilio integration
      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('account_sid, auth_token_encrypted, phone_number, messaging_service_sid, status')
        .eq('tenant_id', tenantId)
        .eq('provider', 'twilio')
        .single();

      if (integration && integration.status === 'connected' && integration.auth_token_encrypted) {
        try {
          const authToken = atob(integration.auth_token_encrypted);
          const twilioAuth = btoa(`${integration.account_sid}:${authToken}`);

          const friendlyName = generateTwilioFriendlyName(templateName, tenantId);
          
          const types: Record<string, unknown> = {};
          
          if (headerType === 'image' || headerType === 'video') {
            types['twilio/media'] = {
              body: template.body,
              media: mediaUrl ? [mediaUrl] : []
            };
          } else {
            types['twilio/text'] = {
              body: template.body
            };
          }

          const contentPayload = {
            friendly_name: friendlyName,
            language: template.language || 'es_MX',
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
          console.log('📥 Twilio response:', JSON.stringify(contentData, null, 2));

          if (contentResponse.ok && contentData.sid) {
            twilioSid = contentData.sid;
            
            await supabase
              .from('templates')
              .update({
                twilio_template_sid: twilioSid,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', templateId);

            console.log(`✅ Twilio content created: ${twilioSid}`);
          } else {
            twilioError = contentData.message || 'Error creating Twilio content';
            console.warn('⚠️ Twilio content creation failed:', twilioError);
          }
        } catch (e) {
          twilioError = e instanceof Error ? e.message : 'Twilio error';
          console.warn('⚠️ Twilio integration error:', twilioError);
        }
      } else {
        console.log('ℹ️ No Twilio integration connected, skipping Twilio sync');
      }
    }

    // 8) Fetch the final template state
    const { data: finalTemplate } = await supabase
      .from('templates')
      .select('id, name, body, category, header_type, media_url, approval_status, twilio_template_sid, variables')
      .eq('id', templateId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        template_id: templateId,
        provider_template_sid: twilioSid,
        approval_status: finalTemplate?.approval_status || 'draft',
        twilio_error: twilioError,
        template: finalTemplate,
        message: twilioSid 
          ? 'Plantilla guardada y sincronizada con Twilio' 
          : 'Plantilla guardada (sin conexión a Twilio)'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in twilio-template-upsert:', error);
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
