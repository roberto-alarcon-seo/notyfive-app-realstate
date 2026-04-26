import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type UpsertTenantBody = {
  action: 'upsert_tenant';
  external_id: string;
  name: string;
  plan?: string;
};

type RequestBody = UpsertTenantBody;

const VALID_PLANS = ['trial', 'starter', 'growth', 'pro', 'scale', 'enterprise'];

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Validate API key against EXTERNAL_CORE_API_KEY secret BEFORE touching DB.
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('EXTERNAL_CORE_API_KEY');

    if (!expectedKey) {
      console.error('sync-external-core: EXTERNAL_CORE_API_KEY secret is not configured');
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    if (!apiKey || apiKey !== expectedKey) {
      console.warn('sync-external-core: unauthorized request', {
        hasHeader: Boolean(apiKey),
      });
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Initialize Supabase client (service role) only after auth passes.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Best-effort audit: keep internal_system_auth.last_used_at fresh for the "core" service.
    // Non-blocking; ignore errors.
    try {
      const apiKeyHash = await hashApiKey(apiKey);
      supabase
        .from('internal_system_auth')
        .upsert(
          {
            service_name: 'core',
            api_key_hash: apiKeyHash,
            description: 'External Core system (validated via EXTERNAL_CORE_API_KEY secret)',
            is_active: true,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: 'service_name' },
        )
        .then(() => {});
    } catch (auditErr) {
      console.warn('sync-external-core: audit upsert failed', auditErr);
    }

    const serviceName = 'core';

    // 3. Parse body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || typeof body !== 'object' || !('action' in body)) {
      return jsonResponse({ error: 'Missing action' }, 400);
    }

    // 4. Route by action
    if (body.action === 'upsert_tenant') {
      return await handleUpsertTenant(supabase, body, serviceName);
    }

    return jsonResponse({ error: `Unknown action: ${(body as any).action}` }, 400);
  } catch (err) {
    console.error('sync-external-core: unexpected error', err);
    return jsonResponse({ error: 'Internal server error', details: String(err) }, 500);
  }
});

async function handleUpsertTenant(
  supabase: SupabaseClient,
  body: UpsertTenantBody,
  serviceName: string,
): Promise<Response> {
  const { external_id, name, plan } = body;

  // Validate input
  if (!external_id || typeof external_id !== 'string' || external_id.trim().length === 0) {
    return jsonResponse({ error: 'external_id is required (non-empty string)' }, 400);
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return jsonResponse({ error: 'name is required (min 2 chars)' }, 400);
  }
  const resolvedPlan = (plan ?? 'trial').toLowerCase();
  if (!VALID_PLANS.includes(resolvedPlan)) {
    return jsonResponse(
      { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
      400,
    );
  }

  // Check if tenant exists
  const { data: existing, error: fetchError } = await supabase
    .from('tenants')
    .select('id, name, plan, managed_externally, external_id')
    .eq('external_id', external_id.trim())
    .maybeSingle();

  if (fetchError) {
    console.error('sync-external-core: fetch tenant error', fetchError);
    return jsonResponse({ error: 'Database error', details: fetchError.message }, 500);
  }

  if (existing) {
    // UPDATE existing tenant
    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update({
        name: name.trim(),
        plan: resolvedPlan,
        managed_externally: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, name, plan, external_id, managed_externally, billing_state, message_credits')
      .single();

    if (updateError) {
      console.error('sync-external-core: update error', updateError);
      return jsonResponse({ error: 'Failed to update tenant', details: updateError.message }, 500);
    }

    return jsonResponse({
      success: true,
      operation: 'updated',
      tenant: updated,
      service: serviceName,
    });
  }

  // CREATE new tenant
  const { data: created, error: createError } = await supabase
    .from('tenants')
    .insert({
      name: name.trim(),
      plan: resolvedPlan,
      external_id: external_id.trim(),
      managed_externally: true,
      // Externally managed tenants do NOT trigger Stripe flows.
      // Initialize wallet with 0 credits; the Core system controls top-ups.
      billing_state: 'CREDITS_EXHAUSTED',
      message_credits: 0,
      monthly_credits_remaining: 0,
      accumulated_credits: 0,
      extra_credits: 0,
      initial_credits_granted: false,
    })
    .select('id, name, plan, external_id, managed_externally, billing_state, message_credits')
    .single();

  if (createError) {
    console.error('sync-external-core: create error', createError);
    return jsonResponse({ error: 'Failed to create tenant', details: createError.message }, 500);
  }

  // The `create_wallet_for_tenant` trigger automatically creates a wallet row with 0 balance.
  // Ensure it's explicitly set to 0/blocked to be safe (in case trigger is missing).
  await supabase
    .from('wallets')
    .upsert(
      {
        tenant_id: created.id,
        balance_messages: 0,
        balance_monthly: 0,
        balance_rollover: 0,
        status: 'blocked',
      },
      { onConflict: 'tenant_id' },
    );

  return jsonResponse({
    success: true,
    operation: 'created',
    tenant: created,
    service: serviceName,
  });
}