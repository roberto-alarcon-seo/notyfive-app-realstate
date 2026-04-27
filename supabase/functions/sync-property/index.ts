import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateBearerToken } from "../_shared/tokenAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await authenticateBearerToken({
      authorizationHeader: req.headers.get("Authorization"),
      requiredScopes: ["properties:write"],
    });
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    const tenant_id = auth.tenant_id;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const property_code = String(body.property_code || "").trim();
    if (!property_code) {
      return jsonResponse({ error: "property_code is required" }, 400);
    }
    const title = String(body.title || "").trim();
    const zone = String(body.zone || "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check existing for upsert behavior
    const { data: existing } = await supabase
      .from("properties")
      .select("id, metadata")
      .eq("tenant_id", tenant_id)
      .eq("property_code", property_code)
      .maybeSingle();

    // Build metadata: merge existing with new values (construction_year, estrato)
    const incomingMetadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};
    const construction_year = toIntOrNull(
      body.construction_year ?? incomingMetadata.construction_year,
    );
    const estrato = toIntOrNull(body.estrato ?? incomingMetadata.estrato);
    if (construction_year !== null) incomingMetadata.construction_year = construction_year;
    if (estrato !== null) incomingMetadata.estrato = estrato;

    const mergedMetadata = {
      ...((existing?.metadata as Record<string, unknown>) || {}),
      ...incomingMetadata,
    };

    const payload: Record<string, unknown> = {
      tenant_id,
      property_code,
      title: title || existing ? title || undefined : property_code,
      operation_type: body.operation_type ?? undefined,
      property_type: body.property_type ?? undefined,
      zone: zone || undefined,
      address: body.address ?? undefined,
      description: body.description ?? undefined,
      location_url: body.location_url ?? undefined,
      price: toNumberOrNull(body.price) ?? undefined,
      currency: body.currency ?? undefined,
      status: body.status ?? undefined,
      is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
      ai_prompt: body.ai_prompt ?? undefined,
      internal_notes: body.internal_notes ?? undefined,
      maintenance_fee: toNumberOrNull(body.maintenance_fee) ?? undefined,
      visit_availability: body.visit_availability ?? undefined,
      accepted_credits: Array.isArray(body.accepted_credits) ? body.accepted_credits : undefined,
      youtube_url: body.youtube_url ?? undefined,
      bedrooms: toIntOrNull(body.bedrooms) ?? undefined,
      bathrooms: toNumberOrNull(body.bathrooms) ?? undefined,
      parking_spots: toIntOrNull(body.parking_spots) ?? undefined,
      sq_meters: toNumberOrNull(body.sq_meters) ?? undefined,
      ai_description_template: body.ai_description_template ?? undefined,
      metadata: mergedMetadata,
    };

    // Strip undefined
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    let action: "created" | "updated";
    let resultId: string;

    if (existing) {
      const { data, error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      action = "updated";
      resultId = data.id;
    } else {
      // For inserts ensure required NOT NULL fields
      if (!title) return jsonResponse({ error: "title is required for new properties" }, 400);
      if (!zone) return jsonResponse({ error: "zone is required for new properties" }, 400);
      payload.title = title;
      payload.zone = zone;
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      action = "created";
      resultId = data.id;
    }

    return jsonResponse({ ok: true, action, id: resultId, property_code });
  } catch (e) {
    console.error("sync-property error", e);
    return jsonResponse({ error: (e as Error).message || "Internal error" }, 500);
  }
});
