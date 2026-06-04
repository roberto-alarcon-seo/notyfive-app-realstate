// Admin Impersonation via SSO
// Generates a short-lived HS256 JWT (signed with SSO_SECRET) for a tenant's
// administrator, then returns the SSO callback URL the front-end should
// redirect to. This lets the Super Admin enter the tenant's CRM as a real user
// without ever knowing the tenant's password.
//
// Flow:
//   POST /functions/v1/admin-impersonate-sso  { tenant_id }
//   1. Authenticate caller via Authorization header.
//   2. Verify caller has global_role = 'super_admin'.
//   3. Resolve tenant + a target user (administrador role preferred).
//   4. Sign a JWT with { email, tenant_external_id, exp } using SSO_SECRET.
//   5. Audit-log the action and return the redirect URL to /auth/sso?token=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SSO_SECRET = Deno.env.get('SSO_SECRET') ?? '';

// ---------- HS256 JWT signing ----------
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

async function signJwtHs256(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SSO_SECRET) {
    console.error('admin-impersonate-sso: SSO_SECRET is not configured');
    return json({ error: 'Server misconfigured: SSO_SECRET missing' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authorization required' }, 401);

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify caller
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userErr || !userData?.user) {
      return json({ error: 'Invalid authentication' }, 401);
    }
    const caller = userData.user;

    // 2. Verify caller is super_admin (global or partner-scoped)
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .select('global_role, partner_scope')
      .eq('user_id', caller.id)
      .maybeSingle();

    if (roleErr) {
      console.error('admin-impersonate-sso: role lookup failed', roleErr);
      return json({ error: 'No se pudo verificar tu rol de administrador.' }, 500);
    }
    if (roleRow?.global_role !== 'super_admin') {
      return json(
        { error: 'Acceso denegado. Esta acción requiere rol de Super Admin.' },
        403,
      );
    }
    const partnerScope: string | null = roleRow?.partner_scope ?? null;

    // 3. Parse body
    const { tenant_id, target_user_id } = await req.json().catch(() => ({}));
    if (!tenant_id || typeof tenant_id !== 'string') {
      return json({ error: 'Falta el parámetro tenant_id.' }, 400);
    }
    if (
      target_user_id !== undefined &&
      target_user_id !== null &&
      typeof target_user_id !== 'string'
    ) {
      return json({ error: 'target_user_id inválido.' }, 400);
    }

    // 4. Resolve tenant (incluye partner_id para validación multi-tenant)
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('id, name, external_id, partner_id')
      .eq('id', tenant_id)
      .maybeSingle();

    if (tenantErr) {
      console.error('admin-impersonate-sso: tenant lookup failed', tenantErr);
      return json({ error: 'No se pudo cargar el tenant solicitado.' }, 500);
    }
    if (!tenant) return json({ error: 'El tenant solicitado no existe.' }, 404);

    // 4.b. Multi-tenant security: si el caller tiene partner_scope, el tenant
    // debe pertenecer a ese mismo partner. Caso contrario -> auditar y bloquear.
    if (partnerScope && tenant.partner_id !== partnerScope) {
      try {
        await supabaseAdmin.from('security_events').insert({
          event_type: 'admin_impersonation_denied_partner_scope',
          user_id: caller.id,
          tenant_id: tenant.id,
          ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
          user_agent: req.headers.get('user-agent') ?? 'unknown',
          metadata: {
            actor_email: caller.email,
            caller_partner_scope: partnerScope,
            tenant_partner_id: tenant.partner_id,
            tenant_name: tenant.name,
          },
        });
      } catch (auditErr) {
        console.warn('Failed to audit denied impersonation', auditErr);
      }
      return json(
        {
          error:
            'Este tenant no pertenece a tu partner. Solo puedes acceder a tenants de tu marca.',
        },
        403,
      );
    }

    // 5. Pick a target user.
    // If the caller provided an explicit target_user_id, validate it belongs
    // to this tenant and use it directly. Otherwise fall back to the
    // hierarchical strategy (owner → administrador → any profile).
    let targetEmail: string | null = null;
    let targetUserId: string | null = null;
    let manualSelection = false;

    if (target_user_id) {
      const { data: targetProfile, error: targetErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email, tenant_id')
        .eq('id', target_user_id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (targetErr) {
        console.error('admin-impersonate-sso: target profile lookup failed', targetErr);
        return json({ error: 'No se pudo validar el usuario seleccionado.' }, 500);
      }
      if (!targetProfile?.email) {
        return json({ error: 'Usuario no encontrado en este tenant.' }, 404);
      }
      targetEmail = targetProfile.email;
      targetUserId = targetProfile.id;
      manualSelection = true;
    }

    for (const role of ['owner', 'administrador'] as const) {
      if (targetEmail) break;
      const { data: roleProfile } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, profiles!inner(id, email, status, tenant_id)')
        .eq('tenant_role', role)
        .eq('profiles.tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();

      const profile = roleProfile?.profiles as
        | { id?: string; email?: string }
        | undefined;
      if (profile?.email) {
        targetEmail = profile.email;
        targetUserId = profile.id ?? null;
        break;
      }
    }

    if (!targetEmail) {
      const { data: anyProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('tenant_id', tenant.id)
        .order('status', { ascending: true }) // 'active' before 'inactive'
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetEmail = anyProfile?.email ?? null;
      targetUserId = anyProfile?.id ?? null;
    }

    if (!targetEmail) {
      return json({ error: 'No user found for this tenant' }, 404);
    }

    // 6. Sign JWT (5-minute expiry)
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwtHs256(
      {
        email: targetEmail,
        tenant_external_id: tenant.external_id ?? null,
        tenant_id: tenant.id,
        iat: now,
        exp: now + 300,
        purpose: 'admin_impersonation',
      },
      SSO_SECRET,
    );

    // 7. Audit log (best effort)
    try {
      await supabaseAdmin.from('security_events').insert({
        event_type: 'admin_impersonation_sso_issued',
        user_id: caller.id,
        tenant_id: tenant.id,
        ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
        user_agent: req.headers.get('user-agent') ?? 'unknown',
        metadata: {
          tenant_name: tenant.name,
          target_email: targetEmail,
          target_user_id: targetUserId,
          actor_email: caller.email,
        manual_selection: manualSelection,
        },
      });
    } catch (err) {
      console.warn('Failed to write audit event', err);
    }

    return json({
      success: true,
      token,
      tenant_external_id: tenant.external_id,
      target_email: targetEmail,
      // The front-end will redirect the browser to this path:
      sso_path: `/auth/sso?token=${encodeURIComponent(token)}&mode=impersonation`,
    });
  } catch (err) {
    console.error('admin-impersonate-sso error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});