import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateBearerToken } from "../_shared/tokenAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = await authenticateBearerToken({
      authorizationHeader: req.headers.get("authorization"),
      requiredScopes: ["fields:read"],
    });

    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get field definitions
    const { data: defs, error: defsErr } = await supabaseAdmin
      .from("contact_custom_fields")
      .select("id, name, key, data_type, is_required, is_visible_in_list, sort_order")
      .eq("tenant_id", auth.tenant_id)
      .order("sort_order", { ascending: true });

    if (defsErr) throw new Error(defsErr.message);

    // Get options for select fields
    const selectIds = (defs || []).filter((d) => d.data_type === "select").map((d) => d.id);
    let optionsByField: Record<string, { label: string; value: string }[]> = {};

    if (selectIds.length) {
      const { data: options } = await supabaseAdmin
        .from("contact_custom_field_options")
        .select("field_id, label, value, sort_order")
        .in("field_id", selectIds)
        .order("sort_order", { ascending: true });

      for (const o of options || []) {
        optionsByField[o.field_id] = optionsByField[o.field_id] || [];
        optionsByField[o.field_id].push({ label: o.label, value: o.value });
      }
    }

    const items = (defs || []).map((d) => ({
      id: d.id,
      name: d.name,
      key: d.key,
      data_type: d.data_type,
      is_required: d.is_required,
      is_visible_in_list: d.is_visible_in_list,
      sort_order: d.sort_order,
      options: d.data_type === "select" ? optionsByField[d.id] || [] : undefined,
    }));

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("public-contact-fields error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
