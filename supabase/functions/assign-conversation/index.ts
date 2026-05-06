import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const conversation_id = String(body?.conversation_id || "");
    const agent_id = body?.agent_id ? String(body.agent_id) : null;
    const reason = body?.reason ? String(body.reason).slice(0, 500) : null;
    const auto = Boolean(body?.auto);

    if (!conversation_id) {
      return json({ error: "conversation_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Auto = trigger automatic assignment using full priority logic
    if (auto) {
      // Verify caller is manager/admin or super admin
      const { data: roles } = await admin
        .from("user_roles")
        .select("global_role, tenant_role")
        .eq("user_id", userData.user.id);
      const isAllowed = roles?.some(
        (r) =>
          r.global_role === "super_admin" ||
          ["administrador", "manager"].includes(r.tenant_role || ""),
      );
      if (!isAllowed) return json({ error: "FORBIDDEN" }, 403);

      const { data, error } = await admin.rpc("fn_assign_conversation", {
        p_conversation_id: conversation_id,
        p_force_strategy: null,
        p_force_agent_id: null,
        p_assigned_by: userData.user.id,
        p_reason: reason || "manual_auto_trigger",
      });
      if (error) return json({ error: error.message }, 400);
      return json({ data: data?.[0] ?? null });
    }

    if (!agent_id) {
      return json({ error: "agent_id required" }, 400);
    }

    // Manual: use SECURITY DEFINER wrapper that enforces caller permissions
    const { data, error } = await userClient.rpc("fn_reassign_conversation", {
      p_conversation_id: conversation_id,
      p_agent_id: agent_id,
      p_reason: reason,
    });
    if (error) return json({ error: error.message }, 400);
    const row = data?.[0];
    if (!row?.success) {
      return json({ error: row?.error_code || "FAILED", data: row }, 400);
    }
    return json({ data: row });
  } catch (e) {
    console.error("assign-conversation error", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}