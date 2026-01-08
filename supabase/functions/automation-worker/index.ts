import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface AutomationCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  rate_limits: {
    per_minute?: number;
    per_hour?: number;
    per_contact_day?: number;
  };
  cooldown_hours?: number;
  allowed_hours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
    days: number[];
  };
}

interface EventPayload {
  contact_id: string;
  conversation_id?: string;
  event_id?: string;
  message_id?: string;
  trigger_data?: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { event_id } = await req.json();

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: 'event_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🤖 Processing automation event: ${event_id}`);

    // 1) Fetch the event from system_event_bus
    const { data: event, error: eventError } = await supabase
      .from('system_event_bus')
      .select('*')
      .eq('id', event_id)
      .maybeSingle();

    if (eventError || !event) {
      console.error('❌ Event not found:', eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (event.status !== 'pending') {
      console.log(`⏭️ Event already processed: ${event.status}`);
      return new Response(
        JSON.stringify({ message: 'Event already processed', status: event.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = event.tenant_id;
    const eventName = event.event_name as string;
    const payload = event.payload as EventPayload;

    console.log(`📋 Event: ${eventName} for tenant ${tenantId}`);

    // 2) Mark event as processing
    await supabase
      .from('system_event_bus')
      .update({ status: 'processing' })
      .eq('id', event_id);

    // Special handling for automation.resume events
    if (eventName === 'automation.resume') {
      const result = await handleResumeEvent(supabase, payload);
      await markEventCompleted(supabase, event_id);
      return new Response(
        JSON.stringify({ event_id, result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Find matching active automations for this trigger
    const { data: automations, error: automationsError } = await supabase
      .from('automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('trigger_type', eventName);

    if (automationsError) {
      console.error('❌ Error fetching automations:', automationsError);
      await markEventFailed(supabase, event_id, 'Failed to fetch automations');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch automations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!automations || automations.length === 0) {
      console.log(`ℹ️ No active automations for trigger: ${eventName}`);
      await markEventCompleted(supabase, event_id);
      return new Response(
        JSON.stringify({ message: 'No matching automations', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Found ${automations.length} matching automation(s)`);

    // 4) Process each matching automation
    const results: Array<{ automation_id: string; status: string; run_id?: string; error?: string }> = [];

    for (const automation of automations) {
      try {
        const result = await processAutomation(supabase, automation as Automation, payload, event_id);
        results.push(result);
      } catch (err) {
        console.error(`❌ Error processing automation ${automation.id}:`, err);
        results.push({
          automation_id: automation.id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // 5) Mark event as completed
    await markEventCompleted(supabase, event_id);

    console.log(`✅ Event ${event_id} processed. Results:`, results);

    return new Response(
      JSON.stringify({ event_id, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Automation worker error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ Helper Functions ============

async function markEventFailed(supabase: SupabaseClient, eventId: string, error: string) {
  await supabase
    .from('system_event_bus')
    .update({ status: 'failed', error, processed_at: new Date().toISOString() })
    .eq('id', eventId);
}

async function markEventCompleted(supabase: SupabaseClient, eventId: string) {
  await supabase
    .from('system_event_bus')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', eventId);
}

// ============ Automation Processing ============

async function processAutomation(
  supabase: SupabaseClient,
  automation: Automation,
  payload: EventPayload,
  triggerEventId: string
): Promise<{ automation_id: string; status: string; run_id?: string; error?: string }> {
  console.log(`🚀 Processing automation: ${automation.name} (${automation.id})`);

  const contactId = payload.contact_id;
  const conversationId = payload.conversation_id;

  // 1) Check idempotency - prevent duplicate runs
  const idempotencyKey = `${automation.id}:${contactId}:${triggerEventId}`;
  const { data: existingRun } = await supabase
    .from('automation_idempotency')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingRun) {
    console.log(`⏭️ Skipping duplicate run for automation ${automation.id}`);
    return { automation_id: automation.id, status: 'skipped_duplicate' };
  }

  // 2) Check rate limits
  const rateLimitResult = await checkRateLimits(supabase, automation, contactId);
  if (!rateLimitResult.allowed) {
    console.log(`⚠️ Rate limit hit: ${rateLimitResult.reason}`);
    return { automation_id: automation.id, status: rateLimitResult.status as string };
  }

  // 3) Check cooldown
  if (automation.cooldown_hours && automation.cooldown_hours > 0) {
    const cooldownResult = await checkCooldown(supabase, automation.id, contactId, automation.cooldown_hours);
    if (!cooldownResult.allowed) {
      console.log(`⏳ Cooldown active for contact ${contactId}`);
      return { automation_id: automation.id, status: 'blocked_cooldown' };
    }
  }

  // 4) Check allowed hours
  if (automation.allowed_hours?.enabled) {
    const allowedResult = isWithinAllowedHours(automation.allowed_hours);
    if (!allowedResult) {
      console.log(`🕐 Outside allowed hours`);
      return { automation_id: automation.id, status: 'blocked_window' };
    }
  }

  // 5) Fetch contact data for condition evaluation
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  // Fetch event data if applicable
  let eventData = null;
  if (payload.event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', payload.event_id)
      .single();
    eventData = event;
  }

  // 6) Evaluate conditions
  const context = {
    contact,
    event: eventData,
    conversation_id: conversationId,
    trigger_data: payload.trigger_data || {},
  };

  const conditionsPass = evaluateConditions(automation.conditions || [], context);
  
  if (!conditionsPass) {
    console.log(`❌ Conditions not met for automation ${automation.id}`);
    
    // Log skipped run
    await supabase.from('automation_runs').insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      contact_id: contactId,
      conversation_id: conversationId,
      trigger_event_id: triggerEventId,
      status: 'skipped_condition',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });

    return { automation_id: automation.id, status: 'skipped_condition' };
  }

  // 7) Check wallet balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance_messages, status')
    .eq('tenant_id', automation.tenant_id)
    .single();

  if (!wallet || wallet.balance_messages < 1) {
    console.log(`💰 Insufficient wallet balance`);
    
    await supabase.from('automation_runs').insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      contact_id: contactId,
      conversation_id: conversationId,
      trigger_event_id: triggerEventId,
      status: 'blocked_wallet',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });

    return { automation_id: automation.id, status: 'blocked_wallet' };
  }

  // 8) Create automation run
  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      contact_id: contactId,
      conversation_id: conversationId,
      trigger_event_id: triggerEventId,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: { trigger_data: payload.trigger_data },
    })
    .select('id')
    .single();

  if (runError || !run) {
    console.error('❌ Failed to create automation run:', runError);
    return { automation_id: automation.id, status: 'failed', error: 'Failed to create run' };
  }

  // 9) Record idempotency
  await supabase.from('automation_idempotency').insert({
    tenant_id: automation.tenant_id,
    automation_id: automation.id,
    idempotency_key: idempotencyKey,
  });

  // 10) Execute actions
  const actions = automation.actions || [];
  let walletConsumed = 0;
  let success = true;
  let errorMessage: string | null = null;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    try {
      const stepResult = await executeAction(supabase, automation, run.id, action, i, context, wallet);
      
      if (stepResult.wallet_consumed) {
        walletConsumed += stepResult.wallet_consumed;
      }

      if (stepResult.status === 'failed') {
        success = false;
        errorMessage = stepResult.error || 'Action failed';
        break;
      }

      // Handle delay actions - pause execution
      if (stepResult.status === 'paused') {
        await supabase
          .from('automation_runs')
          .update({
            status: 'paused',
            metadata: { 
              paused_at_step: i,
              resume_at: stepResult.resume_at,
              trigger_data: payload.trigger_data 
            },
          })
          .eq('id', run.id);

        return { automation_id: automation.id, status: 'paused', run_id: run.id };
      }

    } catch (err) {
      console.error(`❌ Action ${action.type} failed:`, err);
      success = false;
      errorMessage = err instanceof Error ? err.message : 'Unknown action error';

      await supabase.from('automation_run_steps').insert({
        tenant_id: automation.tenant_id,
        run_id: run.id,
        step_index: i,
        action_type: action.type,
        action_payload: action.config,
        status: 'failed',
        error_message: errorMessage,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      });

      break;
    }
  }

  // 11) Update run status
  const finalStatus = success ? 'success' : 'failed';
  await supabase
    .from('automation_runs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      wallet_consumed: walletConsumed,
      error_message: errorMessage,
    })
    .eq('id', run.id);

  console.log(`✅ Automation ${automation.id} completed with status: ${finalStatus}`);

  return { automation_id: automation.id, status: finalStatus, run_id: run.id };
}

// ============ Rate Limiting ============

async function checkRateLimits(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string
): Promise<{ allowed: boolean; reason?: string; status?: string }> {
  const rateLimits = automation.rate_limits || {};
  const now = new Date();

  // Per minute limit
  if (rateLimits.per_minute && rateLimits.per_minute > 0) {
    const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();
    const { count } = await supabase
      .from('automation_runs')
      .select('*', { count: 'exact', head: true })
      .eq('automation_id', automation.id)
      .gte('created_at', oneMinuteAgo);

    if (count && count >= rateLimits.per_minute) {
      return { allowed: false, reason: 'per_minute limit exceeded', status: 'blocked_rate' };
    }
  }

  // Per hour limit
  if (rateLimits.per_hour && rateLimits.per_hour > 0) {
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    const { count } = await supabase
      .from('automation_runs')
      .select('*', { count: 'exact', head: true })
      .eq('automation_id', automation.id)
      .gte('created_at', oneHourAgo);

    if (count && count >= rateLimits.per_hour) {
      return { allowed: false, reason: 'per_hour limit exceeded', status: 'blocked_rate' };
    }
  }

  // Per contact per day limit
  if (rateLimits.per_contact_day && rateLimits.per_contact_day > 0) {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { count } = await supabase
      .from('automation_runs')
      .select('*', { count: 'exact', head: true })
      .eq('automation_id', automation.id)
      .eq('contact_id', contactId)
      .gte('created_at', startOfDay);

    if (count && count >= rateLimits.per_contact_day) {
      return { allowed: false, reason: 'per_contact_day limit exceeded', status: 'blocked_rate' };
    }
  }

  return { allowed: true };
}

async function checkCooldown(
  supabase: SupabaseClient,
  automationId: string,
  contactId: string,
  cooldownHours: number
): Promise<{ allowed: boolean }> {
  const cooldownCutoff = new Date(Date.now() - cooldownHours * 3600000).toISOString();
  
  const { data: recentRun } = await supabase
    .from('automation_runs')
    .select('id')
    .eq('automation_id', automationId)
    .eq('contact_id', contactId)
    .eq('status', 'success')
    .gte('finished_at', cooldownCutoff)
    .maybeSingle();

  return { allowed: !recentRun };
}

function isWithinAllowedHours(allowedHours: {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  days: number[];
}): boolean {
  if (!allowedHours.enabled) return true;

  const now = new Date();
  const currentDay = now.getDay();

  // Check day of week
  if (!allowedHours.days.includes(currentDay)) {
    return false;
  }

  // Parse times (simple HH:mm format)
  const [startHour, startMin] = allowedHours.start.split(':').map(Number);
  const [endHour, endMin] = allowedHours.end.split(':').map(Number);
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// ============ Condition Evaluation ============

function evaluateConditions(
  conditions: AutomationCondition[],
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions = always pass
  }

  for (const condition of conditions) {
    if (!evaluateCondition(condition, context)) {
      return false; // AND logic - all must pass
    }
  }

  return true;
}

function evaluateCondition(
  condition: AutomationCondition,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): boolean {
  const { field, operator, value } = condition;

  // Get the actual value from context
  const actualValue = getValueFromContext(field, context);

  switch (operator) {
    case 'equals':
      return actualValue === value;
    case 'not_equals':
      return actualValue !== value;
    case 'contains':
      return String(actualValue).includes(String(value));
    case 'not_contains':
      return !String(actualValue).includes(String(value));
    case 'starts_with':
      return String(actualValue).startsWith(String(value));
    case 'ends_with':
      return String(actualValue).endsWith(String(value));
    case 'greater_than':
      return Number(actualValue) > Number(value);
    case 'less_than':
      return Number(actualValue) < Number(value);
    case 'is_empty':
      return actualValue === null || actualValue === undefined || actualValue === '';
    case 'is_not_empty':
      return actualValue !== null && actualValue !== undefined && actualValue !== '';
    case 'in_array':
      return Array.isArray(actualValue) && actualValue.includes(value);
    case 'not_in_array':
      return Array.isArray(actualValue) && !actualValue.includes(value);
    case 'within_hours':
      // Special handling for time-based conditions
      return true; // Already checked in allowed_hours
    case 'not_executed':
      // Already handled by idempotency check
      return true;
    default:
      console.warn(`Unknown operator: ${operator}`);
      return true;
  }
}

function getValueFromContext(
  field: string,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): unknown {
  const parts = field.split('.');
  const source = parts[0];
  const path = parts.slice(1).join('.');

  let data: unknown = null;

  switch (source) {
    case 'contact':
      data = context.contact;
      break;
    case 'event':
      data = context.event;
      break;
    case 'trigger':
      data = context.trigger_data;
      break;
    case 'execution':
      // Special execution-time fields
      return null;
    default:
      return null;
  }

  if (!data || !path) return data;

  // Navigate path
  const pathParts = path.split('.');
  let current: unknown = data;
  
  for (const part of pathParts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
}

// ============ Action Execution ============

interface ActionResult {
  status: 'success' | 'failed' | 'paused';
  wallet_consumed?: number;
  error?: string;
  resume_at?: string;
}

async function executeAction(
  supabase: SupabaseClient,
  automation: Automation,
  runId: string,
  action: AutomationAction,
  stepIndex: number,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> },
  wallet: { id: string; balance_messages: number }
): Promise<ActionResult> {
  const startTime = new Date().toISOString();

  console.log(`🎬 Executing action ${stepIndex + 1}: ${action.type}`);

  // Create step record
  const { data: step } = await supabase
    .from('automation_run_steps')
    .insert({
      tenant_id: automation.tenant_id,
      run_id: runId,
      step_index: stepIndex,
      action_type: action.type,
      action_payload: action.config,
      status: 'running',
      started_at: startTime,
    })
    .select('id')
    .single();

  const stepId = step?.id;

  try {
    let result: ActionResult;

    switch (action.type) {
      case 'send_template':
        result = await executeSendTemplate(supabase, automation, action, context, wallet);
        break;
      case 'send_message':
        result = await executeSendMessage(supabase, automation, action, context, wallet);
        break;
      case 'update_field':
        result = await executeUpdateField(supabase, action, context);
        break;
      case 'add_tag':
        result = await executeAddTag(supabase, action, context);
        break;
      case 'remove_tag':
        result = await executeRemoveTag(supabase, action, context);
        break;
      case 'create_note':
        result = await executeCreateNote(supabase, automation, action, context);
        break;
      case 'update_event_status':
        result = await executeUpdateEventStatus(supabase, action, context);
        break;
      case 'pause_ai':
        result = await executePauseAI(supabase, context);
        break;
      case 'enable_ai':
        result = await executeEnableAI(supabase, context);
        break;
      case 'escalate':
        result = await executeEscalate(supabase, context);
        break;
      case 'delay':
        result = await executeDelay(action);
        break;
      case 'send_webhook':
        result = await executeSendWebhook(action, context);
        break;
      case 'create_followup':
        result = await executeCreateFollowup(supabase, automation, action, context);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
        result = { status: 'success' };
    }

    // Update step record
    if (stepId) {
      await supabase
        .from('automation_run_steps')
        .update({
          status: result.status === 'paused' ? 'pending' : result.status,
          finished_at: result.status !== 'paused' ? new Date().toISOString() : null,
          result: { wallet_consumed: result.wallet_consumed },
          error_message: result.error,
        })
        .eq('id', stepId);
    }

    return result;

  } catch (err) {
    if (stepId) {
      await supabase
        .from('automation_run_steps')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', stepId);
    }
    throw err;
  }
}

// ============ Action Handlers ============

async function executeSendTemplate(
  supabase: SupabaseClient,
  automation: Automation,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> },
  wallet: { id: string; balance_messages: number }
): Promise<ActionResult> {
  const templateId = action.config.template_id as string;
  const variables = action.config.variables as Record<string, string> || {};

  if (!templateId) {
    return { status: 'failed', error: 'No template_id configured' };
  }

  // Get template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError || !template) {
    return { status: 'failed', error: 'Template not found' };
  }

  if (template.approval_status !== 'approved') {
    return { status: 'failed', error: 'Template not approved' };
  }

  // Get or create conversation
  let conversationId = context.conversation_id;
  const contact = context.contact as { id: string; phone: string; tenant_id: string } | null;

  if (!conversationId && contact?.phone) {
    // Find existing conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, twilio_whatsapp_number')
      .eq('tenant_id', automation.tenant_id)
      .eq('contact_id', contact.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    conversationId = existingConv?.id;
  }

  if (!conversationId) {
    return { status: 'failed', error: 'No conversation found' };
  }

  // Get conversation details
  const { data: conversation } = await supabase
    .from('conversations')
    .select('customer_whatsapp, twilio_whatsapp_number')
    .eq('id', conversationId)
    .single();

  if (!conversation) {
    return { status: 'failed', error: 'Conversation not found' };
  }

  // Get Twilio integration
  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('account_sid, auth_token_encrypted, phone_number')
    .eq('tenant_id', automation.tenant_id)
    .eq('provider', 'twilio')
    .eq('status', 'connected')
    .single();

  if (!integration) {
    return { status: 'failed', error: 'Twilio integration not found' };
  }

  // Resolve variables from context
  const resolvedVariables: Record<string, string> = {};
  const templateVars = template.variables || [];
  
  for (const varName of templateVars) {
    if (variables[varName]) {
      resolvedVariables[varName] = resolveVariable(variables[varName], context);
    }
  }

  // Build message body
  let messageBody = template.body;
  for (const [key, val] of Object.entries(resolvedVariables)) {
    messageBody = messageBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }

  // Check wallet
  if (wallet.balance_messages < 1) {
    return { status: 'failed', error: 'Insufficient wallet balance' };
  }

  // Debit wallet
  await supabase
    .from('wallets')
    .update({ balance_messages: wallet.balance_messages - 1 })
    .eq('id', wallet.id);

  await supabase.from('wallet_transactions').insert({
    tenant_id: automation.tenant_id,
    wallet_id: wallet.id,
    type: 'debit',
    messages: 1,
    reason: 'automation_template',
    meta: { automation_id: automation.id, template_id: templateId },
  });

  // Send via Twilio
  const fromNumber = integration.phone_number || conversation.twilio_whatsapp_number;
  const authToken = integration.auth_token_encrypted;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${integration.account_sid}/Messages.json`;
  const twilioBody = new URLSearchParams();
  twilioBody.append('To', `whatsapp:${conversation.customer_whatsapp}`);
  twilioBody.append('From', `whatsapp:${fromNumber}`);
  twilioBody.append('ContentSid', template.twilio_template_sid);

  if (templateVars.length > 0) {
    const contentVariables: Record<string, string> = {};
    templateVars.forEach((varName: string, index: number) => {
      contentVariables[String(index + 1)] = resolvedVariables[varName] || '';
    });
    twilioBody.append('ContentVariables', JSON.stringify(contentVariables));
  }

  const twilioResponse = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${integration.account_sid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: twilioBody.toString(),
  });

  const twilioResult = await twilioResponse.json();

  if (!twilioResponse.ok) {
    // Revert wallet
    await supabase
      .from('wallets')
      .update({ balance_messages: wallet.balance_messages })
      .eq('id', wallet.id);

    return { status: 'failed', error: twilioResult.message || 'Twilio send failed' };
  }

  // Insert message record
  await supabase.from('messages').insert({
    tenant_id: automation.tenant_id,
    conversation_id: conversationId,
    direction: 'outbound',
    channel: 'whatsapp',
    provider: 'twilio',
    twilio_message_sid: twilioResult.sid,
    from_number: fromNumber,
    to_number: conversation.customer_whatsapp,
    body: messageBody,
    status: 'sent',
    source: 'automation',
    template_id: templateId,
  });

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      last_agent_message_at: new Date().toISOString(),
      last_message_preview: messageBody.substring(0, 120),
      last_message_direction: 'outbound',
      last_message_source: 'automation',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  console.log(`✅ Template sent: ${twilioResult.sid}`);

  return { status: 'success', wallet_consumed: 1 };
}

async function executeSendMessage(
  supabase: SupabaseClient,
  automation: Automation,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> },
  wallet: { id: string; balance_messages: number }
): Promise<ActionResult> {
  const messageText = resolveVariable(action.config.message as string || '', context);
  const conversationId = context.conversation_id;

  if (!conversationId) {
    return { status: 'failed', error: 'No conversation_id for free message' };
  }

  // Get conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('customer_whatsapp, twilio_whatsapp_number, last_customer_message_at')
    .eq('id', conversationId)
    .single();

  if (!conversation) {
    return { status: 'failed', error: 'Conversation not found' };
  }

  // Check 24h window
  const lastCustomerMsg = conversation.last_customer_message_at;
  if (lastCustomerMsg) {
    const hoursSince = (Date.now() - new Date(lastCustomerMsg).getTime()) / 3600000;
    if (hoursSince > 24) {
      return { status: 'failed', error: 'WhatsApp 24h window expired - use template instead' };
    }
  }

  // Get integration
  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('account_sid, auth_token_encrypted, phone_number')
    .eq('tenant_id', automation.tenant_id)
    .eq('provider', 'twilio')
    .eq('status', 'connected')
    .single();

  if (!integration) {
    return { status: 'failed', error: 'Twilio integration not found' };
  }

  // Check wallet
  if (wallet.balance_messages < 1) {
    return { status: 'failed', error: 'Insufficient wallet balance' };
  }

  // Debit wallet
  await supabase
    .from('wallets')
    .update({ balance_messages: wallet.balance_messages - 1 })
    .eq('id', wallet.id);

  await supabase.from('wallet_transactions').insert({
    tenant_id: automation.tenant_id,
    wallet_id: wallet.id,
    type: 'debit',
    messages: 1,
    reason: 'automation_message',
    meta: { automation_id: automation.id },
  });

  // Send via Twilio
  const fromNumber = integration.phone_number || conversation.twilio_whatsapp_number;
  const authToken = integration.auth_token_encrypted;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${integration.account_sid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.append('From', `whatsapp:${fromNumber}`);
  formData.append('To', `whatsapp:${conversation.customer_whatsapp}`);
  formData.append('Body', messageText);

  const twilioResponse = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${integration.account_sid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  const twilioResult = await twilioResponse.json();

  if (!twilioResponse.ok) {
    await supabase
      .from('wallets')
      .update({ balance_messages: wallet.balance_messages })
      .eq('id', wallet.id);

    return { status: 'failed', error: twilioResult.message || 'Twilio send failed' };
  }

  // Insert message
  await supabase.from('messages').insert({
    tenant_id: automation.tenant_id,
    conversation_id: conversationId,
    direction: 'outbound',
    channel: 'whatsapp',
    provider: 'twilio',
    twilio_message_sid: twilioResult.sid,
    from_number: fromNumber,
    to_number: conversation.customer_whatsapp,
    body: messageText,
    status: 'sent',
    source: 'automation',
  });

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      last_agent_message_at: new Date().toISOString(),
      last_message_preview: messageText.substring(0, 120),
      last_message_direction: 'outbound',
      last_message_source: 'automation',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  return { status: 'success', wallet_consumed: 1 };
}

async function executeUpdateField(
  supabase: SupabaseClient,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const contact = context.contact as { id: string } | null;
  if (!contact) {
    return { status: 'failed', error: 'No contact in context' };
  }

  const fieldKey = action.config.field_key as string;
  const fieldValue = resolveVariable(action.config.field_value as string || '', context);
  const operation = action.config.operation as string || 'set';

  if (!fieldKey) {
    return { status: 'failed', error: 'No field_key configured' };
  }

  // Check if it's a core field or custom field
  const coreFields = ['name', 'email', 'phone', 'country', 'status', 'notes'];
  
  if (coreFields.includes(fieldKey)) {
    // Update core field
    await supabase
      .from('contacts')
      .update({ [fieldKey]: operation === 'clear' ? null : fieldValue })
      .eq('id', contact.id);
  } else {
    // Custom field - find field definition
    const { data: fieldDef } = await supabase
      .from('contact_custom_fields')
      .select('id')
      .eq('key', fieldKey)
      .maybeSingle();

    if (!fieldDef) {
      return { status: 'failed', error: `Custom field ${fieldKey} not found` };
    }

    if (operation === 'clear') {
      await supabase
        .from('contact_custom_field_values')
        .delete()
        .eq('contact_id', contact.id)
        .eq('field_id', fieldDef.id);
    } else {
      await supabase
        .from('contact_custom_field_values')
        .upsert({
          contact_id: contact.id,
          field_id: fieldDef.id,
          value_text: fieldValue,
        }, { onConflict: 'contact_id,field_id' });
    }
  }

  return { status: 'success' };
}

async function executeAddTag(
  supabase: SupabaseClient,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const contact = context.contact as { id: string; tags?: string[] } | null;
  if (!contact) {
    return { status: 'failed', error: 'No contact in context' };
  }

  const newTag = action.config.tag as string;
  if (!newTag) {
    return { status: 'failed', error: 'No tag configured' };
  }

  const currentTags = contact.tags || [];
  if (!currentTags.includes(newTag)) {
    await supabase
      .from('contacts')
      .update({ tags: [...currentTags, newTag] })
      .eq('id', contact.id);
  }

  return { status: 'success' };
}

async function executeRemoveTag(
  supabase: SupabaseClient,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const contact = context.contact as { id: string; tags?: string[] } | null;
  if (!contact) {
    return { status: 'failed', error: 'No contact in context' };
  }

  const tagToRemove = action.config.tag as string;
  if (!tagToRemove) {
    return { status: 'failed', error: 'No tag configured' };
  }

  const currentTags = contact.tags || [];
  const newTags = currentTags.filter(t => t !== tagToRemove);

  await supabase
    .from('contacts')
    .update({ tags: newTags })
    .eq('id', contact.id);

  return { status: 'success' };
}

async function executeCreateNote(
  supabase: SupabaseClient,
  automation: Automation,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const contact = context.contact as { id: string; notes?: string } | null;
  if (!contact) {
    return { status: 'failed', error: 'No contact in context' };
  }

  const note = resolveVariable(action.config.note as string || '', context);
  const timestamp = new Date().toLocaleString('es-MX');
  const newNote = `[${timestamp}] [Automatización: ${automation.name}] ${note}`;

  const currentNotes = contact.notes || '';
  const updatedNotes = currentNotes ? `${currentNotes}\n\n${newNote}` : newNote;

  await supabase
    .from('contacts')
    .update({ notes: updatedNotes })
    .eq('id', contact.id);

  return { status: 'success' };
}

async function executeUpdateEventStatus(
  supabase: SupabaseClient,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const event = context.event as { id: string } | null;
  if (!event) {
    return { status: 'failed', error: 'No event in context' };
  }

  const newStatus = action.config.status as string;
  if (!newStatus) {
    return { status: 'failed', error: 'No status configured' };
  }

  await supabase
    .from('events')
    .update({ status: newStatus })
    .eq('id', event.id);

  return { status: 'success' };
}

async function executePauseAI(
  supabase: SupabaseClient,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  if (!context.conversation_id) {
    return { status: 'failed', error: 'No conversation_id' };
  }

  await supabase
    .from('conversations')
    .update({
      ai_enabled: false,
      ai_paused_at: new Date().toISOString(),
      ai_pause_reason: 'automation',
    })
    .eq('id', context.conversation_id);

  return { status: 'success' };
}

async function executeEnableAI(
  supabase: SupabaseClient,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  if (!context.conversation_id) {
    return { status: 'failed', error: 'No conversation_id' };
  }

  await supabase
    .from('conversations')
    .update({
      ai_enabled: true,
      ai_paused_at: null,
      ai_pause_reason: null,
    })
    .eq('id', context.conversation_id);

  return { status: 'success' };
}

async function executeEscalate(
  supabase: SupabaseClient,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  if (!context.conversation_id) {
    return { status: 'failed', error: 'No conversation_id' };
  }

  await supabase
    .from('conversations')
    .update({
      needs_human: true,
      ai_enabled: false,
      ai_paused_at: new Date().toISOString(),
      ai_pause_reason: 'escalated_by_automation',
    })
    .eq('id', context.conversation_id);

  return { status: 'success' };
}

async function executeDelay(action: AutomationAction): Promise<ActionResult> {
  const waitMode = action.config.wait_mode as string || 'fixed_time';
  
  if (waitMode === 'fixed_time') {
    const delayMinutes = action.config.delay_minutes as number || 0;
    const delayHours = action.config.delay_hours as number || 0;
    const totalMs = (delayMinutes * 60000) + (delayHours * 3600000);
    
    if (totalMs > 0) {
      const resumeAt = new Date(Date.now() + totalMs).toISOString();
      return { status: 'paused', resume_at: resumeAt };
    }
  }

  if (waitMode === 'until_event') {
    // For until_event, we pause and let the resume worker handle it
    const waitFor = action.config.wait_for as string;
    const timeoutHours = action.config.timeout_hours as number || 24;
    const resumeAt = new Date(Date.now() + timeoutHours * 3600000).toISOString();
    
    // Store wait_for in metadata for resume logic
    return { status: 'paused', resume_at: resumeAt };
  }

  return { status: 'success' };
}

async function executeSendWebhook(
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const url = action.config.url as string;
  const method = (action.config.method as string || 'POST').toUpperCase();
  const headers = action.config.headers as Record<string, string> || {};

  if (!url) {
    return { status: 'failed', error: 'No webhook URL configured' };
  }

  try {
    const payload = {
      contact: context.contact,
      event: context.event,
      conversation_id: context.conversation_id,
      trigger_data: context.trigger_data,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { status: 'failed', error: `Webhook returned ${response.status}` };
    }

    return { status: 'success' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Webhook failed' };
  }
}

async function executeCreateFollowup(
  supabase: SupabaseClient,
  automation: Automation,
  action: AutomationAction,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): Promise<ActionResult> {
  const contact = context.contact as { id: string } | null;
  if (!contact || !context.conversation_id) {
    return { status: 'failed', error: 'No contact or conversation in context' };
  }

  const delayDays = action.config.delay_days as number || 1;
  const note = resolveVariable(action.config.note as string || '', context);

  const dueAt = new Date(Date.now() + delayDays * 86400000).toISOString();

  await supabase.from('conversation_followups').insert({
    tenant_id: automation.tenant_id,
    contact_id: contact.id,
    conversation_id: context.conversation_id,
    due_at: dueAt,
    note: note || `Seguimiento automático: ${automation.name}`,
    status: 'pending',
  });

  return { status: 'success' };
}

// ============ Resume Handler ============

interface ResumePayload {
  run_id: string;
  contact_id: string;
  conversation_id?: string;
  start_from_step: number;
  trigger_data?: Record<string, unknown>;
}

async function handleResumeEvent(
  supabase: SupabaseClient,
  payload: EventPayload
): Promise<{ status: string; error?: string }> {
  const resumePayload = payload as unknown as ResumePayload;
  const runId = resumePayload.run_id;
  const startFromStep = resumePayload.start_from_step || 0;

  console.log(`▶️ Resuming automation run ${runId} from step ${startFromStep}`);

  // Get the run
  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .select('*, automation:automations(*)')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    console.error('❌ Run not found:', runError);
    return { status: 'failed', error: 'Run not found' };
  }

  const automation = run.automation as Automation;
  if (!automation) {
    return { status: 'failed', error: 'Automation not found' };
  }

  // Check if automation is still active
  if (automation.status !== 'active') {
    await supabase
      .from('automation_runs')
      .update({ status: 'failed', error_message: 'Automation disabled', finished_at: new Date().toISOString() })
      .eq('id', runId);
    return { status: 'failed', error: 'Automation no longer active' };
  }

  // Get contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', run.contact_id)
    .single();

  // Get wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance_messages')
    .eq('tenant_id', automation.tenant_id)
    .single();

  if (!wallet || wallet.balance_messages < 1) {
    await supabase
      .from('automation_runs')
      .update({ status: 'blocked_wallet', finished_at: new Date().toISOString() })
      .eq('id', runId);
    return { status: 'blocked_wallet', error: 'Insufficient wallet balance' };
  }

  // Build context
  const context = {
    contact,
    event: null,
    conversation_id: run.conversation_id,
    trigger_data: resumePayload.trigger_data || {},
  };

  // Execute remaining actions
  const actions = automation.actions || [];
  let walletConsumed = run.wallet_consumed || 0;
  let success = true;
  let errorMessage: string | null = null;

  for (let i = startFromStep; i < actions.length; i++) {
    const action = actions[i];
    
    try {
      const stepResult = await executeAction(supabase, automation, runId, action, i, context, wallet);
      
      if (stepResult.wallet_consumed) {
        walletConsumed += stepResult.wallet_consumed;
      }

      if (stepResult.status === 'failed') {
        success = false;
        errorMessage = stepResult.error || 'Action failed';
        break;
      }

      // Handle another delay
      if (stepResult.status === 'paused') {
        await supabase
          .from('automation_runs')
          .update({
            status: 'paused',
            wallet_consumed: walletConsumed,
            resume_at: stepResult.resume_at,
            metadata: { 
              paused_at_step: i,
              resume_at: stepResult.resume_at,
              trigger_data: resumePayload.trigger_data 
            },
          })
          .eq('id', runId);

        return { status: 'paused' };
      }

    } catch (err) {
      console.error(`❌ Action ${action.type} failed:`, err);
      success = false;
      errorMessage = err instanceof Error ? err.message : 'Unknown action error';
      break;
    }
  }

  // Update final status
  const finalStatus = success ? 'success' : 'failed';
  await supabase
    .from('automation_runs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      wallet_consumed: walletConsumed,
      error_message: errorMessage,
    })
    .eq('id', runId);

  console.log(`✅ Resumed run ${runId} completed with status: ${finalStatus}`);
  return { status: finalStatus };
}

// ============ Variable Resolution ============

function resolveVariable(
  template: string,
  context: { contact: unknown; event: unknown; conversation_id?: string; trigger_data: Record<string, unknown> }
): string {
  if (!template) return '';

  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getValueFromContext(path, context);
    return value !== null && value !== undefined ? String(value) : match;
  });
}
