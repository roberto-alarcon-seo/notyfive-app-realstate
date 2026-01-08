import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * automation-scheduler
 * 
 * Cron job that runs every minute to:
 * 1. Process pending events from system_event_bus
 * 2. Detect upcoming events (event.upcoming trigger)
 * 3. Detect expiring conversation windows (window_expiring trigger)
 * 4. Evaluate scheduled automations
 * 5. Resume paused automation runs
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results = {
    pending_events: 0,
    upcoming_events: 0,
    expiring_windows: 0,
    scheduled_runs: 0,
    resumed_runs: 0,
    errors: [] as string[],
  };

  console.log('🕐 Automation scheduler started');

  try {
    // ========== 1. Process Pending Events ==========
    const { data: pendingEvents, error: pendingError } = await supabase
      .from('system_event_bus')
      .select('id, event_name, tenant_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (pendingError) {
      console.error('❌ Error fetching pending events:', pendingError);
      results.errors.push('Failed to fetch pending events');
    } else if (pendingEvents && pendingEvents.length > 0) {
      console.log(`📋 Processing ${pendingEvents.length} pending events`);
      
      for (const event of pendingEvents) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/automation-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ event_id: event.id }),
          });

          if (response.ok) {
            results.pending_events++;
            console.log(`✅ Processed event ${event.id} (${event.event_name})`);
          } else {
            const error = await response.text();
            console.error(`❌ Failed to process event ${event.id}:`, error);
            results.errors.push(`Event ${event.id} failed: ${error}`);
          }
        } catch (err) {
          console.error(`❌ Error calling worker for event ${event.id}:`, err);
          results.errors.push(`Event ${event.id} error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }
    }

    // ========== 2. Detect Upcoming Events ==========
    const upcomingResult = await detectUpcomingEvents(supabase);
    results.upcoming_events = upcomingResult.created;
    if (upcomingResult.error) results.errors.push(upcomingResult.error);

    // ========== 3. Detect Expiring Windows ==========
    const expiringResult = await detectExpiringWindows(supabase);
    results.expiring_windows = expiringResult.created;
    if (expiringResult.error) results.errors.push(expiringResult.error);

    // ========== 4. Evaluate Scheduled Automations ==========
    const scheduledResult = await evaluateScheduledAutomations(supabase);
    results.scheduled_runs = scheduledResult.triggered;
    if (scheduledResult.error) results.errors.push(scheduledResult.error);

    // ========== 5. Resume Paused Runs ==========
    const resumeResult = await resumePausedRuns(supabase, supabaseUrl, supabaseServiceKey);
    results.resumed_runs = resumeResult.resumed;
    if (resumeResult.error) results.errors.push(resumeResult.error);

    console.log('✅ Automation scheduler completed:', results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Scheduler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== Helper Functions ==========

/**
 * Detect events starting within the configured "upcoming" window
 * Creates event.upcoming events in system_event_bus
 */
async function detectUpcomingEvents(supabase: SupabaseClient): Promise<{ created: number; error?: string }> {
  try {
    // Get all active automations with event.upcoming trigger
    const { data: automations, error: autoError } = await supabase
      .from('automations')
      .select('id, tenant_id, trigger_config')
      .eq('status', 'active')
      .eq('trigger_type', 'event.upcoming');

    if (autoError || !automations || automations.length === 0) {
      return { created: 0 };
    }

    let created = 0;

    for (const automation of automations) {
      const config = automation.trigger_config as { minutes_before?: number; event_types?: string[] } || {};
      const minutesBefore = config.minutes_before || 60;
      const eventTypes = config.event_types || [];

      // Calculate the target window: events starting between now+minutesBefore-1 and now+minutesBefore
      const windowStart = new Date(Date.now() + (minutesBefore - 1) * 60 * 1000);
      const windowEnd = new Date(Date.now() + minutesBefore * 60 * 1000);

      // Find events in this window that haven't been processed
      let query = supabase
        .from('events')
        .select('id, contact_id, event_type, title, start_at')
        .eq('tenant_id', automation.tenant_id)
        .eq('status', 'confirmed')
        .gte('start_at', windowStart.toISOString())
        .lt('start_at', windowEnd.toISOString());

      if (eventTypes.length > 0) {
        query = query.in('event_type', eventTypes);
      }

      const { data: upcomingEvents, error: eventsError } = await query;

      if (eventsError || !upcomingEvents) continue;

      for (const event of upcomingEvents) {
        // Check if we already emitted this event
        const idempotencyKey = `upcoming:${automation.id}:${event.id}`;
        
        const { data: existing } = await supabase
          .from('system_event_bus')
          .select('id')
          .eq('entity_id', event.id)
          .eq('event_name', 'event.upcoming')
          .eq('tenant_id', automation.tenant_id)
          .maybeSingle();

        if (existing) continue;

        // Emit the event
        const { error: insertError } = await supabase
          .from('system_event_bus')
          .insert({
            tenant_id: automation.tenant_id,
            event_name: 'event.upcoming',
            entity_type: 'event',
            entity_id: event.id,
            payload: {
              contact_id: event.contact_id,
              event_id: event.id,
              event_type: event.event_type,
              event_title: event.title,
              start_at: event.start_at,
              minutes_before: minutesBefore,
            },
            status: 'pending',
          });

        if (!insertError) {
          created++;
          console.log(`📅 Created event.upcoming for event ${event.id}`);
        }
      }
    }

    return { created };
  } catch (err) {
    console.error('❌ Error detecting upcoming events:', err);
    return { created: 0, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

/**
 * Detect conversations where the 24h window is about to expire
 * Creates window_expiring events in system_event_bus
 */
async function detectExpiringWindows(supabase: SupabaseClient): Promise<{ created: number; error?: string }> {
  try {
    // Get all active automations with window_expiring trigger
    const { data: automations, error: autoError } = await supabase
      .from('automations')
      .select('id, tenant_id, trigger_config')
      .eq('status', 'active')
      .eq('trigger_type', 'window_expiring');

    if (autoError || !automations || automations.length === 0) {
      return { created: 0 };
    }

    let created = 0;

    for (const automation of automations) {
      const config = automation.trigger_config as { hours_before_expiry?: number } || {};
      const hoursBefore = config.hours_before_expiry || 1;

      // Find conversations where window expires in the next hour
      // Window = 24h from last_customer_message_at
      // We want: 24h - hoursBefore <= time_since_last <= 24h - hoursBefore + 1 minute
      const expiryWindow = 24 - hoursBefore;
      const windowStart = new Date(Date.now() - (expiryWindow * 60 + 1) * 60 * 1000);
      const windowEnd = new Date(Date.now() - expiryWindow * 60 * 60 * 1000);

      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, contact_id, last_customer_message_at')
        .eq('tenant_id', automation.tenant_id)
        .eq('status', 'open')
        .gte('last_customer_message_at', windowStart.toISOString())
        .lt('last_customer_message_at', windowEnd.toISOString());

      if (convError || !conversations) continue;

      for (const conv of conversations) {
        // Check if already emitted
        const { data: existing } = await supabase
          .from('system_event_bus')
          .select('id')
          .eq('entity_id', conv.id)
          .eq('event_name', 'window_expiring')
          .eq('tenant_id', automation.tenant_id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existing) continue;

        // Calculate exact expiry time
        const expiresAt = new Date(new Date(conv.last_customer_message_at).getTime() + 24 * 60 * 60 * 1000);

        const { error: insertError } = await supabase
          .from('system_event_bus')
          .insert({
            tenant_id: automation.tenant_id,
            event_name: 'window_expiring',
            entity_type: 'conversation',
            entity_id: conv.id,
            payload: {
              contact_id: conv.contact_id,
              conversation_id: conv.id,
              expires_at: expiresAt.toISOString(),
              hours_remaining: hoursBefore,
            },
            status: 'pending',
          });

        if (!insertError) {
          created++;
          console.log(`⏰ Created window_expiring for conversation ${conv.id}`);
        }
      }
    }

    return { created };
  } catch (err) {
    console.error('❌ Error detecting expiring windows:', err);
    return { created: 0, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

/**
 * Evaluate scheduled automations based on cron expressions
 * Creates scheduled events in system_event_bus
 */
async function evaluateScheduledAutomations(supabase: SupabaseClient): Promise<{ triggered: number; error?: string }> {
  try {
    // Get all active scheduled automations
    const { data: automations, error: autoError } = await supabase
      .from('automations')
      .select('id, tenant_id, schedule, trigger_config')
      .eq('status', 'active')
      .eq('trigger_type', 'scheduled');

    if (autoError || !automations || automations.length === 0) {
      return { triggered: 0 };
    }

    let triggered = 0;
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentDayOfWeek = now.getDay();

    for (const automation of automations) {
      const schedule = automation.schedule as { 
        minute?: string; 
        hour?: string; 
        day_of_month?: string; 
        month?: string; 
        day_of_week?: string; 
      } || {};

      // Check if current time matches the schedule
      const matchesMinute = matchesCronField(schedule.minute || '*', currentMinute);
      const matchesHour = matchesCronField(schedule.hour || '*', currentHour);
      const matchesDay = matchesCronField(schedule.day_of_month || '*', currentDay);
      const matchesMonth = matchesCronField(schedule.month || '*', currentMonth);
      const matchesDayOfWeek = matchesCronField(schedule.day_of_week || '*', currentDayOfWeek);

      if (!matchesMinute || !matchesHour || !matchesDay || !matchesMonth || !matchesDayOfWeek) {
        continue;
      }

      // Check idempotency for this minute
      const idempotencyKey = `${now.toISOString().slice(0, 16)}:${automation.id}`;
      
      const { data: existing } = await supabase
        .from('system_event_bus')
        .select('id')
        .eq('entity_id', automation.id)
        .eq('event_name', 'scheduled')
        .eq('tenant_id', automation.tenant_id)
        .gte('created_at', new Date(now.getTime() - 60000).toISOString())
        .maybeSingle();

      if (existing) continue;

      // Get target audience from trigger_config
      const config = automation.trigger_config as { segment_id?: string; all_contacts?: boolean } || {};
      
      let contacts: { id: string }[] = [];
      
      if (config.segment_id) {
        // Get contacts from segment
        const { data: segmentContacts } = await supabase
          .from('segment_contacts')
          .select('contact_id')
          .eq('segment_id', config.segment_id);
        
        contacts = (segmentContacts || []).map((sc: { contact_id: string }) => ({ id: sc.contact_id }));
      } else if (config.all_contacts) {
        // Get all active contacts
        const { data: allContacts } = await supabase
          .from('contacts')
          .select('id')
          .eq('tenant_id', automation.tenant_id)
          .eq('status', 'active')
          .limit(1000);
        
        contacts = allContacts || [];
      }

      // Create an event for each contact
      for (const contact of contacts) {
        const { error: insertError } = await supabase
          .from('system_event_bus')
          .insert({
            tenant_id: automation.tenant_id,
            event_name: 'scheduled',
            entity_type: 'automation',
            entity_id: automation.id,
            payload: {
              contact_id: contact.id,
              scheduled_at: now.toISOString(),
            },
            status: 'pending',
          });

        if (!insertError) {
          triggered++;
        }
      }

      if (contacts.length > 0) {
        console.log(`📆 Triggered scheduled automation ${automation.id} for ${contacts.length} contacts`);
      }
    }

    return { triggered };
  } catch (err) {
    console.error('❌ Error evaluating scheduled automations:', err);
    return { triggered: 0, error: err instanceof Error ? err.message : 'Unknown' };
  }
}

/**
 * Match a cron field value against current value
 */
function matchesCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  
  // Handle comma-separated values
  if (field.includes(',')) {
    return field.split(',').some(f => matchesCronField(f.trim(), value));
  }
  
  // Handle ranges
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }
  
  // Handle step values
  if (field.includes('/')) {
    const [, step] = field.split('/').map(Number);
    return value % step === 0;
  }
  
  // Direct match
  return Number(field) === value;
}

/**
 * Resume paused automation runs where resume_at has passed
 */
async function resumePausedRuns(
  supabase: SupabaseClient,
  supabaseUrl: string,
  _serviceKey: string
): Promise<{ resumed: number; error?: string }> {
  try {
    // Find paused runs that should be resumed
    const { data: pausedRuns, error: pausedError } = await supabase
      .from('automation_runs')
      .select('id, automation_id, contact_id, conversation_id, tenant_id, metadata')
      .eq('status', 'paused')
      .limit(50);

    if (pausedError || !pausedRuns || pausedRuns.length === 0) {
      return { resumed: 0 };
    }

    let resumed = 0;

    for (const run of pausedRuns) {
      const metadata = run.metadata as { resume_at?: string; paused_at_step?: number; trigger_data?: unknown } || {};
      
      if (!metadata.resume_at) continue;
      
      const resumeAt = new Date(metadata.resume_at);
      if (resumeAt > new Date()) continue; // Not yet time to resume

      console.log(`▶️ Resuming run ${run.id} (paused at step ${metadata.paused_at_step})`);

      // Get the automation
      const { data: automation, error: autoError } = await supabase
        .from('automations')
        .select('*')
        .eq('id', run.automation_id)
        .single();

      if (autoError || !automation) {
        console.error(`❌ Automation ${run.automation_id} not found for run ${run.id}`);
        continue;
      }

      // Mark as running
      await supabase
        .from('automation_runs')
        .update({ status: 'running' })
        .eq('id', run.id);

      // Get remaining actions
      const actions = (automation.actions as { id: string; type: string; config: Record<string, unknown> }[]) || [];
      const startFromStep = (metadata.paused_at_step || 0) + 1;

      if (startFromStep >= actions.length) {
        // No more actions
        await supabase
          .from('automation_runs')
          .update({ 
            status: 'success', 
            finished_at: new Date().toISOString() 
          })
          .eq('id', run.id);
        resumed++;
        continue;
      }

      // Create a synthetic event to continue execution
      const { error: eventError } = await supabase
        .from('system_event_bus')
        .insert({
          tenant_id: run.tenant_id,
          event_name: 'automation.resume',
          entity_type: 'automation_run',
          entity_id: run.id,
          payload: {
            contact_id: run.contact_id,
            conversation_id: run.conversation_id,
            run_id: run.id,
            start_from_step: startFromStep,
            trigger_data: metadata.trigger_data,
          },
          status: 'pending',
        });

      if (!eventError) {
        resumed++;
      }
    }

    return { resumed };
  } catch (err) {
    console.error('❌ Error resuming paused runs:', err);
    return { resumed: 0, error: err instanceof Error ? err.message : 'Unknown' };
  }
}
