import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Verifies that the tenant's configured WhatsApp Sender is approved in Twilio.
 * Updates tenant_integrations with the latest sender status so the rest of the
 * platform (campaigns, manual sends) can short-circuit when not approved.
 *
 * Body:
 *  - tenant_id?: string (defaults to caller's tenant)
 *
 * Returns:
 *  { ok, status, phone_number, error?, verified_at }
 *  HTTP 200 on success, 4xx on auth/validation errors.
 */

function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  return p.replace(/[^\d+]/g, "").replace(/^whatsapp:/i, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    let tenantId: string | null = body?.tenant_id || null;

    // Default to caller's tenant
    if (!tenantId) {
      const { data: prof } = await admin
        .from("profiles")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .maybeSingle();
      tenantId = prof?.tenant_id ?? null;
    }
    if (!tenantId) return json({ error: "TENANT_NOT_FOUND" }, 400);

    // Authorization: super admin or manager/admin of this tenant
    const { data: roles } = await admin
      .from("user_roles")
      .select("global_role, tenant_role, user_id")
      .eq("user_id", userData.user.id);
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    const isSuper = roles?.some((r) => r.global_role === "super_admin");
    const isMgr = roles?.some((r) =>
      ["administrador", "manager"].includes(r.tenant_role || "")
    );
    if (!isSuper && !(isMgr && callerProfile?.tenant_id === tenantId)) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    // Load integration
    const { data: integration } = await admin
      .from("tenant_integrations")
      .select(
        "id, account_sid, auth_token_encrypted, phone_number, messaging_service_sid",
      )
      .eq("tenant_id", tenantId)
      .eq("provider", "twilio")
      .maybeSingle();

    if (!integration) {
      return json({ ok: false, error: "NO_INTEGRATION" }, 200);
    }
    if (!integration.account_sid || !integration.auth_token_encrypted) {
      return json({ ok: false, error: "MISSING_CREDENTIALS" }, 200);
    }
    if (!integration.phone_number) {
      // Messaging Service flows don't require sender check here
      const result = {
        ok: true,
        status: "messaging_service",
        phone_number: null,
        verified_at: new Date().toISOString(),
      };
      await admin
        .from("tenant_integrations")
        .update({
          whatsapp_sender_status: "messaging_service",
          whatsapp_sender_verified_at: result.verified_at,
          whatsapp_sender_error: null,
        })
        .eq("id", integration.id);
      return json(result, 200);
    }

    const accountSid = integration.account_sid;
    const authToken = atob(integration.auth_token_encrypted);
    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    const headers = { Authorization: `Basic ${twilioAuth}` };

    const target = normalizePhone(integration.phone_number);


    let matchedStatus: string | null = null;
    let errorMessage: string | null = null;

    // Fetch all WhatsApp senders (Messaging v2 Channels/Senders API)
    const sendersRes = await fetch(
      `https://messaging.twilio.com/v2/Channels/Senders?PageSize=100`,
      { headers },
    );

    if (sendersRes.ok) {
      const sendersData = await sendersRes.json();
      const list: Array<{ sender_id?: string; status?: string }> =
        sendersData?.senders ?? [];
      // sender_id format: "whatsapp:+15017122661"
      const match = list.find((s) => {
        const id = (s.sender_id || "").replace(/^whatsapp:/i, "");
        return normalizePhone(id) === target;
      });
      if (match) {
        matchedStatus = (match.status || "unknown").toLowerCase();
      } else {
        matchedStatus = "not_found";
        errorMessage =
          `El número ${integration.phone_number} no aparece como WhatsApp Sender en esta cuenta de Twilio.`;
      }
    } else {
      const txt = await sendersRes.text().catch(() => "");
      errorMessage =
        `Twilio respondió ${sendersRes.status} al consultar WhatsApp Senders: ${txt.slice(0, 200)}`;
      matchedStatus = "error";
    }

    const verifiedAt = new Date().toISOString();
    await admin
      .from("tenant_integrations")
      .update({
        whatsapp_sender_status: matchedStatus,
        whatsapp_sender_verified_at: verifiedAt,
        whatsapp_sender_error: errorMessage,
      })
      .eq("id", integration.id);

    const isApproved = matchedStatus === "online" ||
      matchedStatus === "approved" || matchedStatus === "verified";

    return json({
      ok: isApproved,
      status: matchedStatus,
      phone_number: integration.phone_number,
      error: errorMessage,
      verified_at: verifiedAt,
    }, 200);
  } catch (e) {
    console.error("verify-whatsapp-sender error", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}