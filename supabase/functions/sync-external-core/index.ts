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
  owner_email?: string;
  owner_name?: string;
  max_users?: number;
  country_code?: string;
  // REQUIRED partner association. Forms a composite key (partner_id + external_id).
  // Must match the API key's partner when key is partner-scoped.
  partner_id: string;
};

type SyncUserBody = {
  action: 'sync_user';
  tenant_external_id: string;
  email: string;
  name?: string;
  tenant_role?: string;
  status?: string; // 'active' | 'inactive' | 'suspended'
  // REQUIRED — tenants are looked up by (partner_id, external_id).
  partner_id: string;
};

type SyncPropertyBody = {
  action: 'sync_property';
  tenant_external_id: string;
  property_code: string;
  title?: string;
  zone?: string;
  address?: string | null;
  operation_type?: string;
  property_type?: string | null;
  price?: number;
  currency?: string;
  status?: string;
  is_active?: boolean;
  ai_description_template?: string | null;
  // REQUIRED — tenants are looked up by (partner_id, external_id).
  partner_id: string;
  // metadata bag with technical fields & accepted credits
  metadata?: {
    bedrooms?: number | null;
    bathrooms?: number | null;
    parking_spots?: number | null;
    sq_meters?: number | null;
    maintenance_fee?: number | null;
    accepted_credits?: string[] | null;
    visit_availability?: string | null;
    youtube_url?: string | null;
    images?: string[] | null;
    documents?: Array<{ url: string; name?: string; type?: string }> | null;
    faqs?: Array<{ question: string; answer: string }> | null;
    [key: string]: unknown;
  };
  // Multimedia & FAQ payloads (Core-managed). When provided, they fully
  // replace the existing 'core' entries for this property; manual entries
  // created locally remain untouched.
  youtube_url?: string | null;
  images?: string[];
  documents?: Array<{ url: string; name?: string; type?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
};

type UpdateBillingBody = {
  action: 'update_billing';
  tenant_external_id: string;
  billing_state?: string;
  plan?: string;
  message_credits?: number;
  reason?: string;
  // Optional identifier of the movement in the Core system. Stored in the
  // wallet_ledger metadata so financial movements can be reconciled
  // end-to-end with the Core billing system.
  external_id?: string | null;
  // Optional description override. When omitted we generate a sensible
  // default like "Recarga automática vía API Core - Plan Premium MX".
  description?: string | null;
  // REQUIRED — tenants are looked up by (partner_id, external_id).
  partner_id: string;
};

type RequestBody =
  | UpsertTenantBody
  | SyncUserBody
  | SyncPropertyBody
  | UpdateBillingBody;

// Plans known to the local app (used only for legacy reference / UI hints).
// The `tenants.plan` column is now free-form TEXT, so the external Core can
// send region- or customer-specific plan names. We only enforce minimal
// shape/safety constraints on incoming plan strings — see `normalizePlan`.
const KNOWN_PLANS = ['trial', 'starter', 'growth', 'pro', 'scale', 'enterprise'];

/**
 * Normalize and validate a plan string sent by the external Core.
 * Returns the normalized value, or an error string describing why it is
 * invalid. We accept any non-empty string up to 64 chars that contains
 * only letters, digits, underscores, dashes, dots and spaces. This covers
 * regional plan names like "premium_mx", "core-co-basic" or "Plan Pro 2".
 */
function normalizePlan(input: unknown): { value: string } | { error: string } {
  if (typeof input !== 'string') {
    return { error: 'plan must be a string' };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { error: 'plan must be a non-empty string' };
  }
  if (trimmed.length > 64) {
    return { error: 'plan must be 64 characters or fewer' };
  }
  if (!/^[A-Za-z0-9 _.\-]+$/.test(trimmed)) {
    return {
      error:
        'plan may only contain letters, digits, spaces, underscores, dashes and dots',
    };
  }
  // Lowercase known plans for consistency with prior behavior; preserve
  // casing/format for custom regional plans so the UI shows them as-sent.
  const lower = trimmed.toLowerCase();
  if (KNOWN_PLANS.includes(lower)) {
    return { value: lower };
  }
  return { value: trimmed };
}
const VALID_TENANT_ROLES = ['owner', 'administrador', 'manager', 'marketer', 'asesor'];
const ADMIN_TENANT_ROLES = ['owner', 'administrador'];
const VALID_USER_STATUSES = ['active', 'inactive', 'suspended'];
const VALID_OPERATION_TYPES = ['sale', 'rent'];
const VALID_PROPERTY_STATUSES = ['available', 'reserved', 'sold', 'rented', 'inactive'];
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const VALID_BILLING_STATES = [
  'ONBOARDING_PAID',
  'ACTIVE_WITH_CREDITS',
  'CREDITS_EXHAUSTED',
  'SUBSCRIPTION_REQUIRED',
  'SUBSCRIBED_ACTIVE',
  'SUSPENDED',
];

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Extract x-api-key header. Empty/missing keys are rejected before any DB work.
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || apiKey.trim().length === 0) {
      console.warn('sync-external-core: missing x-api-key header');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Initialize Supabase client (service role) to look up the partner key.
    //    The service role is used ONLY internally — the caller is authenticated
    //    via the per-partner api_key stored in the `partners` table.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 2b. Resolve the partner that owns this API key. Exact match against
    //     partners.api_key. No fallback, no env-based keys.
    const { data: keyOwner, error: keyOwnerErr } = await supabase
      .from('partners')
      .select('id, is_active, api_key, external_sync_enabled')
      .eq('api_key', apiKey.trim())
      .maybeSingle();

    if (keyOwnerErr) {
      console.error('sync-external-core: partner key lookup error', keyOwnerErr);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (!keyOwner?.id) {
      console.warn('sync-external-core: api key did not match any partner');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (keyOwner.is_active !== true) {
      console.warn('sync-external-core: api key belongs to inactive partner', {
        partner_id: keyOwner.id,
      });
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (keyOwner.external_sync_enabled === false) {
      console.warn('sync-external-core: external sync disabled for partner', {
        partner_id: keyOwner.id,
      });
      return jsonResponse(
        {
          success: false,
          error: 'external_sync_disabled',
          message: 'External sync endpoint is disabled for this partner.',
        },
        403,
      );
    }
    const resolvedPartnerId: string = keyOwner.id;

    // Best-effort audit: keep internal_system_auth.last_used_at fresh for the "core" service.
    // Non-blocking; ignore errors.
    try {
      const apiKeyHash = await hashApiKey(apiKey as string);
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

    // 3. Parse body. The Core system wraps the payload in a `data` envelope:
    //    { "action": "upsert_tenant", "data": { "external_id": "...", ... } }
    // We also accept a flat payload for backward compatibility.
    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!rawBody || typeof rawBody !== 'object' || !('action' in rawBody)) {
      return jsonResponse({ error: 'Missing action' }, 400);
    }

    const action = rawBody.action;
    const dataEnvelope =
      rawBody.data && typeof rawBody.data === 'object' && !Array.isArray(rawBody.data)
        ? rawBody.data
        : null;

    // Merge: prefer values inside `data`, fall back to top-level for compatibility.
    const merged = { ...(dataEnvelope ?? {}), ...rawBody };
    // Re-overlay data so envelope wins on overlapping keys (other than `action`).
    if (dataEnvelope) {
      for (const key of Object.keys(dataEnvelope)) {
        merged[key] = dataEnvelope[key];
      }
    }
    merged.action = action;

    // 4. Centralized partner_id enforcement (composite key isolation).
    //    - The field is REQUIRED in the payload (body.data.partner_id or top-level).
    //    - The payload partner_id MUST match the partner that owns the api_key.
    //    Applies to ALL actions: upsert_tenant, sync_user, sync_property, update_billing.
    const rawPartnerId = (merged as { partner_id?: unknown }).partner_id;
    if (typeof rawPartnerId !== 'string' || rawPartnerId.trim().length === 0) {
      return jsonResponse(
        {
          success: false,
          error: 'partner_id_required',
          message: 'partner_id is required for multi-tenant isolation',
        },
        400,
      );
    }
    const payloadPartnerId = rawPartnerId.trim();

    // Cross-partner protection: the API key's partner MUST match the payload's
    // partner_id. No exceptions — every key is partner-scoped.
    if (payloadPartnerId !== resolvedPartnerId) {
      console.warn('sync-external-core: cross-partner attempt blocked', {
        api_key_partner: resolvedPartnerId,
        payload_partner: payloadPartnerId,
      });
      return jsonResponse(
        {
          success: false,
          error: 'partner_mismatch',
          message:
            'The provided API key is not authorized to operate on this partner_id.',
        },
        403,
      );
    }

    // The partner is already validated as active during key lookup.
    const partnerId = resolvedPartnerId;

    // 5. Route by action — every handler receives the validated partnerId
    //    and MUST scope all tenant lookups to (partner_id, external_id).
    if (action === 'upsert_tenant') {
      return await handleUpsertTenant(supabase, merged as UpsertTenantBody, serviceName, partnerId);
    }
    if (action === 'sync_user') {
      return await handleSyncUser(supabase, merged as SyncUserBody, serviceName, partnerId);
    }
    if (action === 'sync_property') {
      return await handleSyncProperty(supabase, merged as SyncPropertyBody, serviceName, partnerId);
    }
    if (action === 'update_billing') {
      return await handleUpdateBilling(supabase, merged as UpdateBillingBody, serviceName, partnerId);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('sync-external-core: unexpected error', err);
    return jsonResponse({ error: 'Internal server error', details: String(err) }, 500);
  }
});

async function handleUpsertTenant(
  supabase: SupabaseClient,
  body: UpsertTenantBody,
  serviceName: string,
  partnerId: string,
): Promise<Response> {
  const { external_id, name, plan, owner_email, owner_name, max_users, country_code } = body;
  // partnerId is already validated upstream and forms the composite key.
  const finalPartnerId = partnerId;

  // Validate input
  if (!external_id || typeof external_id !== 'string' || external_id.trim().length === 0) {
    return jsonResponse({ error: 'external_id is required (non-empty string)' }, 400);
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return jsonResponse({ error: 'name is required (min 2 chars)' }, 400);
  }
  // Plans are now free-form text. Externally managed tenants may receive
  // region-specific names (e.g. "premium_mx"). We still sanity-check the
  // shape so we never persist obviously invalid values.
  const planResult = normalizePlan(plan ?? 'trial');
  if ('error' in planResult) {
    return jsonResponse({ error: planResult.error }, 400);
  }
  const resolvedPlan = planResult.value;
  if (owner_email !== undefined && owner_email !== null) {
    if (typeof owner_email !== 'string' || !isValidEmail(owner_email)) {
      return jsonResponse({ error: 'owner_email must be a valid email' }, 400);
    }
  }

  // Validate max_users (seats)
  let resolvedMaxUsers: number | undefined;
  if (max_users !== undefined && max_users !== null) {
    if (typeof max_users !== 'number' || !Number.isInteger(max_users) || max_users < 1 || max_users > 1000) {
      return jsonResponse({ error: 'max_users must be an integer between 1 and 1000' }, 400);
    }
    resolvedMaxUsers = max_users;
  }

  // Validate country_code (ISO 3166-1 alpha-2). Optional.
  let resolvedCountryCode: string | undefined;
  if (country_code !== undefined && country_code !== null) {
    if (typeof country_code !== 'string' || !COUNTRY_CODE_REGEX.test(country_code.toUpperCase())) {
      return jsonResponse(
        { error: 'country_code must be a 2-letter ISO code (e.g. MX, CO, AR)' },
        400,
      );
    }
    resolvedCountryCode = country_code.toUpperCase();
  }

  // Check if tenant exists — composite key (partner_id, external_id).
  const { data: existing, error: fetchError } = await supabase
    .from('tenants')
    .select('id, name, plan, managed_externally, external_id')
    .eq('external_id', external_id.trim())
    .eq('partner_id', finalPartnerId)
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
        ...(resolvedMaxUsers !== undefined ? { max_users: resolvedMaxUsers } : {}),
        ...(resolvedCountryCode !== undefined ? { country_code: resolvedCountryCode } : {}),
        partner_id: finalPartnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, name, plan, external_id, managed_externally, billing_state, message_credits, max_users, country_code')
      .single();

    if (updateError) {
      console.error('sync-external-core: update error', updateError);
      return jsonResponse({ error: 'Failed to update tenant', details: updateError.message }, 500);
    }

    // Audit: log external sync update event (non-blocking).
    try {
      await supabase.from('security_events').insert({
        tenant_id: existing.id,
        event_type: 'external_sync_update',
        metadata: {
          operation: 'updated',
          external_id: existing.external_id,
          service: serviceName,
          changes: {
            name: name.trim(),
            plan: resolvedPlan,
            ...(resolvedMaxUsers !== undefined ? { max_users: resolvedMaxUsers } : {}),
            ...(resolvedCountryCode !== undefined ? { country_code: resolvedCountryCode } : {}),
          },
        },
      });
    } catch (logErr) {
      console.warn('sync-external-core: security_events insert failed (update)', logErr);
    }

    return jsonResponse({
      success: true,
      operation: 'updated',
      tenant_id: updated.id,
      tenant: updated,
      service: serviceName,
    }, 200);
  }

  // CREATE new tenant. Externally managed tenants do NOT trigger Stripe flows;
  // they start in SUBSCRIBED_ACTIVE so Core can drive operations immediately.
  // Credits remain 0 until Core tops up the wallet.
  const { data: created, error: createError } = await supabase
    .from('tenants')
    .insert({
      name: name.trim(),
      plan: resolvedPlan,
      external_id: external_id.trim(),
      managed_externally: true,
      billing_state: 'SUBSCRIBED_ACTIVE',
      message_credits: 0,
      monthly_credits_remaining: 0,
      accumulated_credits: 0,
      extra_credits: 0,
      initial_credits_granted: false,
      ...(resolvedMaxUsers !== undefined ? { max_users: resolvedMaxUsers } : {}),
      ...(resolvedCountryCode !== undefined ? { country_code: resolvedCountryCode } : {}),
      partner_id: finalPartnerId,
    })
    .select('id, name, plan, external_id, managed_externally, billing_state, message_credits, max_users, country_code')
    .single();

  if (createError) {
    console.error('sync-external-core: create error', createError);
    return jsonResponse({ error: 'Failed to create tenant', details: createError.message }, 500);
  }

  // Audit: log external tenant creation (non-blocking).
  try {
    await supabase.from('security_events').insert({
      tenant_id: created.id,
      event_type: 'external_sync_update',
      metadata: {
        operation: 'created',
        external_id: created.external_id,
        service: serviceName,
        plan: resolvedPlan,
        ...(resolvedMaxUsers !== undefined ? { max_users: resolvedMaxUsers } : {}),
        owner_email: owner_email ?? null,
      },
    });
  } catch (logErr) {
    console.warn('sync-external-core: security_events insert failed (create)', logErr);
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

  // Optionally provision the tenant owner if an owner_email was provided.
  let owner: Record<string, unknown> | null = null;
  let ownerError: string | null = null;
  if (owner_email) {
    const inviteResult = await inviteOwner(supabase, {
      tenantId: created.id,
      ownerEmail: owner_email.trim().toLowerCase(),
      ownerName: (owner_name && owner_name.trim()) || owner_email.split('@')[0],
    });
    if (inviteResult.success) {
      owner = {
        user_id: inviteResult.userId,
        email: owner_email.trim().toLowerCase(),
        invite_email_sent: inviteResult.emailSent,
      };
    } else {
      ownerError = inviteResult.error || 'Failed to invite owner';
      console.error('sync-external-core: owner invite failed', ownerError);
    }
  }

  return jsonResponse({
    success: true,
    operation: 'created',
    tenant_id: created.id,
    tenant: created,
    owner,
    owner_error: ownerError,
    service: serviceName,
  }, 201);
}

// ---------------------------------------------------------------------------
// Owner provisioning (inline; admin-invite-owner requires super_admin auth,
// which is not available in service-to-service calls).
// ---------------------------------------------------------------------------

type InviteOwnerArgs = {
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
};

type InviteOwnerResult = {
  success: boolean;
  userId?: string;
  emailSent?: boolean;
  error?: string;
};

async function inviteOwner(
  supabase: SupabaseClient,
  { tenantId, ownerEmail, ownerName }: InviteOwnerArgs,
): Promise<InviteOwnerResult> {
  try {
    // Find existing auth user by email (idempotency).
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      return { success: false, error: `listUsers failed: ${listError.message}` };
    }
    const existingUser = existingUsers?.users?.find((u) => u.email === ownerEmail);

    let userId: string;
    let createdNewAuthUser = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Seat validation: count ALL profiles in tenant (owner is the first seat).
      const { data: tenantRow } = await supabase
        .from('tenants')
        .select('max_users')
        .eq('id', tenantId)
        .maybeSingle();
      const { count: currentUsers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      const maxUsers = tenantRow?.max_users ?? 0;
      if ((currentUsers ?? 0) >= maxUsers) {
        return {
          success: false,
          error: `MAX_SEATS_REACHED: tenant has ${currentUsers}/${maxUsers} seats in use`,
        };
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ownerEmail,
        email_confirm: true,
        user_metadata: {
          name: ownerName,
          tenant_id: tenantId,
          role_hint: 'owner',
        },
      });
      if (createError || !newUser?.user) {
        return { success: false, error: createError?.message || 'createUser failed' };
      }
      userId = newUser.user.id;
      createdNewAuthUser = true;
    }

    // Upsert profile (inactive until first login).
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          tenant_id: tenantId,
          name: ownerName,
          email: ownerEmail,
          status: 'inactive',
          first_login_required: true,
          invited_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    if (profileError) {
      if (createdNewAuthUser) {
        await supabase.auth.admin.deleteUser(userId);
      }
      return { success: false, error: `profile upsert failed: ${profileError.message}` };
    }

    // Upsert role as tenant owner.
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert(
        {
          user_id: userId,
          global_role: 'user',
          tenant_role: 'owner',
        },
        { onConflict: 'user_id' },
      );
    if (roleError) {
      if (createdNewAuthUser) {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.auth.admin.deleteUser(userId);
      }
      return { success: false, error: `role upsert failed: ${roleError.message}` };
    }

    // Generate recovery link and send invite email (best-effort).
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://notyfive-app-realstate.lovable.app';
    const redirectUrl = `${appBaseUrl.replace(/\/+$/, '')}/auth/complete-signup`;

    let emailSent = false;
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: ownerEmail,
        options: { redirectTo: redirectUrl },
      });

      const activationLink = linkData?.properties?.action_link;
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'NotyFive <no-reply@resend.dev>';

      if (!linkError && activationLink && resendApiKey) {
        const html = `
          <p>Hola <strong>${ownerName}</strong>,</p>
          <p>Tu cuenta ha sido creada por el sistema Core. Activa tu acceso aquí:</p>
          <p><a href="${activationLink}">Activar cuenta</a></p>
        `;
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [ownerEmail],
            subject: 'Activa tu cuenta',
            html,
          }),
        });
        emailSent = emailRes.ok;
      }
    } catch (emailErr) {
      console.warn('sync-external-core: email send failed', emailErr);
    }

    return { success: true, userId, emailSent };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// User sync (Core -> CRM)
