// SSO Partner Callback Edge Function
//
// POST /functions/v1/sso-partner-callback
// Headers: Authorization: Bearer <PARTNER_SSO_TOKEN>
// Body: { tenant_external_id, partner_id, email, name }
//
// Validates the partner shared token, ensures the tenant exists for the
// given (external_id, partner_id) pair and that the email is already
// registered as a profile inside that tenant. If valid, generates a
// Supabase magic link redirecting to /admin/super-wallet.
//
// All attempts are logged into public.partner_sso_logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PARTNER_SSO_TOKEN = Deno.env.get("PARTNER_SSO_TOKEN") ?? "";

const FALLBACK_APP_ORIGIN = "https://notyfive-app-realstate.lovable.app";
const REDIRECT_PATH = "/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logAttempt(
  supabase: ReturnType<typeof createClient>,
  entry: {
    email: string;
    partner_id: string | null;
    tenant_external_id: string | null;
    tenant_id: string | null;
    success: boolean;
    error_reason: string | null;
    ip: string | null;
    user_agent: string | null;
  },
) {
  try {
    await supabase.from("partner_sso_logs").insert(entry);
  } catch (err) {
    console.error("sso-partner-callback: failed to log attempt", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { success: false, error: "method_not_allowed" });
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  const userAgent = req.headers.get("user-agent");

  // 1. Auth header validation
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!PARTNER_SSO_TOKEN || !provided || provided !== PARTNER_SSO_TOKEN) {
    return json(401, { success: false, error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Parse and validate payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "invalid_json" });
  }

  const tenantExternalId = typeof body.tenant_external_id === "string"
    ? body.tenant_external_id.trim()
    : "";
  const partnerId = typeof body.partner_id === "string"
    ? body.partner_id.trim()
    : "";
  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const tenantRoleRaw = typeof body.tenant_role === "string"
    ? body.tenant_role.trim().toLowerCase()
    : "";
  const VALID_ROLES = [
    "owner",
    "administrador",
    "manager",
    "marketer",
    "asesor",
    "readonly",
  ];
  const incomingRole = VALID_ROLES.includes(tenantRoleRaw) ? tenantRoleRaw : null;

  if (!tenantExternalId || !partnerId || !email) {
    await logAttempt(supabase, {
      email: email || "unknown",
      partner_id: partnerId || null,
      tenant_external_id: tenantExternalId || null,
      tenant_id: null,
      success: false,
      error_reason: "missing_fields",
      ip,
      user_agent: userAgent,
    });
    return json(400, {
      success: false,
      error: "Missing required fields: tenant_external_id, partner_id, email",
    });
  }

  // 3a. Locate tenant by (external_id, partner_id)
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, name, partner_id, external_id, status")
    .eq("external_id", tenantExternalId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (tenantErr) {
    console.error("sso-partner-callback: tenant lookup failed", tenantErr);
    await logAttempt(supabase, {
      email,
      partner_id: partnerId,
      tenant_external_id: tenantExternalId,
      tenant_id: null,
      success: false,
      error_reason: "tenant_lookup_error",
      ip,
      user_agent: userAgent,
    });
    return json(500, { success: false, error: "tenant_lookup_failed" });
  }

  if (!tenant) {
    await logAttempt(supabase, {
      email,
      partner_id: partnerId,
      tenant_external_id: tenantExternalId,
      tenant_id: null,
      success: false,
      error_reason: "tenant_not_found",
      ip,
      user_agent: userAgent,
    });
    return json(404, {
      success: false,
      error: "Tenant no encontrado para el partner indicado",
    });
  }

  // 3b. Validate the user already exists in this tenant (no creation).
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, status, tenant_id")
    .eq("tenant_id", tenant.id)
    .ilike("email", email)
    .maybeSingle();

  if (profileErr) {
    console.error("sso-partner-callback: profile lookup failed", profileErr);
    await logAttempt(supabase, {
      email,
      partner_id: partnerId,
      tenant_external_id: tenantExternalId,
      tenant_id: tenant.id,
      success: false,
      error_reason: "profile_lookup_error",
      ip,
      user_agent: userAgent,
    });
    return json(500, { success: false, error: "profile_lookup_failed" });
  }

  if (!profile) {
    await logAttempt(supabase, {
      email,
      partner_id: partnerId,
      tenant_external_id: tenantExternalId,
      tenant_id: tenant.id,
      success: false,
      error_reason: "user_not_registered",
      ip,
      user_agent: userAgent,
    });
    return json(403, {
      success: false,
      error: "Acceso denegado: Usuario no registrado en la plataforma",
    });
  }

  if (profile.status && profile.status !== "active") {
    await logAttempt(supabase, {
      email,
      partner_id: partnerId,
      tenant_external_id: tenantExternalId,
      tenant_id: tenant.id,
      success: false,
      error_reason: "user_inactive",
      ip,
      user_agent: userAgent,
    });
    return json(403, {
      success: false,
      error: "Acceso denegado: Usuario inactivo",
    });
  }

  // Sync the tenant_role from the partner payload (if provided & valid) so
  // the Core remains the source of truth for roles. Falls back to keeping
  // whatever role the user already has.
  if (incomingRole) {
    try {
      await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: profile.id,
            global_role: "user",
            tenant_role: incomingRole,
          },
          { onConflict: "user_id" },
        );
    } catch (err) {
      console.warn("sso-partner-callback: could not sync tenant_role", err);
    }
  }

  // Mark profile as SSO-provisioned so the admin UI hides "pending activation".
  try {
    await supabase
      .from("profiles")
      .update({ provisioned_via: "sso", first_login_required: false })
      .eq("id", profile.id)
      .is("provisioned_via", null);
  } catch (_) { /* ignore */ }

  // 4. Resolve partner domain to build the post-login redirect URL.
  let appOrigin = FALLBACK_APP_ORIGIN;
  try {
    const { data: partnerRow } = await supabase
      .from("partners")
      .select("primary_domain")
      .eq("id", partnerId)
      .maybeSingle();
    const domain = (partnerRow?.primary_domain ?? "").trim();
    if (domain) {
      appOrigin = domain.startsWith("http") ? domain : `https://${domain}`;
    }
  } catch (err) {
    console.warn("sso-partner-callback: partner domain lookup failed", err);
  }

  // Always redirect to the root of the partner domain (e.g. https://app.brokia24.com/)
  const redirectUrl = new URL(REDIRECT_PATH, appOrigin).toString();

  // Ensure the auth user has SSO metadata flags so the frontend never asks
  // them to complete signup or set a password.
  try {
    const { data: existing } = await supabase.auth.admin.getUserById(profile.id);
    const meta = (existing?.user?.user_metadata ?? {}) as Record<string, unknown>;
    if (!meta.sso_user || !meta.provisioned_via || !meta.email_confirmed) {
      await supabase.auth.admin.updateUserById(profile.id, {
        user_metadata: {
          ...meta,
          provisioned_via: meta.provisioned_via ?? "sso",
          sso_user: true,
          email_confirmed: true,
        },
      });
    }
  } catch (err) {
    console.warn("sso-partner-callback: could not refresh sso metadata", err);
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin
    .generateLink({
      type: "magiclink",
      email: profile.email,
      options: { redirectTo: redirectUrl },
    });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("sso-partner-callback: magic link generation failed", linkErr);
    await logAttempt(supabase, {
      email,
      partner_id: partnerId,
      tenant_external_id: tenantExternalId,
      tenant_id: tenant.id,
      success: false,
      error_reason: "link_generation_failed",
      ip,
      user_agent: userAgent,
    });
    return json(500, { success: false, error: "link_generation_failed" });
  }

  // Force the redirect_to parameter to the partner domain. Supabase Auth
  // silently falls back to the default Site URL when the requested
  // redirectTo is not in the allow-list, so we rewrite it on the action_link.
  let finalActionLink = linkData.properties.action_link;
  try {
    const parsed = new URL(finalActionLink);
    parsed.searchParams.set("redirect_to", redirectUrl);
    finalActionLink = parsed.toString();
  } catch (err) {
    console.warn("sso-partner-callback: could not rewrite redirect_to", err);
  }

  // 6. Audit success
  await logAttempt(supabase, {
    email,
    partner_id: partnerId,
    tenant_external_id: tenantExternalId,
    tenant_id: tenant.id,
    success: true,
    error_reason: null,
    ip,
    user_agent: userAgent,
  });

  // Best-effort security_events entry, mirroring auth-sso.
  try {
    await supabase.from("security_events").insert({
      tenant_id: tenant.id,
      user_id: profile.id,
      event_type: "partner_sso_login",
      metadata: {
        source: "sso-partner-callback",
        email: profile.email,
        partner_id: partnerId,
        tenant_external_id: tenantExternalId,
        name: name || null,
      },
    });
  } catch (_) { /* ignore */ }

  // 5. Success response
  return json(200, {
    success: true,
    magic_link: finalActionLink,
  });
});
