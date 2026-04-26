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
  const { external_id, name, plan, owner_email, owner_name, max_users } = body;

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
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, name, plan, external_id, managed_externally, billing_state, message_credits, max_users')
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
    })
    .select('id, name, plan, external_id, managed_externally, billing_state, message_credits, max_users')
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