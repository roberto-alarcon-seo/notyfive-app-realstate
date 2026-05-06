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
    const { conversation_id, text, media } = await req.json();

    // Allow either text or media (or both)
    const hasContent = (text && text.trim()) || media;
    if (!conversation_id || !hasContent) {
      return new Response(
        JSON.stringify({ code: 'VALIDATION_ERROR', message: 'conversation_id and (text or media) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Sending manual message for tenant ${tenantId}, conversation ${conversation_id}`);

    // 3) Verify conversation belongs to tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, tenant_id, contact_id, customer_whatsapp, last_customer_message_at, twilio_whatsapp_number')
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

    // 4) Check if tenant can send (using centralized function)
    const { data: canSendResult } = await supabase.rpc('can_send_message', { p_tenant_id: tenantId });
    
    if (!canSendResult) {
      // Get current balance for error response
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

    // 5) Check 24-hour window
    const lastCustomerMessage = conversation.last_customer_message_at;
    if (lastCustomerMessage) {
      const hoursSince = (Date.now() - new Date(lastCustomerMessage).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24) {
        return new Response(
          JSON.stringify({ 
            code: 'OUT_OF_WINDOW', 
            message: 'Fuera de ventana de 24h. Solo puedes enviar plantillas aprobadas.',
            hours_since: Math.round(hoursSince)
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // No customer message ever - cannot send free-form
      return new Response(
        JSON.stringify({ 
          code: 'OUT_OF_WINDOW', 
          message: 'El cliente no ha iniciado conversación. Solo puedes enviar plantillas aprobadas.'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    // Prefer the number Twilio actually used when delivering messages to this conversation
    // (it's the canonical WhatsApp Sender registered in Twilio). Fall back to the integration
    // phone_number only if no inbound number has been recorded yet.
    let fromNumber = conversation.twilio_whatsapp_number || integration.phone_number;

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ code: 'NO_PHONE', message: 'No hay número de WhatsApp configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number - remove whatsapp: prefix if already present
    fromNumber = fromNumber.replace(/^whatsapp:/, '');
    
    // Ensure it starts with +
    if (!fromNumber.startsWith('+')) {
      fromNumber = '+' + fromNumber;
    }
    
    console.log(`📱 Sending from: whatsapp:${fromNumber} to: whatsapp:${conversation.customer_whatsapp}`);

    // 7) Insert message with status queued (include media fields)
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
        body: text?.trim() || '',
        media_urls: media?.url ? [media.url] : [],
        media_type: media?.type || null,
        media_mime_type: media?.mimeType || null,
        media_filename: media?.filename || null,
        media_size_bytes: media?.sizeBytes || null,
        status: 'queued',
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

    // 8) Debit using centralized function with idempotency
    const idempotencyKey = `msg:${newMessage.id}`;
    const { data: creditResult, error: creditError } = await supabase.rpc('fn_apply_credit_movement', {
      p_tenant_id: tenantId,
      p_movement_type: 'debit',
      p_amount: 1,
      p_reason: 'outbound_message',
      p_source_table: 'messages',
      p_source_id: newMessage.id,
      p_idempotency_key: idempotencyKey
    });

    if (creditError || !creditResult?.[0]?.success) {
      console.error('❌ Failed to debit credits:', creditError || creditResult?.[0]?.error_code);
      // Delete the message since we couldn't debit
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

    // 9) Send to Twilio
    let twilioMessageSid: string | null = null;
    let sendError: string | null = null;

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${integration.account_sid}/Messages.json`;
      const twilioAuth = btoa(`${integration.account_sid}:${authToken}`);

      const twilioBody = new URLSearchParams();
      twilioBody.append('To', `whatsapp:${conversation.customer_whatsapp}`);
      twilioBody.append('From', `whatsapp:${fromNumber}`);
      
      // Add text body if present
      if (text?.trim()) {
        twilioBody.append('Body', text.trim());
      }
      
      // Add media URL if present
      if (media?.url) {
        twilioBody.append('MediaUrl', media.url);
      }

      // Add messaging service if available
      if (integration.messaging_service_sid) {
        twilioBody.append('MessagingServiceSid', integration.messaging_service_sid);
      }

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
        // Handle specific Twilio error codes
        const errorCode = twilioData.code;
        let userMessage = twilioData.message || 'Twilio send failed';
        
        if (errorCode === 63007) {
          userMessage = `El número ${fromNumber} no está configurado como WhatsApp Sender en Twilio. Verifica que hayas completado el registro de WhatsApp Business en tu cuenta de Twilio.`;
        } else if (errorCode === 21211) {
          userMessage = 'Número de teléfono inválido';
        } else if (errorCode === 21408) {
          userMessage = 'Permisos insuficientes en Twilio';
        }
        
        throw new Error(userMessage);
      }

      twilioMessageSid = twilioData.sid;
      console.log(`✅ Twilio sent message: ${twilioMessageSid}`);

    } catch (twilioError) {
      console.error('❌ Twilio send error:', twilioError);
      sendError = twilioError instanceof Error ? twilioError.message : 'Unknown error';

      // Revert credit using centralized function (credit back)
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
          message: 'No se pudo enviar el mensaje',
          details: sendError,
          message_id: newMessage.id,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10) Update message with Twilio SID and status
    await supabase
      .from('messages')
      .update({
        status: 'sent',
        twilio_message_sid: twilioMessageSid,
      })
      .eq('id', newMessage.id);

    // 11) Update conversation
    const messagePreview = text?.trim()?.substring(0, 120) || (media?.type ? `[${media.type}]` : '');
    await supabase
      .from('conversations')
      .update({
        last_agent_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    console.log(`✅ Manual message sent successfully`);

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
    console.error('❌ Error in send-manual-message:', error);
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