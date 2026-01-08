/**
 * Public API token authentication (Bearer).
 * - Authorization: Bearer <token>
 * - sha256(token) -> api_tokens.token_hash lookup
 * - validates is_active, expires_at
 * - validates required scopes
 * - updates last_used_at (best-effort)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type TokenAuthResult =
  | { ok: true; tenant_id: string; token_id: string; scopes: string[] }
  | { ok: false; status: number; error: string };

// SHA-256 hash using Web Crypto API (available in Deno)
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateBearerToken(opts: {
  authorizationHeader?: string | null;
  requiredScopes?: string[];
}): Promise<TokenAuthResult> {
  const header = opts.authorizationHeader || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "Missing Bearer token" };

  const rawToken = match[1].trim();
  if (!rawToken || rawToken.length < 20) {
    return { ok: false, status: 401, error: "Invalid token" };
  }

  const token_hash = await sha256(rawToken);

  // Use service role to bypass RLS for token lookup
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabaseAdmin
    .from("api_tokens")
    .select("id, tenant_id, scopes, is_active, expires_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 401, error: "Unauthorized" };
  if (!data.is_active) return { ok: false, status: 401, error: "Token disabled" };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Token expired" };
  }

  const scopes = (data.scopes || []) as string[];
  const required = opts.requiredScopes || [];
  const missing = required.filter((s) => !scopes.includes(s));
  if (missing.length) {
    return { ok: false, status: 403, error: `Missing scopes: ${missing.join(", ")}` };
  }

  // best-effort last_used_at update
  supabaseAdmin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { ok: true, tenant_id: data.tenant_id, token_id: data.id, scopes };
}

// Helper to generate secure token
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Convert to base64url
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper to hash a token for storage
export async function hashToken(token: string): Promise<string> {
  return sha256(token);
}