// ---------------------------------------------------------------------------
async function handleSyncUser(
  supabase: SupabaseClient,
  body: SyncUserBody,
  serviceName: string,
  partnerId: string,
): Promise<Response> {
  const { tenant_external_id, email, name, tenant_role, status } = body;

  // Validate input
  if (!tenant_external_id || typeof tenant_external_id !== 'string' || !tenant_external_id.trim()) {
    return jsonResponse({ error: 'tenant_external_id is required (non-empty string)' }, 400);
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return jsonResponse({ error: 'email must be a valid email' }, 400);
  }
  const normalizedEmail = email.trim().toLowerCase();

  const resolvedRole = (tenant_role ?? 'asesor').toLowerCase();
  if (!VALID_TENANT_ROLES.includes(resolvedRole)) {
    return jsonResponse(
      { error: `Invalid tenant_role. Must be one of: ${VALID_TENANT_ROLES.join(', ')}` },
      400,
    );
  }

  const resolvedStatus = (status ?? 'active').toLowerCase();
  if (!VALID_USER_STATUSES.includes(resolvedStatus)) {
    return jsonResponse(
      { error: `Invalid status. Must be one of: ${VALID_USER_STATUSES.join(', ')}` },
      400,
    );
  }
  // Map suspended -> inactive at the profile level (suspended is a role-driven concept).
  const profileStatus = resolvedStatus === 'suspended' ? 'inactive' : resolvedStatus;

  const resolvedName =
    (name && name.trim()) || normalizedEmail.split('@')[0];

  // 1. Look up tenant by composite key (partner_id, external_id).
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, external_id, managed_externally, max_users')
    .eq('external_id', tenant_external_id.trim())
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (tenantErr) {
    console.error('sync_user: tenant lookup error', tenantErr);
    return jsonResponse({ error: 'Database error', details: tenantErr.message }, 500);
  }
  if (!tenant) {
    return jsonResponse(
      { error: 'Tenant not found for tenant_external_id', code: 'TENANT_NOT_FOUND' },
      404,
    );
  }
  const tenantId = tenant.id as string;

  // 2. Find existing auth user by email (idempotency).
  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    return jsonResponse({ error: `listUsers failed: ${listErr.message}` }, 500);
  }
  const authUser = usersList?.users?.find((u) => (u.email ?? '').toLowerCase() === normalizedEmail);

  // Determine if user already belongs to this tenant.
  let existingProfile: { id: string; tenant_id: string | null } | null = null;
  if (authUser) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, tenant_id')
      .eq('id', authUser.id)
      .maybeSingle();
    existingProfile = prof ?? null;
  }

  const userBelongsToTenant = existingProfile?.tenant_id === tenantId;

  if (userBelongsToTenant && authUser) {
    // ===== UPDATE EXISTING USER =====
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .update({
        name: resolvedName,
        status: profileStatus,
      })
      .eq('id', authUser.id);

    if (profileUpdateErr) {
      return jsonResponse(
        { error: 'Failed to update profile', details: profileUpdateErr.message },
        500,
      );
    }

    const { error: roleUpdateErr } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: authUser.id, global_role: 'user', tenant_role: resolvedRole },
        { onConflict: 'user_id' },
      );

    if (roleUpdateErr) {
      return jsonResponse(
        { error: 'Failed to update user role', details: roleUpdateErr.message },
        500,
      );
    }

    // Audit log (non-blocking).
    try {
      await supabase.from('security_events').insert({
        tenant_id: tenantId,
        user_id: authUser.id,
        event_type: 'external_user_sync',
        metadata: {
          operation: 'updated',
          service: serviceName,
          email: normalizedEmail,
          tenant_external_id: tenant.external_id,
          tenant_role: resolvedRole,
          status: resolvedStatus,
        },
      });
    } catch (logErr) {
      console.warn('sync_user: security_events insert failed (update)', logErr);
    }

    return jsonResponse(
      {
        success: true,
        operation: 'updated',
        user_id: authUser.id,
        tenant_id: tenantId,
        email: normalizedEmail,
        tenant_role: resolvedRole,
        status: profileStatus,
      },
      200,
    );
  }

  // ===== CREATE NEW USER (or attach existing auth user to this tenant) =====
  // Reject if the auth user exists but belongs to ANOTHER tenant (tenant isolation).
  if (existingProfile && existingProfile.tenant_id && existingProfile.tenant_id !== tenantId) {
    return jsonResponse(
      {
        error: 'User already exists in another tenant',
        code: 'EMAIL_IN_OTHER_TENANT',
      },
      409,
    );
  }

  // Seat validation: count ALL profiles in the tenant (including owners/admins).
  // Every user occupies one seat, so the limit must cover the entire team.
  const { count: currentUsers, error: countErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (countErr) {
    console.error('sync_user: seat count error', countErr);
    return jsonResponse({ error: 'Failed to count seats', details: countErr.message }, 500);
  }

  if ((currentUsers ?? 0) >= (tenant.max_users ?? 0)) {
    return jsonResponse(
      {
        error: 'Tenant has reached the maximum number of seats.',
        code: 'MAX_SEATS_REACHED',
        max_users: tenant.max_users,
        current_users: currentUsers ?? 0,
      },
      403,
    );
  }

  // Create or reuse auth user.
  let userId: string;
  let createdNewAuthUser = false;
  if (authUser) {
    userId = authUser.id;
  } else {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        name: resolvedName,
        tenant_id: tenantId,
        global_role: 'user',
        tenant_role: resolvedRole,
      },
    });
    if (createErr || !newUser?.user) {
      return jsonResponse(
        { error: createErr?.message || 'createUser failed' },
        500,
      );
    }
    userId = newUser.user.id;
    createdNewAuthUser = true;
  }

  // Insert/upsert profile bound to this tenant.
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        tenant_id: tenantId,
        name: resolvedName,
        email: normalizedEmail,
        status: profileStatus,
        first_login_required: createdNewAuthUser,
        invited_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  if (profileErr) {
    if (createdNewAuthUser) {
      await supabase.auth.admin.deleteUser(userId);
    }
    return jsonResponse(
      { error: 'profile upsert failed', details: profileErr.message },
      500,
    );
  }

  // Upsert role.
  const { error: roleErr } = await supabase
    .from('user_roles')
    .upsert(
      { user_id: userId, global_role: 'user', tenant_role: resolvedRole },
      { onConflict: 'user_id' },
    );
  if (roleErr) {
    if (createdNewAuthUser) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
    return jsonResponse(
      { error: 'role upsert failed', details: roleErr.message },
      500,
    );
  }

  // Audit log (non-blocking).
  try {
    await supabase.from('security_events').insert({
      tenant_id: tenantId,
      user_id: userId,
      event_type: 'external_user_sync',
      metadata: {
        operation: 'created',
        service: serviceName,
        email: normalizedEmail,
        tenant_external_id: tenant.external_id,
        tenant_role: resolvedRole,
        status: resolvedStatus,
      },
    });
  } catch (logErr) {
    console.warn('sync_user: security_events insert failed (create)', logErr);
  }

  return jsonResponse(
    {
      success: true,
      operation: 'created',
      user_id: userId,
      tenant_id: tenantId,
      email: normalizedEmail,
      tenant_role: resolvedRole,
      status: profileStatus,
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// Property sync (Core -> CRM)
// ---------------------------------------------------------------------------
async function handleSyncProperty(
  supabase: SupabaseClient,
  body: SyncPropertyBody,
  serviceName: string,
  partnerId: string,
): Promise<Response> {
  const {
    tenant_external_id,
    property_code,
    title,
    zone,
    address,
    operation_type,
    property_type,
    price,
    currency,
    status,
    is_active,
    ai_description_template,
    metadata,
    youtube_url: topYoutubeUrl,
    images: topImages,
    documents: topDocuments,
    faqs: topFaqs,
  } = body;

  // ---- Input validation ----
  if (!tenant_external_id || typeof tenant_external_id !== 'string' || !tenant_external_id.trim()) {
    return jsonResponse({ error: 'tenant_external_id is required (non-empty string)' }, 400);
  }
  if (!property_code || typeof property_code !== 'string' || !property_code.trim()) {
    return jsonResponse({ error: 'property_code is required (non-empty string)' }, 400);
  }

  if (operation_type !== undefined && !VALID_OPERATION_TYPES.includes(operation_type)) {
    return jsonResponse(
      { error: `Invalid operation_type. Must be one of: ${VALID_OPERATION_TYPES.join(', ')}` },
      400,
    );
  }
  if (status !== undefined && !VALID_PROPERTY_STATUSES.includes(status)) {
    return jsonResponse(
      { error: `Invalid status. Must be one of: ${VALID_PROPERTY_STATUSES.join(', ')}` },
      400,
    );
  }

  // ---- Locate tenant via composite key (partner_id, external_id) ----
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, external_id, managed_externally')
    .eq('external_id', tenant_external_id.trim())
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (tenantErr) {
    console.error('sync_property: tenant lookup error', tenantErr);
    return jsonResponse({ error: 'Database error', details: tenantErr.message }, 500);
  }
  if (!tenant) {
    return jsonResponse(
      { error: 'Tenant not found for tenant_external_id', code: 'TENANT_NOT_FOUND' },
      404,
    );
  }
  const tenantId = tenant.id as string;

  // ---- Normalize technical metadata ----
  const md = metadata && typeof metadata === 'object' ? metadata : {};

  // Multimedia & FAQ payloads can arrive either at the root of the request
  // or nested inside `metadata`. Root-level wins, but we fall back to
  // metadata so different Core implementations remain compatible.
  const images = Array.isArray(topImages)
    ? topImages
    : Array.isArray((md as any).images)
      ? ((md as any).images as string[])
      : undefined;
  const documents = Array.isArray(topDocuments)
    ? topDocuments
    : Array.isArray((md as any).documents)
      ? ((md as any).documents as Array<{ url: string; name?: string; type?: string }>)
      : undefined;
  const faqs = Array.isArray(topFaqs)
    ? topFaqs
    : Array.isArray((md as any).faqs)
      ? ((md as any).faqs as Array<{ question: string; answer: string }>)
      : undefined;

  // accepted_credits is a dynamic list of strings (any region).
  let acceptedCredits: string[] | undefined;
  if (md.accepted_credits !== undefined && md.accepted_credits !== null) {
    if (!Array.isArray(md.accepted_credits)) {
      return jsonResponse(
        { error: 'metadata.accepted_credits must be an array of strings' },
        400,
      );
    }
    acceptedCredits = md.accepted_credits
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());
  }

  const numericOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const intOrNull = (v: unknown): number | null | undefined => {
    const n = numericOrNull(v);
    if (n === undefined) return undefined;
    if (n === null) return null;
    return Math.trunc(n);
  };

  const bedrooms = intOrNull(md.bedrooms);
  const bathrooms = numericOrNull(md.bathrooms);
  const parkingSpots = intOrNull(md.parking_spots);
  const sqMeters = numericOrNull(md.sq_meters);
  const maintenanceFee = numericOrNull(md.maintenance_fee);

  // ---- Build payload (only include defined keys for partial updates) ----
  const updatePayload: Record<string, unknown> = {};
  // partner_id MUST always be present to satisfy multi-tenant isolation on
  // the properties table (NOT NULL + composite-key enforcement). Source it
  // from the validated partner that owns the api_key, never from raw input.
  updatePayload.partner_id = partnerId;
  if (title !== undefined) updatePayload.title = title;
  if (zone !== undefined) updatePayload.zone = zone;
  if (address !== undefined) updatePayload.address = address;
  if (operation_type !== undefined) updatePayload.operation_type = operation_type;
  // property_type is a free-form string (multi-country: "Departamento" MX, "Apartamento" CO, etc.)
  // If Core sends the field but the value is empty/null, persist a friendly fallback so the UI
  // never shows an empty badge.
  if (property_type !== undefined) {
    const pt = typeof property_type === 'string' ? property_type.trim() : '';
    updatePayload.property_type = pt.length > 0 ? pt : 'No especificado';
  }
  if (price !== undefined) updatePayload.price = price;
  if (currency !== undefined) updatePayload.currency = currency;
  if (status !== undefined) updatePayload.status = status;
  if (is_active !== undefined) updatePayload.is_active = is_active;
  if (ai_description_template !== undefined) {
    updatePayload.ai_description_template = ai_description_template;
  }
  if (acceptedCredits !== undefined) updatePayload.accepted_credits = acceptedCredits;
  if (bedrooms !== undefined) updatePayload.bedrooms = bedrooms;
  if (bathrooms !== undefined) updatePayload.bathrooms = bathrooms;
  if (parkingSpots !== undefined) updatePayload.parking_spots = parkingSpots;
  if (sqMeters !== undefined) updatePayload.sq_meters = sqMeters;
  if (maintenanceFee !== undefined) updatePayload.maintenance_fee = maintenanceFee;
  if (md.visit_availability !== undefined) {
    updatePayload.visit_availability = md.visit_availability;
  }
  // youtube_url can come either at top-level or inside metadata; top-level wins.
  const effectiveYoutubeUrl =
    topYoutubeUrl !== undefined ? topYoutubeUrl : md.youtube_url;
  if (effectiveYoutubeUrl !== undefined) {
    updatePayload.youtube_url = effectiveYoutubeUrl;
  }

  // ---- Check existence: (tenant_id, property_code) is unique ----
  const { data: existingProp, error: lookupErr } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('property_code', property_code.trim())
    .maybeSingle();

  if (lookupErr) {
    console.error('sync_property: lookup error', lookupErr);
    return jsonResponse({ error: 'Database error', details: lookupErr.message }, 500);
  }

  let propertyId: string;
  let operation: 'created' | 'updated';

  if (existingProp) {
    operation = 'updated';
    propertyId = existingProp.id;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updErr } = await supabase
        .from('properties')
        .update(updatePayload)
        .eq('id', propertyId);
      if (updErr) {
        console.error('sync_property: update error', updErr);
        return jsonResponse(
          { error: 'Failed to update property', details: updErr.message },
          500,
        );
      }
    }
  } else {
    operation = 'created';
    // Required fields for INSERT (NOT NULL): title, zone, operation_type
    const insertPayload = {
      tenant_id: tenantId,
      partner_id: partnerId,
      property_code: property_code.trim(),
      title: title ?? property_code.trim(),
      zone: zone ?? '',
      operation_type: operation_type ?? 'sale',
      price: price ?? 0,
      currency: currency ?? 'MXN',
      status: status ?? 'available',
      is_active: is_active ?? true,
      ...updatePayload,
    };
    const { data: created, error: insErr } = await supabase
      .from('properties')
      .insert(insertPayload)
      .select('id')
      .single();
    if (insErr || !created) {
      console.error('sync_property: insert error', insErr);
      return jsonResponse(
        { error: 'Failed to create property', details: insErr?.message },
        500,
      );
    }
    propertyId = created.id;
  }

  // ---- Sync Core-managed multimedia & FAQs ----
  // For each provided collection, we delete existing rows tagged as
  // source = 'core' and insert the new ones. Manual entries are preserved.
  const mediaSyncSummary: Record<string, number> = {};

  if (Array.isArray(images)) {
    const cleanImages = images
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim());

    const { error: delImgErr } = await supabase
      .from('property_images')
      .delete()
      .eq('property_id', propertyId)
      .eq('source', 'core');
    if (delImgErr) {
      console.error('sync_property: delete core images error', delImgErr);
      return jsonResponse(
        { error: 'Failed to clear Core images', details: delImgErr.message },
        500,
      );
    }

    if (cleanImages.length > 0) {
      const rows = cleanImages.map((url, idx) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        file_url: url,
        is_cover: idx === 0,
        sort_order: idx,
        source: 'core',
      }));
      const { error: insImgErr } = await supabase.from('property_images').insert(rows);
      if (insImgErr) {
        console.error('sync_property: insert core images error', insImgErr);
        return jsonResponse(
          { error: 'Failed to insert Core images', details: insImgErr.message },
          500,
        );
      }
    }
    mediaSyncSummary.images = cleanImages.length;
  }

  if (Array.isArray(documents)) {
    const cleanDocs = documents
      .filter(
        (d): d is { url: string; name?: string; type?: string } =>
          !!d && typeof d === 'object' && typeof (d as any).url === 'string' &&
          (d as any).url.trim().length > 0,
      )
      .map((d) => ({
        url: d.url.trim(),
        name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : d.url.split('/').pop() || 'document',
        type: typeof d.type === 'string' && d.type.trim() ? d.type.trim() : (d.url.split('.').pop() || 'unknown'),
      }));

    const { error: delDocErr } = await supabase
      .from('property_documents')
      .delete()
      .eq('property_id', propertyId)
      .eq('source', 'core');
    if (delDocErr) {
      console.error('sync_property: delete core docs error', delDocErr);
      return jsonResponse(
        { error: 'Failed to clear Core documents', details: delDocErr.message },
        500,
      );
    }

    if (cleanDocs.length > 0) {
      const rows = cleanDocs.map((d) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        file_url: d.url,
        file_name: d.name,
        file_type: d.type,
        source: 'core',
      }));
      const { error: insDocErr } = await supabase.from('property_documents').insert(rows);
      if (insDocErr) {
        console.error('sync_property: insert core docs error', insDocErr);
        return jsonResponse(
          { error: 'Failed to insert Core documents', details: insDocErr.message },
          500,
        );
      }
    }
    mediaSyncSummary.documents = cleanDocs.length;
  }

  if (Array.isArray(faqs)) {
    const cleanFaqs = faqs
      .filter(
        (f): f is { question: string; answer: string } =>
          !!f && typeof f === 'object' &&
          typeof (f as any).question === 'string' && (f as any).question.trim().length > 0 &&
          typeof (f as any).answer === 'string' && (f as any).answer.trim().length > 0,
      )
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }));

    const { error: delFaqErr } = await supabase
      .from('property_faq')
      .delete()
      .eq('property_id', propertyId)
      .eq('source', 'core');
    if (delFaqErr) {
      console.error('sync_property: delete core faqs error', delFaqErr);
      return jsonResponse(
        { error: 'Failed to clear Core FAQs', details: delFaqErr.message },
        500,
      );
    }

    if (cleanFaqs.length > 0) {
      const rows = cleanFaqs.map((f, idx) => ({
        tenant_id: tenantId,
        property_id: propertyId,
        question: f.question,
        answer: f.answer,
        sort_order: idx,
        source: 'core',
      }));
      const { error: insFaqErr } = await supabase.from('property_faq').insert(rows);
      if (insFaqErr) {
        console.error('sync_property: insert core faqs error', insFaqErr);
        return jsonResponse(
          { error: 'Failed to insert Core FAQs', details: insFaqErr.message },
          500,
        );
      }
    }
    mediaSyncSummary.faqs = cleanFaqs.length;
  }

  // ---- Audit log (non-blocking) ----
  try {
    await supabase.from('security_events').insert({
      tenant_id: tenantId,
      event_type: 'external_sync_update',
      metadata: {
        operation,
        entity: 'property',
        service: serviceName,
        property_id: propertyId,
        property_code: property_code.trim(),
        tenant_external_id: tenant.external_id,
        fields_synced: Object.keys(updatePayload),
        media_synced: mediaSyncSummary,
      },
    });
  } catch (logErr) {
    console.warn('sync_property: security_events insert failed', logErr);
  }

  return jsonResponse(
    {
      success: true,
      operation,
      property_id: propertyId,
      tenant_id: tenantId,
      property_code: property_code.trim(),
      media_synced: mediaSyncSummary,
    },
    operation === 'created' ? 201 : 200,
  );
}

