import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for retry and timeout handling
const CONFIG = {
  AI_TIMEOUT_MS: 15000,
  AI_MAX_RETRIES: 2,
  AI_RETRY_DELAY_MS: 1000,
  MAX_EXECUTION_TIME_MS: 25000,
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else if (contentType.includes('application/json')) {
      body = await req.json();
    }

    console.log('📨 Twilio inbound webhook received');

    const messageSid = body.MessageSid || body.SmsSid;
    const from = body.From;
    const to = body.To;
    const messageBody = body.Body || '';
    const numMedia = parseInt(body.NumMedia || '0');
    const accountSid = body.AccountSid;
    const profileName = body.ProfileName || null;

    if (!from || !to || !accountSid) {
      console.error('❌ Missing required fields');
      return emptyTwiml();
    }

    const customerPhone = from.replace('whatsapp:', '');
    const businessPhone = to.replace('whatsapp:', '');

    console.log(`📱 Message from ${customerPhone} to ${businessPhone}`);

    // Find tenant
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('tenant_id, account_sid, phone_number')
      .eq('provider', 'twilio')
      .eq('status', 'connected')
      .or(`account_sid.eq.${accountSid},phone_number.eq.${businessPhone}`)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('❌ No tenant found');
      return emptyTwiml();
    }

    const tenantId = integration.tenant_id;
    console.log(`✅ Found tenant: ${tenantId}`);

    // Upsert contact
    let contactId: string;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('phone', customerPhone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
      // Update contact name if it was a generic "WhatsApp Lead" and we now have a profile name
      if (profileName && existingContact.name === 'WhatsApp Lead') {
        await supabase.from('contacts').update({ name: profileName }).eq('id', existingContact.id);
        console.log(`📝 Updated contact name from "WhatsApp Lead" to "${profileName}"`);
      }
    } else {
      const contactName = profileName || 'WhatsApp Lead';
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({ tenant_id: tenantId, phone: customerPhone, name: contactName, status: 'active' })
        .select('id')
        .single();

      if (contactError || !newContact) {
        console.error('❌ Failed to create contact:', contactError);
        return emptyTwiml();
      }
      contactId = newContact.id;
      console.log(`👤 Created contact "${contactName}" for ${customerPhone}`);
    }

    // Parse media
    const mediaUrls: string[] = [];
    let mediaType: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaFilename: string | null = null;
    
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = body[`MediaUrl${i}`];
      const ct = body[`MediaContentType${i}`];
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
        if (i === 0 && ct) {
          mediaMimeType = ct;
          if (ct.startsWith('image/')) mediaType = 'image';
          else if (ct.startsWith('video/')) mediaType = 'video';
          else if (ct.startsWith('audio/')) mediaType = 'audio';
          else if (ct.startsWith('application/')) mediaType = 'document';
          else mediaType = 'unknown';
          mediaFilename = `File_${new Date().toISOString().slice(0, 10)}`;
        }
      }
    }

    const locationLat = body.Latitude ? parseFloat(body.Latitude) : null;
    const locationLng = body.Longitude ? parseFloat(body.Longitude) : null;
    if (locationLat && locationLng) mediaType = 'location';

    let messagePreview = messageBody.substring(0, 120);
    if (!messageBody && mediaType) {
      const labels: Record<string, string> = { image: '📷 Imagen', video: '🎥 Video', audio: '🎙️ Audio', document: '📎 Documento', location: '📍 Ubicación' };
      messagePreview = labels[mediaType] || '📎 Archivo';
    }

    // Upsert conversation
    let conversationId: string;
    let aiEnabled = true;

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, unread_count, ai_enabled')
      .eq('tenant_id', tenantId)
      .eq('customer_whatsapp', customerPhone)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
      aiEnabled = existingConv.ai_enabled ?? true;
      await supabase.from('conversations').update({
        last_customer_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        last_message_direction: 'inbound',
        last_message_source: 'customer',
        unread_count: (existingConv.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          tenant_id: tenantId, contact_id: contactId, twilio_subaccount_sid: accountSid,
          twilio_whatsapp_number: businessPhone, customer_whatsapp: customerPhone,
          status: 'open', ai_enabled: true, last_customer_message_at: new Date().toISOString(),
          last_message_preview: messagePreview, last_message_direction: 'inbound',
          last_message_source: 'customer', unread_count: 1,
        })
        .select('id, ai_enabled').single();

      if (convError || !newConv) {
        console.error('❌ Failed to create conversation:', convError);
        return emptyTwiml();
      }
      conversationId = newConv.id;
      aiEnabled = newConv.ai_enabled ?? true;
    }

    // Insert message
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        tenant_id: tenantId, conversation_id: conversationId, direction: 'inbound',
        channel: 'whatsapp', provider: 'twilio', twilio_message_sid: messageSid,
        from_number: customerPhone, to_number: businessPhone, body: messageBody,
        media_urls: mediaUrls, media_type: mediaType, media_mime_type: mediaMimeType,
        media_filename: mediaFilename, location_lat: locationLat, location_lng: locationLng,
        status: 'received',
      })
      .select('id').single();

    if (msgError) {
      console.error('❌ Failed to insert message:', msgError);
      return emptyTwiml();
    }

    // Check if tenant can send (using centralized function)
    const { data: canSendResult } = await supabase.rpc('can_send_message', { p_tenant_id: tenantId });
    
    if (!canSendResult) {
      console.log('⚠️ No balance - cannot process inbound');
      return emptyTwiml();
    }

    // Debit using centralized function with idempotency
    const idempotencyKey = `inbound:${newMessage.id}`;
    const { data: creditResult, error: creditError } = await supabase.rpc('fn_apply_credit_movement', {
      p_tenant_id: tenantId,
      p_movement_type: 'debit',
      p_amount: 1,
      p_reason: 'inbound_message',
      p_source_table: 'messages',
      p_source_id: newMessage.id,
      p_idempotency_key: idempotencyKey
    });

    if (creditError || !creditResult?.[0]?.success) {
      console.log('⚠️ Failed to debit for inbound:', creditError || creditResult?.[0]?.error_code);
      return emptyTwiml();
    }

    console.log(`✅ Inbound message credited. New balance: ${creditResult[0].new_balance}`);

    // ========== EMIT AUTOMATION EVENT ==========
    const { error: eventBusError } = await supabase.from('system_event_bus').insert({
      tenant_id: tenantId,
      event_name: 'inbound_message',
      entity_type: 'message',
      entity_id: newMessage.id,
      payload: {
        contact_id: contactId,
        conversation_id: conversationId,
        message_id: newMessage.id,
        message_body: messageBody,
        media_type: mediaType,
        trigger_data: {
          from: customerPhone,
          to: businessPhone,
          body: messageBody,
          media_type: mediaType,
          has_media: numMedia > 0,
        },
      },
      status: 'pending',
    });
    if (eventBusError) {
      console.error('❌ Failed to emit inbound_message event:', eventBusError);
    } else {
      console.log('📤 Emitted inbound_message event to automation bus');
    }

    // ========== CHECK FOR CAMPAIGN REPLY ==========
    const { data: recentCampaignDelivery } = await supabase
      .from('campaign_deliveries')
      .select('campaign_id, updated_at')
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentCampaignDelivery) {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('name, template_id')
        .eq('id', recentCampaignDelivery.campaign_id)
        .single();

      const campaignName = campaignData?.name || 'Unknown Campaign';

      const { error: campaignReplyError } = await supabase.from('system_event_bus').insert({
        tenant_id: tenantId,
        event_name: 'campaign_replied',
        entity_type: 'campaign',
        entity_id: recentCampaignDelivery.campaign_id,
        payload: {
          contact_id: contactId,
          conversation_id: conversationId,
          message_id: newMessage.id,
          campaign_id: recentCampaignDelivery.campaign_id,
          campaign_name: campaignName,
          reply_body: messageBody,
          trigger_data: {
            campaign_id: recentCampaignDelivery.campaign_id,
            campaign_name: campaignName,
            reply_body: messageBody,
            has_media: numMedia > 0,
          },
        },
        status: 'pending',
      });
      if (campaignReplyError) {
        console.error('❌ Failed to emit campaign_replied event:', campaignReplyError);
      } else {
        console.log(`📤 Emitted campaign_replied event for campaign ${recentCampaignDelivery.campaign_id}`);
      }
    }

    // AI call with retry (check balance again)
    const currentBalance = creditResult[0].new_balance;
    if (aiEnabled && currentBalance > 0) {
      try {
        const { data: contact } = await supabase.from('contacts').select('name').eq('id', contactId).single();
        
        for (let attempt = 0; attempt <= CONFIG.AI_MAX_RETRIES; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);
            
            const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-chat-response`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ tenant_id: tenantId, conversation_id: conversationId, contact_id: contactId, inbound_message: messageBody, contact_name: contact?.name }),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            const aiResult = await aiResponse.json();
            console.log('🤖 AI response:', aiResult.action);
            
            if (aiResult.action === 'respond' && aiResult.response) {
              if (aiResult.delay_seconds > 0) await delay(aiResult.delay_seconds * 1000);
              await sendAIResponse(supabase, tenantId, conversationId, businessPhone, customerPhone, aiResult.response, newMessage.id, aiResult.media_urls);
            }
            break;
          } catch (e) {
            console.warn(`AI attempt ${attempt + 1} failed`);
            if (attempt < CONFIG.AI_MAX_RETRIES) await delay(CONFIG.AI_RETRY_DELAY_MS * Math.pow(2, attempt));
          }
        }
      } catch (aiError) {
        console.error('❌ AI error:', aiError);
      }
    }

    // Trigger AI pipeline stage analysis (fire-and-forget, non-blocking)
    try {
      fetch(`${supabaseUrl}/functions/v1/ai-suggest-pipeline-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ tenant_id: tenantId, conversation_id: conversationId, contact_id: contactId }),
      }).catch(e => console.warn('Pipeline suggestion fire-and-forget error:', e));
    } catch (e) {
      console.warn('Pipeline suggestion trigger error:', e);
    }

    // Trigger AI lead scoring (fire-and-forget, non-blocking)
    try {
      fetch(`${supabaseUrl}/functions/v1/ai-lead-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ tenant_id: tenantId, contact_id: contactId }),
      }).catch(e => console.warn('Lead scoring fire-and-forget error:', e));
    } catch (e) {
      console.warn('Lead scoring trigger error:', e);
    }

    console.log(`✅ Webhook completed in ${Date.now() - startTime}ms`);
    return emptyTwiml();

  } catch (error) {
    console.error('❌ Error:', error);
    return emptyTwiml();
  }
});

function emptyTwiml() {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/xml' } });
}

// Helper function to send AI-generated response via Twilio
// deno-lint-ignore no-explicit-any
async function sendAIResponse(
  supabase: any,
  tenantId: string,
  conversationId: string,
  fromNumber: string,
  toNumber: string,
  message: string,
  inboundMessageId: string,
  mediaUrls?: string[]
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  try {
    // Get Twilio credentials
    const { data: integration, error: intError } = await supabase
      .from('tenant_integrations')
      .select('account_sid, auth_token_encrypted')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .eq('status', 'connected')
      .maybeSingle();

    if (intError || !integration) {
      return { success: false, error: 'No Twilio integration found' };
    }

    const accountSid = integration.account_sid;
    // Tokens are stored base64-encoded in auth_token_encrypted
    const authToken = integration.auth_token_encrypted ? atob(integration.auth_token_encrypted) : null;

    if (!accountSid || !authToken) {
      return { success: false, error: 'Missing Twilio credentials' };
    }

    // Insert message first to get ID for idempotency
    const { data: aiMessage, error: msgError } = await supabase.from('messages').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      direction: 'outbound',
      channel: 'whatsapp',
      provider: 'twilio',
      from_number: fromNumber,
      to_number: toNumber,
      body: message,
      media_urls: mediaUrls?.length ? mediaUrls : [],
      media_type: mediaUrls?.length ? 'image' : null,
      status: 'queued',
      ai_generated: true,
      source: 'ai',
    }).select('id').single();

    if (msgError || !aiMessage) {
      return { success: false, error: 'Failed to create message' };
    }

    // Debit using centralized function with idempotency
    const idempotencyKey = `ai_reply:${aiMessage.id}`;
    const { data: creditResult, error: creditError } = await supabase.rpc('fn_apply_credit_movement', {
      p_tenant_id: tenantId,
      p_movement_type: 'debit',
      p_amount: 1,
      p_reason: 'ai_reply',
      p_source_table: 'messages',
      p_source_id: aiMessage.id,
      p_idempotency_key: idempotencyKey
    });

    if (creditError || !creditResult?.[0]?.success) {
      // Delete the queued message
      await supabase.from('messages').delete().eq('id', aiMessage.id);
      return { success: false, error: 'Insufficient credits for AI reply' };
    }

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
    
    // Send text message first
    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${fromNumber}`);
    formData.append('To', `whatsapp:${toNumber}`);
    formData.append('Body', message);
    
    // WhatsApp only supports 1 media per message, so we send the first image with the text
    const imagesToSend = mediaUrls?.slice(0, 5) || [];
    if (imagesToSend.length > 0) {
      formData.append('MediaUrl', imagesToSend[0]);
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    // Send remaining images as separate messages (2nd through 5th)
    if (imagesToSend.length > 1) {
      for (let i = 1; i < imagesToSend.length; i++) {
        try {
          const imgForm = new URLSearchParams();
          imgForm.append('From', `whatsapp:${fromNumber}`);
          imgForm.append('To', `whatsapp:${toNumber}`);
          imgForm.append('MediaUrl', imagesToSend[i]);
          
          await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: imgForm,
          });
          // Small delay between sends to avoid rate limits
          await delay(300);
        } catch (imgErr) {
          console.warn(`⚠️ Failed to send image ${i + 1}:`, imgErr);
        }
      }
    }

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      
      // Revert credit
      const revertKey = `revert:${aiMessage.id}`;
      await supabase.rpc('fn_apply_credit_movement', {
        p_tenant_id: tenantId,
        p_movement_type: 'credit',
        p_amount: 1,
        p_reason: 'revert_ai_send_failed',
        p_source_table: 'messages',
        p_source_id: aiMessage.id,
        p_idempotency_key: revertKey
      });
      
      // Update message as failed
      await supabase.from('messages').update({ status: 'failed', error_message: twilioResult.message }).eq('id', aiMessage.id);
      
      return { success: false, error: twilioResult.message || 'Twilio API error' };
    }

    // Update message with Twilio SID
    await supabase.from('messages').update({
      status: 'sent',
      twilio_message_sid: twilioResult.sid,
    }).eq('id', aiMessage.id);

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_agent_message_at: new Date().toISOString(),
        last_message_preview: message.substring(0, 120),
        last_message_direction: 'outbound',
        last_message_source: 'ai',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    console.log(`✅ AI response sent. New balance: ${creditResult[0].new_balance}`);

    return { success: true, messageSid: twilioResult.sid };
  } catch (error) {
    console.error('Error sending AI response:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}