import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-trigger',
};

/**
 * seed-tenant-templates
 *
 * Idempotently copies all rows from `master_templates` into `templates` for
 * the given tenant. Marks copies with `is_system = true` and
 * `created_source = 'manual'`. If the tenant has a connected Twilio
 * integration, fires `submit-template-for-approval` per seeded row.
 *
 * Invocation: typically triggered by the `tenant_integrations` AFTER UPDATE
 * trigger when status flips to 'connected'. May also be called manually with
 * a service-role key for backfills.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId: string | undefined = body?.tenant_id;

    if (!tenantId || typeof tenantId !== 'string') {
      return new Response(
        JSON.stringify({ code: 'INVALID_INPUT', message: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1) Idempotency: if tenant already has system templates, do nothing
    const { count: existingSystemCount, error: countErr } = await supabase
      .from('templates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_system', true);

    if (countErr) throw countErr;
    if ((existingSystemCount ?? 0) > 0) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'already_seeded', tenant_id: tenantId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2) Load master catalog
    const { data: masters, error: masterErr } = await supabase
      .from('master_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (masterErr) throw masterErr;
    if (!masters || masters.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, seeded: 0, reason: 'no_master_templates' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3) Build inserts. Avoid name collisions by suffixing the master name.
    const inserts = masters.map((m) => ({
      tenant_id: tenantId,
      name: m.name, // keep canonical system name (unique scoping is per-tenant)
      display_name: m.display_name ?? m.name,
      category: m.category ?? 'utility',
      label: m.label ?? null,
      header_type: m.header_type ?? 'none',
      header_text: m.header_text,
      body: m.body,
      footer: m.footer,
      buttons: m.buttons ?? [],
      variables: m.variables ?? [],
      approval_status: 'draft',
      created_source: 'manual' as const,
      created_by_module: 'system_seed',
      is_system: true,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('templates')
      .insert(inserts)
      .select('id, name');

    if (insertErr) throw insertErr;

    // 4) If tenant has a connected Twilio integration, submit each for approval (best-effort)
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('status, account_sid, auth_token_encrypted')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .maybeSingle();

    let submittedCount = 0;
    if (
      integration &&
      String(integration.status) === 'connected' &&
      integration.account_sid &&
      integration.auth_token_encrypted
    ) {
      for (const tpl of inserted ?? []) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/submit-template-for-approval`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Internal service-to-service call: use service role so the function
              // can resolve the tenant without an end-user JWT.
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'x-internal-call': 'seed-tenant-templates',
              'x-tenant-id': tenantId,
            },
            body: JSON.stringify({ template_id: tpl.id, tenant_id: tenantId }),
          });
          if (res.ok) submittedCount += 1;
        } catch (_) {
          // Best-effort: never fail the whole seed because of one Twilio error
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        seeded: inserted?.length ?? 0,
        submitted_to_twilio: submittedCount,
        tenant_id: tenantId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ code: 'INTERNAL_ERROR', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});