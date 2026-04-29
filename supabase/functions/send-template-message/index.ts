import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get tenant_id from user profile
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
    const { conversation_id, template_id, variables = {} } = await req.json();

    if (!conversation_id || !template_id) {
      return new Response(
        JSON.stringify({ code: 'VALIDATION_ERROR', message: 'conversation_id and template_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Sending template message for tenant ${tenantId}, conversation ${conversation_id}`);

    // 3) Verify template exists, belongs to tenant, and is approved
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ code: 'NOT_FOUND', message: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template.tenant_id !== tenantId) {
      return new Response(
        JSON.stringify({ code: 'FORBIDDEN', message: 'Template does not belong to tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template.approval_status !== 'approved') {
      return new Response(
        JSON.stringify({ code: 'TEMPLATE_NOT_APPROVED', message: 'Solo puedes enviar plantillas aprobadas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template.twilio_template_sid) {
      return new Response(
        JSON.stringify({ code: 'TEMPLATE_NOT_SYNCED', message: 'Plantilla no sincronizada con Twilio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4) Verify conversation belongs to tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, tenant_id, contact_id, customer_whatsapp, twilio_whatsapp_number')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ code: 'NOT_FOUND', message: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (conversation.tenant_id !== tenantId) {
      return new Response(
        JSON.stringify({ code: 'FORBIDDEN', message: 'Conversation does not belong to tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5) Check if tenant can send (using centralized function)
    const { data: canSendResult } = await supabase.rpc('can_send_message', { p_tenant_id: tenantId });
    
    if (!canSendResult) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('message_credits')
        .eq('id', tenantId)
        .single();
      
      return new Response(
        JSON.stringify({ 
          code: 'INSUFFICIENT_BALANCE', 
          message: 'Saldo insuficiente',
          wallet_balance: tenant?.message_credits || 0
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6) Get Twilio integration
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('account_sid, auth_token_encrypted, phone_number, messaging_service_sid, status')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .eq('status', 'connected')
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ code: 'NO_INTEGRATION', message: 'WhatsApp no está configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode auth token
    const authToken = atob(integration.auth_token_encrypted);
    const fromNumber = integration.phone_number || conversation.twilio_whatsapp_number;

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ code: 'NO_PHONE', message: 'No hay número de WhatsApp configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7) Build message body with variables replaced
    let messageBody = template.body;
    const templateVariables = template.variables || [];
    
    // Replace variables in body
    templateVariables.forEach((variable: string) => {
      const value = variables[variable] || '';
      messageBody = messageBody.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), value);
    });

    // 8) Insert message with status queued
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversation_id,
        direction: 'outbound',
        channel: 'whatsapp',
        provider: 'twilio',
        from_number: fromNumber,
        to_number: conversation.customer_whatsapp,
        body: messageBody,
        status: 'queued',
        template_id: template_id,
        source: 'template',
      })
      .select('id')
      .single();

    if (msgError || !newMessage) {
      console.error('❌ Failed to insert message:', msgError);
      return new Response(
        JSON.stringify({ code: 'DB_ERROR', message: 'Error al crear mensaje' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Created message: ${newMessage.id}`);

    // 9) Debit using centralized function with idempotency
    const idempotencyKey = `msg:${newMessage.id}`;
    const { data: creditResult, error: creditError } = await supabase.rpc('fn_apply_credit_movement', {
      p_tenant_id: tenantId,
      p_movement_type: 'debit',
      p_amount: 1,
      p_reason: 'template_message',
      p_source_table: 'messages',
      p_source_id: newMessage.id,
      p_idempotency_key: idempotencyKey
    });

    if (creditError || !creditResult?.[0]?.success) {
      console.error('❌ Failed to debit credits:', creditError || creditResult?.[0]?.error_code);
      await supabase.from('messages').delete().eq('id', newMessage.id);
      return new Response(
        JSON.stringify({ 
          code: 'INSUFFICIENT_BALANCE', 
          message: 'Saldo insuficiente',
          wallet_balance: creditResult?.[0]?.new_balance || 0
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newBalance = creditResult[0].new_balance;
    console.log(`✅ Credits debited. New balance: ${newBalance}`);

    // 10) Send to Twilio using Content Template
    let twilioMessageSid: string | null = null;
    let sendError: string | null = null;

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${integration.account_sid}/Messages.json`;
      const twilioAuth = btoa(`${integration.account_sid}:${authToken}`);

      const twilioBody = new URLSearchParams();
      twilioBody.append('To', `whatsapp:${conversation.customer_whatsapp}`);
      twilioBody.append('From', `whatsapp:${fromNumber}`);
      
      // Use ContentSid for template-based message
      twilioBody.append('ContentSid', template.twilio_template_sid);
      
      // Add content variables if any
      // CRITICAL: Twilio approved the template with a specific {{1}}, {{2}}, ...
      // ordering. We persist that exact mapping in `variable_index_map` at
      // submit-time. Re-deriving the order from `variables[]` here would risk
      // sending values into the wrong slots after an edit/duplicate.
      const indexMap: Record<string, number> =
        (template.variable_index_map as Record<string, number> | null) || {};

      const hasIndexMap = Object.keys(indexMap).length > 0;
      const contentVariables: Record<string, string> = {};

      if (hasIndexMap) {
        for (const [name, idx] of Object.entries(indexMap)) {
          contentVariables[String(idx)] = variables[name] ?? '';
        }
      } else if (templateVariables.length > 0) {
        // Fallback for legacy templates submitted before variable_index_map existed.
        templateVariables.forEach((variable: string, index: number) => {
          contentVariables[String(index + 1)] = variables[variable] || '';
        });
      }

      if (Object.keys(contentVariables).length > 0) {
        twilioBody.append('ContentVariables', JSON.stringify(contentVariables));
      }

      // Add messaging service if available
      if (integration.messaging_service_sid) {
        twilioBody.append('MessagingServiceSid', integration.messaging_service_sid);
      }

      console.log('📞 Sending to Twilio with ContentSid:', template.twilio_template_sid);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioBody.toString(),
      });

      const twilioData = await twilioResponse.json();
      console.log('📞 Twilio response:', JSON.stringify(twilioData, null, 2));

      if (!twilioResponse.ok) {
        throw new Error(twilioData.message || 'Twilio send failed');
      }

      twilioMessageSid = twilioData.sid;
      console.log(`✅ Twilio sent template message: ${twilioMessageSid}`);

    } catch (twilioError) {
      console.error('❌ Twilio send error:', twilioError);
      sendError = twilioError instanceof Error ? twilioError.message : 'Unknown error';

      // Revert credit using centralized function
      const revertKey = `revert:${newMessage.id}`;
      await supabase.rpc('fn_apply_credit_movement', {
        p_tenant_id: tenantId,
        p_movement_type: 'credit',
        p_amount: 1,
        p_reason: 'revert_send_failed',
        p_source_table: 'messages',
        p_source_id: newMessage.id,
        p_idempotency_key: revertKey
      });

      console.log('⚠️ Credits reverted after send failure');

      // Update message as failed
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          error_message: sendError,
        })
        .eq('id', newMessage.id);

      return new Response(
        JSON.stringify({ 
          code: 'SEND_FAILED', 
          message: 'No se pudo enviar la plantilla',
          details: sendError,
          message_id: newMessage.id,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11) Update message with Twilio SID and status
    await supabase
      .from('messages')
      .update({
        status: 'sent',
        twilio_message_sid: twilioMessageSid,
      })
      .eq('id', newMessage.id);

    // 12) Update conversation
    await supabase
      .from('conversations')
      .update({
        last_agent_message_at: new Date().toISOString(),
        last_message_preview: messageBody.substring(0, 120),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    // 13) Increment template used_count
    await supabase
      .from('templates')
      .update({
        used_count: (template.used_count || 0) + 1,
      })
      .eq('id', template_id);

    console.log(`✅ Template message sent successfully`);

    return new Response(
      JSON.stringify({
        message_id: newMessage.id,
        provider_message_id: twilioMessageSid,
        status: 'sent',
        wallet_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in send-template-message:', error);
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