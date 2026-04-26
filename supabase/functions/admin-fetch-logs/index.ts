import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_REF = "ozsgtszxvojvqszpphmj";

async function querySupabaseAnalytics(sql: string) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
  const token = Deno.env.get("SUPABASE_MANAGEMENT_TOKEN");
  if (!token) {
    throw new Error("MISSING_MANAGEMENT_TOKEN");
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analytics API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data?.result || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("global_role")
      .eq("user_id", user.id)
      .single();

    if (roleRow?.global_role !== "super_admin") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, limit = 100 } = await req.json();
    const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 500);

    let logs: any[] = [];

    if (type === "edge") {
      const sql = `
        select id, function_edge_logs.timestamp, event_message,
               response.status_code, request.method,
               m.function_id, m.execution_time_ms
        from function_edge_logs
          cross join unnest(metadata) as m
          cross join unnest(m.response) as response
          cross join unnest(m.request) as request
        order by timestamp desc
        limit ${safeLimit}
      `;
      try {
        const rows = await querySupabaseAnalytics(sql);
        logs = rows.map((r: any) => ({
          id: r.id,
          timestamp: r.timestamp,
          event_message: r.event_message,
          status_code: r.status_code,
          method: r.method,
          function_id: r.function_id,
          execution_time_ms: r.execution_time_ms,
        }));
      } catch (e: any) {
        return new Response(JSON.stringify({
          success: true,
          logs: [],
          warning: "Analytics no disponible: " + e.message,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (type === "database") {
      const sql = `
        select identifier, postgres_logs.timestamp, id, event_message,
               parsed.error_severity
        from postgres_logs
          cross join unnest(metadata) as m
          cross join unnest(m.parsed) as parsed
        order by timestamp desc
        limit ${safeLimit}
      `;
      try {
        const rows = await querySupabaseAnalytics(sql);
        logs = rows.map((r: any) => ({
          id: r.id,
          timestamp: r.timestamp,
          event_message: r.event_message,
          identifier: r.identifier,
          error_severity: r.error_severity,
        }));
      } catch (e: any) {
        return new Response(JSON.stringify({
          success: true,
          logs: [],
          warning: "Analytics no disponible: " + e.message,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ success: false, error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-fetch-logs error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});