/**
 * Handle the `update_billing` action.
 *
 * The external Core delegates control of the tenant's billing state, plan and
 * total credit balance. We:
 *  - Resolve the tenant by `tenant_external_id`.
 *  - Update `tenants.billing_state`, `plan`, `message_credits` (when provided).
 *  - Sync the legacy `wallets.balance_messages` so older code paths agree.
 *  - Record a `wallet_ledger` movement (`external_adjustment`) for any delta.
 *  - Audit the change in `security_events` (`external_billing_update`).
 */
async function handleUpdateBilling(
  supabase: SupabaseClient,
  body: UpdateBillingBody,
  serviceName: string,
  partnerId: string,
): Promise<Response> {
  const {
    tenant_external_id,
    billing_state,
    plan,
    message_credits,
    reason,
    external_id: movementExternalId,
    description: descriptionOverride,
  } = body;

  if (
    !tenant_external_id ||
    typeof tenant_external_id !== 'string' ||
    tenant_external_id.trim().length === 0
  ) {
    return jsonResponse({ error: 'tenant_external_id is required (non-empty string)' }, 400);
  }

  // Validate billing_state (optional but constrained when sent).
  let resolvedBillingState: string | undefined;
  if (billing_state !== undefined && billing_state !== null) {
    if (typeof billing_state !== 'string' || !VALID_BILLING_STATES.includes(billing_state)) {
      return jsonResponse(
        { error: `Invalid billing_state. Must be one of: ${VALID_BILLING_STATES.join(', ')}` },
        400,
      );
    }
    resolvedBillingState = billing_state;
  }

  // Validate plan (optional). Free-form text — see normalizePlan.
  let resolvedPlan: string | undefined;
  if (plan !== undefined && plan !== null) {
    const planResult = normalizePlan(plan);
    if ('error' in planResult) {
      return jsonResponse({ error: planResult.error }, 400);
    }
    resolvedPlan = planResult.value;
  }

  // Validate message_credits (optional). Must be a non-negative integer.
  let resolvedCredits: number | undefined;
  if (message_credits !== undefined && message_credits !== null) {
    if (
      typeof message_credits !== 'number' ||
      !Number.isFinite(message_credits) ||
      !Number.isInteger(message_credits) ||
      message_credits < 0
    ) {
      return jsonResponse({ error: 'message_credits must be a non-negative integer' }, 400);
    }
    resolvedCredits = message_credits;
  }

  if (
    resolvedBillingState === undefined &&
    resolvedPlan === undefined &&
    resolvedCredits === undefined
  ) {
    return jsonResponse(
      { error: 'At least one of billing_state, plan or message_credits must be provided' },
      400,
    );
  }

  // Resolve tenant via composite key (partner_id, external_id).
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select(
      'id, external_id, name, plan, billing_state, message_credits, monthly_credits_remaining, accumulated_credits, extra_credits, managed_externally, partner_id',
    )
    .eq('external_id', tenant_external_id.trim())
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (fetchError) {
    console.error('update_billing: fetch tenant error', fetchError);
    return jsonResponse({ error: 'Database error', details: fetchError.message }, 500);
  }
  if (!tenant) {
    return jsonResponse({ error: 'Tenant not found for given tenant_external_id' }, 404);
  }

  const previousState = {
    billing_state: tenant.billing_state as string,
    plan: tenant.plan as string,
    message_credits: tenant.message_credits ?? 0,
  };

  // Sanitize the optional Core-provided external movement id once; it is
  // reused both for the partner wallet ledger metadata and the legacy
  // tenant wallet ledger entry below.
  const safeMovementExternalId =
    typeof movementExternalId === 'string' && movementExternalId.trim().length > 0
      ? movementExternalId.trim().slice(0, 128)
      : null;

  // ============================================================
  // STEP A — Credit top-up via the Partner's Super Wallet.
  // ------------------------------------------------------------
  // When the Core webhook ships `message_credits`, it represents the
  // amount to abonar (additive) sourced from the partner's Super Wallet
  // (mayorista). We invoke the SECURITY DEFINER service RPC instead of
  // directly mutating `tenants.message_credits` so:
  //   - the partner balance is decremented atomically;
  //   - movements are auditable in `partner_wallet_ledger` with full
  //     traceability (external_id of the Core payment in metadata);
  //   - insufficient partner funds bubble up as HTTP 402 to the Core.
  // ============================================================
  if (resolvedCredits !== undefined && resolvedCredits > 0) {
    const description =
      typeof descriptionOverride === 'string' && descriptionOverride.trim().length > 0
        ? descriptionOverride.trim().slice(0, 500)
        : 'Abono automático vía Core Externo (Acción: update_billing)';

    const ledgerMetadata: Record<string, unknown> = {
      source: 'sync-external-core',
      service: serviceName,
      action: 'update_billing',
      tenant_external_id: tenant.external_id,
    };
    if (safeMovementExternalId) ledgerMetadata.external_id = safeMovementExternalId;
    if (reason) ledgerMetadata.reason = reason;

    const { error: redeemErr } = await supabase.rpc(
      'partner_wallet_redeem_to_tenant_service',
      {
        _partner_id: partnerId,
        _tenant_id: tenant.id,
        _amount: resolvedCredits,
        _description: description,
        _metadata: ledgerMetadata,
      },
    );

    if (redeemErr) {
      const msg = String(redeemErr.message ?? '');
      const code = (redeemErr as { code?: string }).code ?? '';
      console.error('update_billing: super wallet redeem error', { code, msg });

      // P0003 (custom) → insufficient Super Wallet balance.
      if (code === 'P0003' || /Saldo insuficiente/i.test(msg)) {
        return jsonResponse(
          {
            success: false,
            error: 'partner_super_wallet_insufficient_balance',
            message:
              'Saldo insuficiente en la Super Wallet del Partner. Recargue la bolsa mayorista para continuar abonando créditos a sus tenants.',
            partner_id: partnerId,
            requested_amount: resolvedCredits,
            external_id: safeMovementExternalId,
          },
          402,
        );
      }
      if (/Super Wallet no inicializada/i.test(msg)) {
        return jsonResponse(
          {
            success: false,
            error: 'partner_super_wallet_not_initialized',
            message:
              'La Super Wallet del Partner no ha sido inicializada. Realice un primer abono antes de redimir créditos.',
            partner_id: partnerId,
          },
          402,
        );
      }
      if (/no pertenece/i.test(msg)) {
        return jsonResponse(
          { success: false, error: 'tenant_partner_mismatch', message: msg },
          403,
        );
      }
      return jsonResponse(
        { success: false, error: 'super_wallet_redeem_failed', message: msg },
        500,
      );
    }
  }

  // ============================================================
  // STEP B — Apply non-credit fields (billing_state, plan) and any
  // explicit zero-credit reset. We never overwrite `message_credits`
  // here when the Super Wallet RPC already credited the tenant.
  // ============================================================
  const tenantUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (resolvedBillingState !== undefined) tenantUpdate.billing_state = resolvedBillingState;
  if (resolvedPlan !== undefined) tenantUpdate.plan = resolvedPlan;
  // Explicit zero from Core means "block sending" — keep legacy behavior.
  if (resolvedCredits !== undefined && resolvedCredits === 0) {
    tenantUpdate.message_credits = 0;
    tenantUpdate.accumulated_credits = 0;
    tenantUpdate.monthly_credits_remaining = 0;
    tenantUpdate.extra_credits = 0;
  }

  const { data: updatedTenant, error: updateError } = await supabase
    .from('tenants')
    .update(tenantUpdate)
    .eq('id', tenant.id)
    .select(
      'id, external_id, name, plan, billing_state, message_credits, monthly_credits_remaining, accumulated_credits, extra_credits, managed_externally',
    )
    .single();

  if (updateError) {
    console.error('update_billing: update tenant error', updateError);
    return jsonResponse(
      { error: 'Failed to update tenant billing', details: updateError.message },
      500,
    );
  }

  // Sync legacy wallet balance to keep downstream code in sync.
  // For Super-Wallet-driven top-ups (resolvedCredits > 0) the RPC already
  // wrote to `partner_wallet_ledger` AND to `wallet_ledger`, so we skip
  // this block entirely. We still run it for explicit zero-resets to keep
  // the legacy `wallets` row aligned with the tenant.
  let walletLedgerEntry: Record<string, unknown> | null = null;
  if (resolvedCredits !== undefined && resolvedCredits === 0) {
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id, balance_messages')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    // Use the previous tenant credits as authoritative source for the ledger
    // (the legacy wallet row may be stale or missing). Fall back to the
    // wallet balance only if tenant credits are unknown.
    const previousBalance =
      previousState.message_credits ?? walletRow?.balance_messages ?? 0;
    const status =
      resolvedBillingState === 'SUSPENDED'
        ? 'blocked'
        : resolvedCredits <= 0
          ? 'blocked'
          : resolvedCredits <= 100
            ? 'low'
            : 'active';

    if (walletRow) {
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({
          balance_messages: resolvedCredits,
          balance_monthly: 0,
          balance_rollover: resolvedCredits,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', walletRow.id);
      if (walletErr) {
        console.error('update_billing: wallet update error', walletErr);
      }
    } else {
      const { error: walletInsertErr } = await supabase.from('wallets').insert({
        tenant_id: tenant.id,
        balance_messages: resolvedCredits,
        balance_monthly: 0,
        balance_rollover: resolvedCredits,
        status,
      });
      if (walletInsertErr) {
        console.error('update_billing: wallet insert error', walletInsertErr);
      }
    }

    // Ledger entry: only when there is an actual delta (>0). The ledger
    // CHECK constraint requires `amount > 0`, so equal balances are skipped.
    const delta = resolvedCredits - previousBalance;
    if (delta !== 0) {
      const movement_type = delta > 0 ? 'credit' : 'debit';
      // Distinguish between top-ups originating from the Core (positive
      // delta) and balance corrections / debits coming from the same
      // channel. This drives the icon/copy in the Super Admin history UI.
      const ledgerReason = delta > 0 ? 'external_recharge' : 'core_adjustment';
      const planLabel = updatedTenant.plan ?? resolvedPlan ?? previousState.plan ?? '—';
      const defaultDescription =
        delta > 0
          ? `Recarga automática vía API Core - Plan ${planLabel}`
          : `Ajuste de saldo vía API Core - Plan ${planLabel}`;
      const description =
        typeof descriptionOverride === 'string' && descriptionOverride.trim().length > 0
          ? descriptionOverride.trim().slice(0, 500)
          : defaultDescription;

      // Prefer Core-provided external_id for idempotency so re-deliveries of
      // the same movement are de-duped. Fall back to a timestamped key.
      const idempotency_key = safeMovementExternalId
        ? `core:${safeMovementExternalId}`
        : `external_adjustment:${tenant.id}:${Date.now()}`;

      const ledgerMetadata: Record<string, unknown> = {
        service: serviceName,
        tenant_external_id: tenant.external_id,
        plan: planLabel,
        billing_state: updatedTenant.billing_state,
        previous_balance: previousBalance,
        new_balance: resolvedCredits,
        delta,
      };
      if (safeMovementExternalId) ledgerMetadata.external_id = safeMovementExternalId;
      if (reason) ledgerMetadata.reason = reason;

      const { error: ledgerErr } = await supabase.from('wallet_ledger').insert({
        tenant_id: tenant.id,
        movement_type,
        amount: Math.abs(delta),
        reason: ledgerReason,
        description,
        metadata: ledgerMetadata,
        source_table: 'sync-external-core',
        idempotency_key,
        balance_before: previousBalance,
        balance_after: resolvedCredits,
        bucket: 'rollover',
      });
      if (ledgerErr) {
        console.warn('update_billing: wallet_ledger insert failed', ledgerErr);
      } else {
        walletLedgerEntry = {
          movement_type,
          reason: ledgerReason,
          amount: Math.abs(delta),
          description,
          balance_before: previousBalance,
          balance_after: resolvedCredits,
          external_id: safeMovementExternalId,
        };
      }
    }
  }

  // Audit: log billing update event (non-blocking).
  try {
    await supabase.from('security_events').insert({
      tenant_id: tenant.id,
      event_type: 'external_billing_update',
      metadata: {
        service: serviceName,
        external_id: tenant.external_id,
        reason: reason ?? null,
        previous: previousState,
        next: {
          billing_state: updatedTenant.billing_state,
          plan: updatedTenant.plan,
          message_credits: updatedTenant.message_credits,
        },
        wallet_ledger: walletLedgerEntry,
      },
    });
  } catch (logErr) {
    console.warn('update_billing: security_events insert failed', logErr);
  }

  return jsonResponse(
    {
      success: true,
      tenant_id: tenant.id,
      external_id: tenant.external_id,
      tenant: updatedTenant,
      wallet_ledger: walletLedgerEntry,
    },
    200,
  );
}