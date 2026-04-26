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
};

type SyncUserBody = {
  action: 'sync_user';
  tenant_external_id: string;
  email: string;
  name?: string;
  tenant_role?: string;
  status?: string; // 'active' | 'inactive' | 'suspended'
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

type RequestBody = UpsertTenantBody | SyncUserBody | SyncPropertyBody;

const VALID_PLANS = ['trial', 'starter', 'growth', 'pro', 'scale', 'enterprise'];
const VALID_TENANT_ROLES = ['owner', 'administrador', 'manager', 'marketer', 'asesor'];
const ADMIN_TENANT_ROLES = ['owner', 'administrador'];
const VALID_USER_STATUSES = ['active', 'inactive', 'suspended'];
const VALID_OPERATION_TYPES = ['sale', 'rent'];
const VALID_PROPERTY_STATUSES = ['available', 'reserved', 'sold', 'rented', 'inactive'];
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

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

    // 4. Route by action
    if (action === 'upsert_tenant') {
      return await handleUpsertTenant(supabase, merged as UpsertTenantBody, serviceName);
    }
    if (action === 'sync_user') {
      return await handleSyncUser(supabase, merged as SyncUserBody, serviceName);
    }
    if (action === 'sync_property') {
      return await handleSyncProperty(supabase, merged as SyncPropertyBody, serviceName);
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
): Promise<Response> {
  const { external_id, name, plan, owner_email, owner_name, max_users, country_code } = body;

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
        ...(resolvedMaxUsers !== undefined ? { max_users: resolvedMaxUsers } : {}),
        ...(resolvedCountryCode !== undefined ? { country_code: resolvedCountryCode } : {}),
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

  // 1. Look up tenant by external_id (multi-tenancy boundary).
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, external_id, managed_externally, max_users')
    .eq('external_id', tenant_external_id.trim())
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
    images,
    documents,
    faqs,
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

  // ---- Locate tenant (multi-tenancy boundary) ----
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, external_id, managed_externally')
    .eq('external_id', tenant_external_id.trim())
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
  if (title !== undefined) updatePayload.title = title;
  if (zone !== undefined) updatePayload.zone = zone;
  if (address !== undefined) updatePayload.address = address;
  if (operation_type !== undefined) updatePayload.operation_type = operation_type;
  if (property_type !== undefined) updatePayload.property_type = property_type;
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
    },
    operation === 'created' ? 201 : 200,
  );
}