// SSO Edge Function: Validates JWT from Core system and issues a magic link
// for seamless login into the CRM.
//
// Flow:
//   GET /functions/v1/auth-sso?token=<JWT>&redirect=<optional-path>
//   1. Verify HMAC-SHA256 signature using SSO_SECRET (shared with Core).
//   2. Validate `exp` claim.
//   3. Look up tenant by `tenant_external_id` and profile by `email`.
//   4. Generate a Supabase magic link for that user and 302-redirect there.
//   5. On any failure, redirect to `/auth?error=sso_denied&reason=<code>`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SSO_SECRET = Deno.env.get("SSO_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- JWT (HS256) verification ----------
function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function verifyJwtHs256(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(bytesToString(base64UrlDecode(headerB64))) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== "HS256") return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(bytesToString(base64UrlDecode(payloadB64)));
    if (typeof payload !== "object" || payload === null) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    if (typeof payload.nbf === "number" && payload.nbf > now) return null;

    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------- Helpers ----------
function appOrigin(req: Request): string {
  // Prefer the Origin / Referer of the caller so we redirect back to the same
  // domain the user came from (preview, prod, custom domain).
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }
  // Last resort: use a query param. Otherwise default to published URL.
  return "https://notyfive-app-realstate.lovable.app";
}

function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

function denyRedirect(origin: string, reason: string): Response {
  // Send unauthenticated SSO failures to the public landing page.
  // Tenant users do not have a manual login surface — `/welcome`
  // explains how to access the CRM and surfaces the error.
  const url = new URL("/welcome", origin);
  url.searchParams.set("error", "sso_denied");
  url.searchParams.set("reason", reason);
  return redirectTo(url.toString());
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const origin = appOrigin(req);

  if (!SSO_SECRET) {
    console.error("auth-sso: SSO_SECRET is not configured");
    return denyRedirect(origin, "server_misconfigured");
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const finalRedirect = url.searchParams.get("redirect") || "/";
  const mode = url.searchParams.get("mode") || "";

  if (!token) {
    return denyRedirect(origin, "missing_token");
  }

  const claims = await verifyJwtHs256(token, SSO_SECRET);
  if (!claims) {
    return denyRedirect(origin, "invalid_token");
  }

  const email = typeof claims.email === "string"
    ? (claims.email as string).trim().toLowerCase()
    : "";
  const tenantExternalId = typeof claims.tenant_external_id === "string"
    ? (claims.tenant_external_id as string).trim()
    : "";
  const tenantIdClaim = typeof claims.tenant_id === "string"
    ? (claims.tenant_id as string).trim()
    : "";

  if (!email || (!tenantExternalId && !tenantIdClaim)) {
    return denyRedirect(origin, "invalid_claims");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Resolve tenant by external_id, with tenant_id fallback (impersonation)
  let tenantQuery = supabase
    .from("tenants")
    .select("id, name, status");
  tenantQuery = tenantExternalId
    ? tenantQuery.eq("external_id", tenantExternalId)
    : tenantQuery.eq("id", tenantIdClaim);
  const { data: tenant, error: tenantErr } = await tenantQuery.maybeSingle();

  if (tenantErr || !tenant) {
    console.warn("auth-sso: tenant not found", {
      tenantExternalId,
      tenantIdClaim,
      tenantErr,
    });
    return denyRedirect(origin, "tenant_not_found");
  }

  // 2. Resolve profile by email + tenant
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, status, tenant_id")
    .eq("tenant_id", tenant.id)
    .ilike("email", email)
    .maybeSingle();

  if (profileErr || !profile) {
    console.warn("auth-sso: profile not found", { email, tenantId: tenant.id });
    return denyRedirect(origin, "user_not_found");
  }

  const isAdminImpersonation = mode === "impersonation"
    || claims.purpose === "admin_impersonation";

  if (profile.status && profile.status !== "active" && !isAdminImpersonation) {
    return denyRedirect(origin, "user_inactive");
  }

  // 3. Generate magic link via Supabase Admin API
  const redirectUrl = new URL(finalRedirect, origin).toString();

  const { data: linkData, error: linkErr } = await supabase.auth.admin
    .generateLink({
      type: "magiclink",
      email: profile.email,
      options: { redirectTo: redirectUrl },
    });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("auth-sso: failed to generate magic link", linkErr);
    return denyRedirect(origin, "link_generation_failed");
  }

  // Audit (best-effort, ignore failures)
  try {
    await supabase.from("security_events").insert({
      tenant_id: tenant.id,
      user_id: profile.id,
      event_type: "sso_login",
      metadata: {
        source: "core",
        email: profile.email,
        tenant_external_id: tenantExternalId,
      },
    });
  } catch (_) { /* ignore */ }

  return redirectTo(linkData.properties.action_link);
});
