import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v21.0";

interface RequestBody {
  access_token: string;
  action: "validate" | "connect" | "list_accounts";
  ad_account_id?: string;
  ad_account_name?: string;
  pixel_id?: string | null;
  pixel_name?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// TODO: replace with strong encryption (pgcrypto / KMS) in a future phase.
function encryptToken(token: string): string {
  const salt = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(0, 16);
  return btoa(`${salt}::${token}`);
}

function mapMetaError(errMsg: string): string {
  const m = errMsg.toLowerCase();
  if (m.includes("expired") || m.includes("session has expired")) {
    return "El token ha expirado. Genera uno nuevo en Meta.";
  }
  if (m.includes("permission") || m.includes("ads_management") || m.includes("ads_read")) {
    return "El token no tiene permisos de ads_management.";
  }
  if (m.includes("invalid")) {
    return "Token inválido.";
  }
  return errMsg || "Error al validar el token con Meta.";
}

async function metaGet(path: string, token: string, fields: string) {
  const url = `${META_API}${path}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    // Verify role + tenant
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return json({ error: "Usuario sin tenant asociado" }, 403);
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("tenant_role, global_role")
      .eq("user_id", userId)
      .maybeSingle();

    const isSuperAdmin = roleRow?.global_role === "super_admin";
    const tenantRole = roleRow?.tenant_role;
    if (!isSuperAdmin && tenantRole !== "administrador" && tenantRole !== "manager") {
      return json({ error: "No tienes permisos para gestionar Meta Ads" }, 403);
    }

    const tenantId = profile.tenant_id;
    const body = (await req.json()) as RequestBody;

    if (body?.action !== "list_accounts" && (!body?.access_token || typeof body.access_token !== "string")) {
      return json({ valid: false, error: "Access token requerido" }, 400);
    }

    if (body.action === "list_accounts") {
      const { data: conn } = await admin
        .from("meta_ads_connections")
        .select("access_token_encrypted")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .maybeSingle();
      if (!conn?.access_token_encrypted) {
        return json({ error: "No hay cuenta conectada" }, 400);
      }
      const salt = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(0, 16);
      const decrypted = atob(conn.access_token_encrypted);
      const accessToken = decrypted.replace(`${salt}::`, "");
      let adAccounts: any[] = [];
      try {
        const accounts = await metaGet(
          "/me/adaccounts",
          accessToken,
          "id,name,account_status,currency,timezone_name",
        );
        adAccounts = (accounts?.data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          status: a.account_status,
          currency: a.currency,
          timezone: a.timezone_name,
        }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: mapMetaError(msg) }, 400);
      }
      return json({ ad_accounts: adAccounts });
    }

    // Validate token via /me
    let meData: { id: string; name: string };
    try {
      if (body.action === "connect" && body.access_token === "__use_stored__") {
        meData = { id: "", name: "" };
      } else {
        meData = await metaGet("/me", body.access_token, "id,name");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ valid: false, error: mapMetaError(msg) }, 200);
    }

    if (body.action === "validate") {
      let adAccounts: any[] = [];
      let pixels: any[] = [];
      try {
        const accounts = await metaGet(
          "/me/adaccounts",
          body.access_token,
          "id,name,account_status,currency,timezone_name",
        );
        adAccounts = (accounts?.data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          status: a.account_status,
          currency: a.currency,
          timezone: a.timezone_name,
        }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ valid: false, error: mapMetaError(msg) }, 200);
      }

      try {
        const px = await metaGet("/me/adspixels", body.access_token, "id,name");
        pixels = (px?.data || []).map((p: any) => ({ id: p.id, name: p.name }));
      } catch {
        pixels = [];
      }

      return json({
        valid: true,
        meta_user: { id: meData.id, name: meData.name },
        ad_accounts: adAccounts,
        pixels,
      });
    }

    if (body.action === "connect") {
      if (!body.ad_account_id || !body.ad_account_name) {
        return json({ success: false, error: "Cuenta publicitaria requerida" }, 400);
      }

      if (body.access_token === "__use_stored__") {
        const { data: conn } = await admin
          .from("meta_ads_connections")
          .select("id")
          .eq("tenant_id", tenantId)
          .neq("status", "disconnected")
          .maybeSingle();
        if (!conn?.id) {
          return json({ success: false, error: "No hay token guardado" }, 400);
        }
        const { error: updateErr } = await admin
          .from("meta_ads_connections")
          .update({
            ad_account_id: body.ad_account_id,
            ad_account_name: body.ad_account_name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);
        if (updateErr) {
          return json({ success: false, error: updateErr.message }, 500);
        }
        await admin.from("security_events").insert({
          event_type: "meta_ads_account_changed",
          user_id: userId,
          tenant_id: tenantId,
          metadata: {
            new_account_id: body.ad_account_id,
            new_account_name: body.ad_account_name,
          },
        });
        return json({ success: true });
      }

      const encrypted = encryptToken(body.access_token);
      const now = new Date().toISOString();

      const payload = {
        tenant_id: tenantId,
        access_token_encrypted: encrypted,
        ad_account_id: body.ad_account_id,
        ad_account_name: body.ad_account_name,
        pixel_id: body.pixel_id ?? null,
        pixel_name: body.pixel_name ?? null,
        status: "connected" as const,
        meta_user_id: meData.id,
        meta_user_name: meData.name,
        connected_by: userId,
        connected_at: now,
        last_validated_at: now,
        error_message: null,
      };

      const { data: existing } = await admin
        .from("meta_ads_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .neq("status", "disconnected")
        .maybeSingle();

      let writeErr: { message: string } | null = null;
      if (existing?.id) {
        const { error } = await admin
          .from("meta_ads_connections")
          .update(payload)
          .eq("id", existing.id);
        writeErr = error;
      } else {
        const { error } = await admin
          .from("meta_ads_connections")
          .insert(payload);
        writeErr = error;
      }

      if (writeErr) {
        return json({ success: false, error: writeErr.message }, 500);
      }

      await admin.from("security_events").insert({
        event_type: "meta_ads_connected",
        user_id: userId,
        tenant_id: tenantId,
        metadata: {
          ad_account_id: body.ad_account_id,
          meta_user_name: meData.name,
        },
      });

      return json({ success: true });
    }

    return json({ error: "Acción no soportada" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return json({ error: msg }, 500);
  }
});