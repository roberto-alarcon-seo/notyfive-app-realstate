import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * assignment-timeout-monitor
 *
 * Cron job (every 5 minutes) that flags conversations as "at risk" when an
 * assigned agent has not responded within the tenant's configured timeout
 * window. Depending on the rule's `timeout_action`, may also trigger a
 * reassignment to a different agent and/or notify managers.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.rpc('fn_check_assignment_timeouts');
    if (error) throw error;

    console.log('[timeout-monitor]', JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[timeout-monitor] error', err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});