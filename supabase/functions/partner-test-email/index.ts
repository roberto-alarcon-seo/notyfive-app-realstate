import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailBody {
  partner_id: string;
  to_email: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "missing_env" }, 500);
  }

  // Verify the caller's JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: "invalid_token" }, 401);
  }
  const userId = userData.user.id;

  let body: TestEmailBody;
  try {
    body = (await req.json()) as TestEmailBody;
  } catch (_) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!body?.partner_id || !body?.to_email) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to_email)) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }

  // Service-role client for privileged read of resend_api_key + role check
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify caller is super_admin and (global OR partner_scope === partner_id)
  const { data: roleRow, error: roleError } = await adminClient
    .from("user_roles")
    .select("global_role, partner_scope")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError || !roleRow) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  if (roleRow.global_role !== "super_admin") {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  if (roleRow.partner_scope && roleRow.partner_scope !== body.partner_id) {
    return jsonResponse({ error: "partner_scope_mismatch" }, 403);
  }

  // Load partner credentials
  const { data: partner, error: partnerError } = await adminClient
    .from("partners")
    .select("id, name, resend_api_key, resend_from_email, email_sender_name")
    .eq("id", body.partner_id)
    .maybeSingle();

  if (partnerError || !partner) {
    return jsonResponse({ error: "partner_not_found" }, 404);
  }

  if (!partner.resend_api_key || !partner.resend_from_email) {
    return jsonResponse({ error: "resend_not_configured" }, 400);
  }

  const fromName = partner.email_sender_name || partner.name;
  const fromAddress = partner.resend_from_email;

  // Send test email via Resend
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${partner.resend_api_key}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [body.to_email],
        subject: `Prueba de conexión – ${partner.name}`,
        html: `<div style="font-family:Arial,sans-serif;padding:24px;">
          <h2>Prueba exitosa ✅</h2>
          <p>Esta es una prueba de tu integración con Resend para <strong>${partner.name}</strong>.</p>
          <p>Si recibiste este correo, tu API key y dominio remitente están configurados correctamente.</p>
        </div>`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return jsonResponse(
        {
          error: "resend_api_error",
          status: response.status,
          details: data,
        },
        400,
      );
    }

    return jsonResponse({ success: true, message_id: data?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return jsonResponse({ error: "request_failed", message }, 500);
  }
});