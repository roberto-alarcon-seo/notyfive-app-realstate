import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignContact {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  country: string | null;
}

interface SegmentCondition {
  field: string;
  operator: string;
  value: unknown;
  fieldType?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // deno-lint-ignore no-explicit-any
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { campaignId, resume, processBatch } = await req.json();
    console.log(`[Campaign ${campaignId}] Starting. Resume: ${resume}, ProcessBatch: ${processBatch}`);

    // Get campaign with template
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        template:templates(*)
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error(`[Campaign ${campaignId}] Not found:`, campaignError);
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate campaign can be executed
    if (!resume && !processBatch && campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      console.error(`[Campaign ${campaignId}] Invalid status: ${campaign.status}`);
      return new Response(JSON.stringify({ error: 'Campaign cannot be started in current status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate template is approved
    if (!campaign.template || campaign.template.approval_status !== 'approved') {
      console.error(`[Campaign ${campaignId}] Template not approved`);
      return new Response(JSON.stringify({ error: 'Template must be approved' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant Twilio integration
    // deno-lint-ignore no-explicit-any
    let integration: any = null;
    const { data: twilio } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', campaign.tenant_id)
      .eq('provider', 'twilio')
      .eq('status', 'connected')
      .maybeSingle();
    
    if (twilio) {
      integration = { ...twilio, type: 'twilio' };
    }

    if (!integration) {
      console.error(`[Campaign ${campaignId}] No integration found`);
      return new Response(JSON.stringify({ error: 'WhatsApp integration not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate WhatsApp Sender is approved (skip for messaging service flows)
    if (integration.phone_number && !integration.messaging_service_sid) {
      const senderStatus = (integration.whatsapp_sender_status || '').toLowerCase();
      const verifiedAt = integration.whatsapp_sender_verified_at
        ? new Date(integration.whatsapp_sender_verified_at).getTime()
        : 0;
      const isFresh = Date.now() - verifiedAt < 24 * 60 * 60 * 1000; // 24h
      const isApproved = ['online', 'approved', 'verified', 'messaging_service'].includes(senderStatus);

      if (!isApproved || !isFresh) {
        console.error(`[Campaign ${campaignId}] WhatsApp Sender not approved or stale (status=${senderStatus}, fresh=${isFresh})`);
        return new Response(JSON.stringify({
          error: 'WHATSAPP_SENDER_NOT_APPROVED',
          message: integration.whatsapp_sender_error
            || 'El número de WhatsApp no está aprobado en Twilio. Verifica el sender en Configuración → WhatsApp.',
          sender_status: senderStatus || null,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if tenant can send using centralized function
    const { data: canSendResult } = await supabase.rpc('can_send_message', { p_tenant_id: campaign.tenant_id });
    
    if (!canSendResult) {
      console.error(`[Campaign ${campaignId}] Cannot send - insufficient credits or blocked`);
      return new Response(JSON.stringify({ error: 'Insufficient credits or blocked tenant' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant credits for display
    const { data: tenant } = await supabase
      .from('tenants')
      .select('message_credits')
      .eq('id', campaign.tenant_id)
      .single();

    // If processing a batch only
    if (processBatch) {
      return await processCampaignBatch(supabase, campaign, corsHeaders);
    }

    // If resuming, update status and continue
    if (resume) {
      await supabase
        .from('campaigns')
        .update({ status: 'sending', paused_at: null, pause_reason: null })
        .eq('id', campaignId);
      
      return await processCampaignBatch(supabase, campaign, corsHeaders);
    }

    // Fresh start - get contacts based on audience type
    let contacts: CampaignContact[] = [];
    
    if (campaign.audience_type === 'segment' && campaign.segment_id) {
      const { data: segment } = await supabase
        .from('segments')
        .select('type, rules_json')
        .eq('id', campaign.segment_id)
        .single();

      if (segment?.type === 'static') {
        const { data: segmentContacts } = await supabase
          .from('segment_contacts')
          .select('contact_id')
          .eq('segment_id', campaign.segment_id);

        if (segmentContacts && segmentContacts.length > 0) {
          const contactIds = segmentContacts.map((sc: { contact_id: string }) => sc.contact_id);
          const { data: contactsData } = await supabase
            .from('contacts')
            .select('id, phone, name, email, country')
            .in('id', contactIds)
            .eq('status', 'active')
            .not('phone', 'is', null);
          contacts = (contactsData || []) as CampaignContact[];
        }
      } else if (segment?.type === 'dynamic' && segment.rules_json) {
        // For dynamic segments, apply base conditions via query, then filter custom field conditions in memory
        let query = supabase
          .from('contacts')
          .select('id, phone, name, email, country')
          .eq('tenant_id', campaign.tenant_id)
          .eq('status', 'active')
          .not('phone', 'is', null);

        const rules = segment.rules_json as { conditions?: SegmentCondition[]; logic?: string };
        const baseConditions = rules.conditions?.filter((c: SegmentCondition) => c.fieldType === 'base') || [];
        const customConditions = rules.conditions?.filter((c: SegmentCondition) => c.fieldType === 'custom') || [];

        // Apply base conditions to query
        for (const condition of baseConditions) {
          query = applyCondition(query, condition);
        }

        const { data: contactsData } = await query;
        let filteredContacts = (contactsData || []) as CampaignContact[];

        // If there are custom field conditions, filter in memory
        if (customConditions.length > 0) {
          const contactIds = filteredContacts.map(c => c.id);
          
          if (contactIds.length > 0) {
            // Get all custom field values for these contacts
            const { data: customFieldValues } = await supabase
              .from('contact_custom_field_values')
              .select('contact_id, value_text, field:contact_custom_fields(key)')
              .in('contact_id', contactIds);

            // Build a map of contact -> field -> value
            const contactFieldMap: Record<string, Record<string, string>> = {};
            for (const cfv of (customFieldValues || []) as { contact_id: string; value_text: string | null; field: { key: string } | null }[]) {
              if (!cfv.field) continue;
              if (!contactFieldMap[cfv.contact_id]) contactFieldMap[cfv.contact_id] = {};
              contactFieldMap[cfv.contact_id][cfv.field.key] = cfv.value_text || '';
            }

            // Filter contacts by custom field conditions
            const logic = rules.logic || 'AND';
            filteredContacts = filteredContacts.filter(contact => {
              const fieldValues = contactFieldMap[contact.id] || {};
              
              if (logic === 'AND') {
                return customConditions.every(cond => evaluateCustomCondition(cond, fieldValues));
              } else {
                return customConditions.some(cond => evaluateCustomCondition(cond, fieldValues));
              }
            });
          }
        }

        contacts = filteredContacts;
        console.log(`[Campaign ${campaignId}] Dynamic segment evaluated: ${filteredContacts.length} contacts match`);
      }
    } else {
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('id, phone, name, email, country')
        .eq('tenant_id', campaign.tenant_id)
        .eq('status', 'active')
        .not('phone', 'is', null);

      contacts = (allContacts || []) as CampaignContact[];
    }

    if (contacts.length === 0) {
      console.error(`[Campaign ${campaignId}] No contacts found`);
      return new Response(JSON.stringify({ error: 'No contacts found for this campaign' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Campaign ${campaignId}] Found ${contacts.length} contacts`);

    // Clear existing queue
    await supabase
      .from('campaign_queue')
      .delete()
      .eq('campaign_id', campaignId);

    // Insert into campaign_queue
    const queueItems = contacts.map(contact => ({
      tenant_id: campaign.tenant_id,
      campaign_id: campaignId,
      contact_id: contact.id,
      phone: contact.phone!,
      status: 'pending',
      scheduled_at: new Date().toISOString(),
    }));

    for (let i = 0; i < queueItems.length; i += 100) {
      await supabase.from('campaign_queue').insert(queueItems.slice(i, i + 100));
    }

    // Insert into campaign_contacts
    const campaignContacts = contacts.map(c => ({
      campaign_id: campaignId,
      contact_id: c.id,
      tenant_id: campaign.tenant_id,
      status: 'pending',
    }));

    for (let i = 0; i < campaignContacts.length; i += 100) {
      await supabase.from('campaign_contacts').insert(campaignContacts.slice(i, i + 100));
    }

    // Insert into campaign_deliveries for tracking
    const campaignDeliveries = contacts.map(c => ({
      tenant_id: campaign.tenant_id,
      campaign_id: campaignId,
      contact_id: c.id,
      status: 'queued',
    }));

    for (let i = 0; i < campaignDeliveries.length; i += 100) {
      await supabase.from('campaign_deliveries').upsert(campaignDeliveries.slice(i, i + 100), {
        onConflict: 'tenant_id,campaign_id,contact_id',
      });
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
        total_contacts: contacts.length,
        queue_total: contacts.length,
        queue_processed: 0,
        current_batch: 0,
      })
      .eq('id', campaignId);

    console.log(`[Campaign ${campaignId}] Queue initialized. Starting background processing.`);

    // Process in background
    // deno-lint-ignore no-explicit-any
    const EdgeRuntime = (globalThis as any).EdgeRuntime;
    EdgeRuntime.waitUntil(processBatches(supabase, campaignId, campaign.tenant_id, integration, campaign.template, campaign.variable_mapping || {}));

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Campaign started',
      totalContacts: contacts.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Campaign] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function processCampaignBatch(supabase: any, campaign: any, corsHeaders: Record<string, string>) {
  const campaignId = campaign.id;
  
  const { data: currentCampaign } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (currentCampaign?.status !== 'sending') {
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Campaign not in sending status',
      status: currentCampaign?.status 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { count: pendingCount } = await supabase
    .from('campaign_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  if (!pendingCount || pendingCount === 0) {
    await markComplete(supabase, campaignId);
    return new Response(JSON.stringify({ success: true, completed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, pending: pendingCount }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get or create conversation for a contact
// deno-lint-ignore no-explicit-any
async function getOrCreateConversation(supabase: any, tenantId: string, contactId: string, phone: string, integration: any): Promise<string> {
  // Format phone for WhatsApp
  const formattedPhone = phone.replace(/\D/g, '');
  const customerWhatsapp = `whatsapp:+${formattedPhone}`;

  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Create new conversation
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      customer_whatsapp: customerWhatsapp,
      twilio_whatsapp_number: integration.phone_number,
      twilio_subaccount_sid: integration.account_sid,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return newConv.id;
}

// Create message for campaign
// deno-lint-ignore no-explicit-any
async function createCampaignMessage(
  supabase: any,
  tenantId: string,
  conversationId: string,
  contactId: string,
  campaignId: string,
  templateId: string,
  bodyText: string,
  fromNumber: string,
  toNumber: string
): Promise<string> {
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: 'outbound',
      source: 'campaign',
      campaign_id: campaignId,
      template_id: templateId,
      body: bodyText,
      from_number: fromNumber,
      to_number: toNumber,
      channel: 'whatsapp',
      provider: 'twilio',
      status: 'queued',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating message:', error);
    throw error;
  }

  return message.id;
}

// Update conversation with last message info
// deno-lint-ignore no-explicit-any
async function updateConversationLastMessage(
  supabase: any,
  conversationId: string,
  preview: string
) {
  await supabase
    .from('conversations')
    .update({
      last_message_preview: preview.substring(0, 100),
      last_message_direction: 'outbound',
      last_message_source: 'campaign',
      last_agent_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

// Background batch processing
// deno-lint-ignore no-explicit-any
async function processBatches(supabase: any, campaignId: string, tenantId: string, integration: any, template: any, variableMapping: Record<string, string>) {
  const BATCH_SIZE = 20;
  const BATCH_DELAY = 45000;
  const MSG_DELAY = 1500;

  console.log(`[Campaign ${campaignId}] Background processing started`);

  while (true) {
    // Check campaign status
    const { data: campaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
    if (campaign?.status !== 'sending') {
      console.log(`[Campaign ${campaignId}] Status: ${campaign?.status}, stopping`);
      break;
    }

    // Check if tenant can send using centralized function
    const { data: canSendResult } = await supabase.rpc('can_send_message', { p_tenant_id: tenantId });
    if (!canSendResult) {
      console.log(`[Campaign ${campaignId}] Cannot send - credits exhausted, pausing`);
      await supabase.from('campaigns').update({ status: 'paused', pause_reason: 'insufficient_balance', paused_at: new Date().toISOString() }).eq('id', campaignId);
      break;
    }

    // Get current credits for batch sizing
    const { data: tenant } = await supabase.from('tenants').select('message_credits').eq('id', tenantId).single();
    const currentCredits = tenant?.message_credits || 0;

    // Check warmup limit
    const { data: intg } = await supabase.from('tenant_integrations').select('daily_messages_sent, max_messages_per_day, daily_messages_date').eq('id', integration.id).single();
    const dailyLimit = intg?.max_messages_per_day || 200;
    let dailySent = intg?.daily_messages_sent || 0;
    const today = new Date().toISOString().split('T')[0];

    if (intg?.daily_messages_date !== today) {
      dailySent = 0;
      await supabase.from('tenant_integrations').update({ daily_messages_sent: 0, daily_messages_date: today }).eq('id', integration.id);
    }

    if (dailySent >= dailyLimit) {
      console.log(`[Campaign ${campaignId}] Daily limit reached, pausing`);
      await supabase.from('campaigns').update({ status: 'paused', pause_reason: 'warmup_limit', paused_at: new Date().toISOString() }).eq('id', campaignId);
      break;
    }

    const effectiveSize = Math.min(BATCH_SIZE, currentCredits, dailyLimit - dailySent);

    // Get pending items
    const { data: items } = await supabase
      .from('campaign_queue')
      .select('*, contact:contacts(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('scheduled_at')
      .limit(effectiveSize);

    if (!items || items.length === 0) {
      console.log(`[Campaign ${campaignId}] Queue empty, complete`);
      await markComplete(supabase, campaignId);
      break;
    }

    console.log(`[Campaign ${campaignId}] Processing ${items.length} messages`);

    let sent = 0;
    let failed = 0;

    // deno-lint-ignore no-explicit-any
    for (const item of items as any[]) {
      try {
        // Get or create conversation for this contact
        const conversationId = await getOrCreateConversation(
          supabase, 
          tenantId, 
          item.contact_id, 
          item.phone, 
          integration
        );

        // Build message body text from template
        const bodyText = buildMessageBody(template, variableMapping, item.contact as CampaignContact);
        const formattedPhone = item.phone.replace(/\D/g, '');
        const fromNumber = `whatsapp:${integration.phone_number}`;
        const toNumber = `whatsapp:+${formattedPhone}`;

        // Create message in database BEFORE sending to Twilio
        const messageId = await createCampaignMessage(
          supabase,
          tenantId,
          conversationId,
          item.contact_id,
          campaignId,
          template.id,
          bodyText,
          fromNumber,
          toNumber
        );

        // Update campaign_deliveries with conversation and message info
        await supabase
          .from('campaign_deliveries')
          .update({ 
            conversation_id: conversationId, 
            message_id: messageId,
            status: 'queued',
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('campaign_id', campaignId)
          .eq('contact_id', item.contact_id);

        // Update conversation with last message preview
        await updateConversationLastMessage(supabase, conversationId, bodyText);

        // Debit credit using centralized function
        await supabase.rpc('fn_apply_credit_movement', {
          p_tenant_id: tenantId,
          p_movement_type: 'debit',
          p_amount: 1,
          p_reason: 'campaign_message',
          p_source_table: 'campaign_deliveries',
          p_source_id: item.contact_id,
          p_idempotency_key: `campaign_${campaignId}_contact_${item.contact_id}_msg_${messageId}`
        });

        // Send message to Twilio
        const contact = item.contact as CampaignContact;
        const result = await sendMessage(integration, template, variableMapping, contact, item.phone);

        if (result.success) {
          // Update message status to sent
          await supabase
            .from('messages')
            .update({ 
              status: 'sent', 
              twilio_message_sid: result.messageId 
            })
            .eq('id', messageId);

          // Update campaign_deliveries
          await supabase
            .from('campaign_deliveries')
            .update({ 
              status: 'sent', 
              provider_message_sid: result.messageId,
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('campaign_id', campaignId)
            .eq('contact_id', item.contact_id);

          await supabase.from('campaign_queue').update({ status: 'sent', sent_at: new Date().toISOString(), twilio_message_sid: result.messageId, attempts: item.attempts + 1 }).eq('id', item.id);
          await supabase.from('campaign_contacts').update({ status: 'sent', sent_at: new Date().toISOString(), twilio_message_sid: result.messageId }).eq('campaign_id', campaignId).eq('contact_id', item.contact_id);
          
          // ========== EMIT CAMPAIGN_TOUCHED EVENT ==========
          await supabase.from('system_event_bus').insert({
            tenant_id: tenantId,
            event_name: 'campaign_touched',
            entity_type: 'campaign',
            entity_id: campaignId,
            payload: {
              contact_id: item.contact_id,
              conversation_id: conversationId,
              campaign_id: campaignId,
              message_id: messageId,
              template_id: template.id,
              template_name: template.name,
              trigger_data: {
                campaign_name: campaignId,
                template_name: template.name,
                sent_at: new Date().toISOString(),
              },
            },
            status: 'pending',
          });
          console.log(`[Campaign ${campaignId}] Emitted campaign_touched for contact ${item.contact_id}`);
          
          sent++;
        } else {
          // Update message status to failed
          await supabase
            .from('messages')
            .update({ 
              status: 'failed', 
              error_code: result.errorCode,
              error_message: result.errorMessage,
            })
            .eq('id', messageId);

          // Update campaign_deliveries
          await supabase
            .from('campaign_deliveries')
            .update({ 
              status: 'failed', 
              error_code: result.errorCode,
              error_message: result.errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('campaign_id', campaignId)
            .eq('contact_id', item.contact_id);

          const retry = item.attempts < item.max_attempts - 1 && result.retryable;
          await supabase.from('campaign_queue').update({ status: retry ? 'pending' : 'failed', error_code: result.errorCode, error_message: result.errorMessage, attempts: item.attempts + 1, scheduled_at: retry ? new Date(Date.now() + 60000).toISOString() : undefined }).eq('id', item.id);
          
          if (!retry) {
            await supabase.from('campaign_contacts').update({ status: 'failed', error_code: result.errorCode, error_message: result.errorMessage }).eq('campaign_id', campaignId).eq('contact_id', item.contact_id);
            failed++;
          }

          if (result.policyViolation) {
            console.error(`[Campaign ${campaignId}] Policy violation, stopping`);
            await supabase.from('campaigns').update({ status: 'paused', pause_reason: 'policy_violation', paused_at: new Date().toISOString() }).eq('id', campaignId);
            return;
          }
        }

        await new Promise(r => setTimeout(r, MSG_DELAY));
      } catch (err) {
        console.error(`[Campaign ${campaignId}] Error:`, err);
        await supabase.from('campaign_queue').update({ status: 'failed', error_message: String(err), attempts: item.attempts + 1 }).eq('id', item.id);
        
        // Update campaign_deliveries with error
        await supabase
          .from('campaign_deliveries')
          .update({ 
            status: 'failed', 
            error_message: String(err),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('campaign_id', campaignId)
          .eq('contact_id', item.contact_id);

        failed++;
      }
    }

    // Update progress
    const { data: stats } = await supabase.from('campaign_queue').select('status').eq('campaign_id', campaignId);
    // deno-lint-ignore no-explicit-any
    const totalSent = stats?.filter((s: any) => s.status === 'sent').length || 0;
    // deno-lint-ignore no-explicit-any
    const totalFailed = stats?.filter((s: any) => s.status === 'failed').length || 0;
    // deno-lint-ignore no-explicit-any
    const totalPending = stats?.filter((s: any) => s.status === 'pending').length || 0;

    await supabase.from('campaigns').update({ sent_count: totalSent, failed_count: totalFailed, queue_processed: totalSent + totalFailed, last_batch_at: new Date().toISOString() }).eq('id', campaignId);
    await supabase.from('tenant_integrations').update({ daily_messages_sent: dailySent + sent, total_messages_sent: (integration.total_messages_sent || 0) + sent }).eq('id', integration.id);

    console.log(`[Campaign ${campaignId}] Batch done. Sent: ${sent}, Failed: ${failed}, Pending: ${totalPending}`);

    if (totalPending === 0) {
      await markComplete(supabase, campaignId);
      break;
    }

    console.log(`[Campaign ${campaignId}] Waiting ${BATCH_DELAY}ms`);
    await new Promise(r => setTimeout(r, BATCH_DELAY));
  }

  console.log(`[Campaign ${campaignId}] Finished`);
}

// Build message body from template and variable mapping
// deno-lint-ignore no-explicit-any
function buildMessageBody(template: any, variableMapping: Record<string, string>, contact: CampaignContact): string {
  let body = template.body || '';
  const variables = (template.variables as string[]) || [];
  
  for (const varName of variables) {
    const contactField = variableMapping[varName] as keyof CampaignContact;
    const value = contact[contactField] || '';
    body = body.replace(new RegExp(`{{${varName}}}`, 'g'), String(value));
  }
  
  return body;
}

// deno-lint-ignore no-explicit-any
async function markComplete(supabase: any, campaignId: string) {
  const { data: stats } = await supabase.from('campaign_queue').select('status').eq('campaign_id', campaignId);
  await supabase.from('campaigns').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    // deno-lint-ignore no-explicit-any
    sent_count: stats?.filter((s: any) => s.status === 'sent').length || 0,
    // deno-lint-ignore no-explicit-any
    failed_count: stats?.filter((s: any) => s.status === 'failed').length || 0,
    queue_processed: stats?.length || 0,
  }).eq('id', campaignId);
}

// deno-lint-ignore no-explicit-any
async function sendMessage(integration: any, template: any, variableMapping: Record<string, string>, contact: CampaignContact, phone: string): Promise<{ success: boolean; messageId?: string; errorCode?: string; errorMessage?: string; retryable?: boolean; policyViolation?: boolean }> {
  const formattedPhone = phone.replace(/\D/g, '');
  const variables = (template.variables as string[]) || [];

  // Decode the auth token from base64
  const authToken = atob(integration.auth_token_encrypted);
  
  const formData = new URLSearchParams();
  formData.append('To', `whatsapp:+${formattedPhone}`);
  formData.append('From', `whatsapp:${integration.phone_number}`);

  if (template.twilio_template_sid) {
    formData.append('ContentSid', template.twilio_template_sid);
    const vars: Record<string, string> = {};
    variables.forEach((v, i) => { vars[String(i + 1)] = String(contact[variableMapping[v] as keyof CampaignContact] || ''); });
    if (Object.keys(vars).length > 0) formData.append('ContentVariables', JSON.stringify(vars));
  }

  if (integration.messaging_service_sid) formData.append('MessagingServiceSid', integration.messaging_service_sid);

  console.log(`[Twilio] Sending to ${formattedPhone} from ${integration.phone_number}`);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${integration.account_sid}/Messages.json`, {
    method: 'POST',
    headers: { 
      'Authorization': `Basic ${btoa(`${integration.account_sid}:${authToken}`)}`, 
      'Content-Type': 'application/x-www-form-urlencoded' 
    },
    body: formData.toString(),
  });

  const data = await res.json();
  console.log(`[Twilio] Response status: ${res.status}, data:`, JSON.stringify(data));
  
  if (res.ok) {
    return { success: true, messageId: data.sid };
  }
  return { success: false, errorCode: data.code?.toString(), errorMessage: data.message, retryable: res.status >= 500 || res.status === 429, policyViolation: data.code === 63016 || data.code === 63018 };
}

// deno-lint-ignore no-explicit-any
function applyCondition(query: any, condition: SegmentCondition) {
  const { field, operator, value } = condition;
  switch (operator) {
    case 'equals': return query.eq(field, value);
    case 'not_equals': return query.neq(field, value);
    case 'contains': return query.ilike(field, `%${value}%`);
    case 'is_empty': return query.is(field, null);
    case 'is_not_empty': return query.not(field, 'is', null);
    case 'contains_tag': return query.contains(field, [value]);
    default: return query;
  }
}

// Evaluate custom field condition in memory
function evaluateCustomCondition(condition: SegmentCondition, fieldValues: Record<string, string>): boolean {
  const { field, operator, value } = condition;
  const fieldValue = fieldValues[field] || '';
  const stringValue = String(value || '');

  switch (operator) {
    case 'equals':
      return fieldValue.toLowerCase() === stringValue.toLowerCase();
    case 'not_equals':
      return fieldValue.toLowerCase() !== stringValue.toLowerCase();
    case 'contains':
      return fieldValue.toLowerCase().includes(stringValue.toLowerCase());
    case 'not_contains':
      return !fieldValue.toLowerCase().includes(stringValue.toLowerCase());
    case 'is_empty':
      return !fieldValue || fieldValue.trim() === '';
    case 'is_not_empty':
      return !!fieldValue && fieldValue.trim() !== '';
    case 'starts_with':
      return fieldValue.toLowerCase().startsWith(stringValue.toLowerCase());
    case 'ends_with':
      return fieldValue.toLowerCase().endsWith(stringValue.toLowerCase());
    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(stringValue);
    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(stringValue);
    default:
      return true;
  }
}
