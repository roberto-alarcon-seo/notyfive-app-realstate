import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateBearerToken } from "../_shared/tokenAuth.ts";
import { normalizeMxWhatsappPhone, normalizeTags, normalizeCustomValue } from "../_shared/valueNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FieldDef = {
  id: string;
  key: string;
  data_type: string;
  is_required: boolean;
};

type FieldOption = {
  field_id: string;
  label: string;
  value: string;
};

type CustomFieldResult = {
  ok: true;
  saved: Record<string, string | null>;
  warnings: string[];
} | {
  ok: false;
  errors: Record<string, string>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  try {
    // Handle upsert endpoint
    if (lastPart === "public-contacts:upsert" && req.method === "POST") {
      const auth = await authenticateBearerToken({
        authorizationHeader: req.headers.get("authorization"),
        requiredScopes: ["contacts:write"],
      });
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const matchPhone = body?.match?.phone ? normalizeMxWhatsappPhone(body.match.phone) : null;
      const matchEmail = body?.match?.email ? String(body.match.email).trim() : null;
      
      if (!matchPhone && !matchEmail) {
        return new Response(JSON.stringify({ error: "match.phone or match.email is required" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find existing contact
      let findQuery = supabaseAdmin
        .from("contacts")
        .select("*")
        .eq("tenant_id", auth.tenant_id)
        .neq("status", "deleted")
        .limit(1);
      
      if (matchPhone) findQuery = findQuery.eq("phone", matchPhone);
      else if (matchEmail) findQuery = findQuery.eq("email", matchEmail);

      const { data: existing } = await findQuery.maybeSingle();

      const data = body?.data || {};
      const name = data?.name ? String(data.name).trim() : "";
      const patch: Record<string, unknown> = {};
      if (data?.name !== undefined) patch.name = name;
      if (data?.email !== undefined) patch.email = data.email ? String(data.email).trim() : null;
      if (data?.phone !== undefined) patch.phone = normalizeMxWhatsappPhone(data.phone);
      if (data?.country !== undefined) patch.country = data.country ? String(data.country).trim() : null;
      if (data?.tags !== undefined) patch.tags = normalizeTags(data.tags);
      if (data?.notes !== undefined) patch.notes = data.notes ? String(data.notes) : null;
      if (data?.status !== undefined) patch.status = String(data.status);

      if (!existing) {
        if (!name) {
          return new Response(JSON.stringify({ error: "data.name is required when creating" }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: created, error: createErr } = await supabaseAdmin
          .from("contacts")
          .insert({
            tenant_id: auth.tenant_id,
            name,
            email: patch.email ?? null,
            phone: patch.phone ?? matchPhone,
            country: patch.country ?? null,
            tags: patch.tags ?? null,
            notes: patch.notes ?? null,
            status: patch.status ?? "active",
          })
          .select("*")
          .single();
        
        if (createErr) throw new Error(createErr.message);
        console.log("[public-contacts] upsert contact created:", (created as { id: string }).id);
        
        // Handle custom fields
        const custom = data?.custom && typeof data.custom === "object" ? data.custom : {};
        let customResult: CustomFieldResult = { ok: true, saved: {}, warnings: [] };
        
        if (Object.keys(custom).length) {
          customResult = await processCustomFields(supabaseAdmin, auth.tenant_id, (created as { id: string }).id, custom, true);
          if (!customResult.ok) {
            return new Response(JSON.stringify({ error: "Validation error", fields: customResult.errors }), {
              status: 422,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.log(`[public-contacts] upsert custom fields ok (${Object.keys(customResult.saved).length} saved, ${customResult.warnings.length} warnings)`);
        }
        
        return new Response(JSON.stringify({ 
          mode: "created", 
          contact: created,
          custom: customResult.ok ? customResult.saved : {},
          warnings: customResult.ok ? customResult.warnings : [],
        }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update existing
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("contacts")
        .update(patch)
        .eq("tenant_id", auth.tenant_id)
        .eq("id", (existing as { id: string }).id)
        .select("*")
        .single();
      
      if (updateErr) throw new Error(updateErr.message);
      console.log("[public-contacts] upsert contact updated:", (existing as { id: string }).id);
      
      // Handle custom fields
      const custom = data?.custom && typeof data.custom === "object" ? data.custom : {};
      let customResult: CustomFieldResult = { ok: true, saved: {}, warnings: [] };
      
      if (Object.keys(custom).length) {
        customResult = await processCustomFields(supabaseAdmin, auth.tenant_id, (existing as { id: string }).id, custom);
        if (!customResult.ok) {
          return new Response(JSON.stringify({ error: "Validation error", fields: customResult.errors }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`[public-contacts] upsert custom fields ok (${Object.keys(customResult.saved).length} saved, ${customResult.warnings.length} warnings)`);
      }
      
      return new Response(JSON.stringify({ 
        mode: "updated", 
        contact: updated,
        custom: customResult.ok ? customResult.saved : {},
        warnings: customResult.ok ? customResult.warnings : [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we have an ID in path
    const contactId = pathParts.length > 1 && pathParts[pathParts.length - 1] !== "public-contacts" 
      ? pathParts[pathParts.length - 1] 
      : null;

    // GET single contact by ID
    if (req.method === "GET" && contactId && contactId !== "public-contacts") {
      const auth = await authenticateBearerToken({
        authorizationHeader: req.headers.get("authorization"),
        requiredScopes: ["contacts:read"],
      });
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: contact, error } = await supabaseAdmin
        .from("contacts")
        .select("*")
        .eq("tenant_id", auth.tenant_id)
        .eq("id", contactId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!contact) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get custom values with field keys
      const customByKey = await getCustomFieldsByKey(supabaseAdmin, auth.tenant_id, contactId);

      return new Response(JSON.stringify({ contact, custom: customByKey }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH single contact by ID
    if (req.method === "PATCH" && contactId && contactId !== "public-contacts") {
      const auth = await authenticateBearerToken({
        authorizationHeader: req.headers.get("authorization"),
        requiredScopes: ["contacts:write"],
      });
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("tenant_id", auth.tenant_id)
        .eq("id", contactId)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const patch: Record<string, unknown> = {};
      if (body?.name !== undefined) patch.name = String(body.name).trim();
      if (body?.email !== undefined) patch.email = body.email ? String(body.email).trim() : null;
      if (body?.phone !== undefined) patch.phone = normalizeMxWhatsappPhone(body.phone);
      if (body?.country !== undefined) patch.country = body.country ? String(body.country).trim() : null;
      if (body?.tags !== undefined) patch.tags = normalizeTags(body.tags);
      if (body?.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
      if (body?.status !== undefined) patch.status = String(body.status);

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("contacts")
        .update(patch)
        .eq("tenant_id", auth.tenant_id)
        .eq("id", contactId)
        .select("*")
        .single();

      if (updateErr) throw new Error(updateErr.message);
      console.log("[public-contacts] patch contact updated:", contactId);

      // Handle custom fields if provided
      const custom = body?.custom && typeof body.custom === "object" ? body.custom : null;
      let customResult: CustomFieldResult = { ok: true, saved: {}, warnings: [] };
      
      if (custom && Object.keys(custom).length) {
        customResult = await processCustomFields(supabaseAdmin, auth.tenant_id, contactId, custom);
        if (!customResult.ok) {
          return new Response(JSON.stringify({ error: "Validation error", fields: customResult.errors }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`[public-contacts] patch custom fields ok (${Object.keys(customResult.saved).length} saved, ${customResult.warnings.length} warnings)`);
      }

      // Get all custom values
      const customByKey = await getCustomFieldsByKey(supabaseAdmin, auth.tenant_id, contactId);

      return new Response(JSON.stringify({ 
        contact: updated, 
        custom: customByKey,
        warnings: customResult.ok ? customResult.warnings : [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET list contacts
    if (req.method === "GET") {
      const auth = await authenticateBearerToken({
        authorizationHeader: req.headers.get("authorization"),
        requiredScopes: ["contacts:read"],
      });
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const query = url.searchParams.get("query") || undefined;
      const status = url.searchParams.get("status") || undefined;
      const tag = url.searchParams.get("tag") || undefined;
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
      const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
      const include = (url.searchParams.get("include") || "").toLowerCase();
      const includeCustom = include.split(",").map(s => s.trim()).includes("custom");

      let q = supabaseAdmin
        .from("contacts")
        .select("*", { count: "exact" })
        .eq("tenant_id", auth.tenant_id);

      if (status) q = q.eq("status", status);
      if (tag) q = q.contains("tags", [tag]);
      if (query) {
        q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
      }

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      const items = data || [];
      const total = count || 0;
      
      // Optionally attach custom fields by key
      let finalItems: unknown[] = items;
      if (includeCustom && items.length > 0) {
        finalItems = await attachCustomFieldsByKey(supabaseAdmin, auth.tenant_id, items);
      }

      const nextOffset = offset + items.length;
      const hasMore = nextOffset < total;

      return new Response(JSON.stringify({
        items: finalItems,
        meta: {
          limit,
          offset,
          next_offset: hasMore ? nextOffset : null,
          has_more: hasMore,
          total,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST create contact or auto-detected upsert
    if (req.method === "POST") {
      const auth = await authenticateBearerToken({
        authorizationHeader: req.headers.get("authorization"),
        requiredScopes: ["contacts:write"],
      });
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      
      // Auto-detect UPSERT by body shape: { match: {...}, data: {...} }
      const hasUpsertShape =
        body &&
        typeof body === "object" &&
        body.match &&
        typeof body.match === "object" &&
        body.data &&
        typeof body.data === "object";

      // If upsert shape detected, handle as upsert
      if (hasUpsertShape) {
        const matchPhone = body?.match?.phone ? normalizeMxWhatsappPhone(body.match.phone) : null;
        const matchEmail = body?.match?.email ? String(body.match.email).trim() : null;
        
        if (!matchPhone && !matchEmail) {
          return new Response(JSON.stringify({ error: "match.phone or match.email is required" }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find existing contact
        let findQuery = supabaseAdmin
          .from("contacts")
          .select("*")
          .eq("tenant_id", auth.tenant_id)
          .neq("status", "deleted")
          .limit(1);
        
        if (matchPhone) findQuery = findQuery.eq("phone", matchPhone);
        else if (matchEmail) findQuery = findQuery.eq("email", matchEmail);

        const { data: existing } = await findQuery.maybeSingle();

        const data = body?.data || {};
        const name = data?.name ? String(data.name).trim() : "";
        const patch: Record<string, unknown> = {};
        if (data?.name !== undefined) patch.name = name;
        if (data?.email !== undefined) patch.email = data.email ? String(data.email).trim() : null;
        if (data?.phone !== undefined) patch.phone = normalizeMxWhatsappPhone(data.phone);
        if (data?.country !== undefined) patch.country = data.country ? String(data.country).trim() : null;
        if (data?.tags !== undefined) patch.tags = normalizeTags(data.tags);
        if (data?.notes !== undefined) patch.notes = data.notes ? String(data.notes) : null;
        if (data?.status !== undefined) patch.status = String(data.status);

        if (!existing) {
          if (!name) {
            return new Response(JSON.stringify({ error: "data.name is required when creating" }), {
              status: 422,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data: created, error: createErr } = await supabaseAdmin
            .from("contacts")
            .insert({
              tenant_id: auth.tenant_id,
              name,
              email: patch.email ?? null,
              phone: patch.phone ?? matchPhone,
              country: patch.country ?? null,
              tags: patch.tags ?? null,
              notes: patch.notes ?? null,
              status: patch.status ?? "active",
            })
            .select("*")
            .single();
          
          if (createErr) throw new Error(createErr.message);
          console.log("[public-contacts] upsert contact created:", (created as { id: string }).id);
          
          // Handle custom fields for upsert create
          const custom = data?.custom && typeof data.custom === "object" ? data.custom : {};
          let customResult: CustomFieldResult = { ok: true, saved: {}, warnings: [] };
          
          if (Object.keys(custom).length) {
            customResult = await processCustomFields(supabaseAdmin, auth.tenant_id, (created as { id: string }).id, custom, true);
            if (!customResult.ok) {
              return new Response(JSON.stringify({ error: "Validation error", fields: customResult.errors }), {
                status: 422,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            console.log(`[public-contacts] upsert custom fields ok (${Object.keys(customResult.saved).length} saved, ${customResult.warnings.length} warnings)`);
          }
          
          return new Response(JSON.stringify({ 
            mode: "created", 
            contact: created,
            custom: customResult.ok ? customResult.saved : {},
            warnings: customResult.ok ? customResult.warnings : [],
          }), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update existing
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("contacts")
          .update(patch)
          .eq("tenant_id", auth.tenant_id)
          .eq("id", (existing as { id: string }).id)
          .select("*")
          .single();
        
        if (updateErr) throw new Error(updateErr.message);
        console.log("[public-contacts] upsert contact updated:", (existing as { id: string }).id);
        
        // Handle custom fields for upsert update
        const custom = data?.custom && typeof data.custom === "object" ? data.custom : {};
        let customResult: CustomFieldResult = { ok: true, saved: {}, warnings: [] };
        
        if (Object.keys(custom).length) {
          customResult = await processCustomFields(supabaseAdmin, auth.tenant_id, (existing as { id: string }).id, custom);
          if (!customResult.ok) {
            return new Response(JSON.stringify({ error: "Validation error", fields: customResult.errors }), {
              status: 422,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.log(`[public-contacts] upsert custom fields ok (${Object.keys(customResult.saved).length} saved, ${customResult.warnings.length} warnings)`);
        }
        
        return new Response(JSON.stringify({ 
          mode: "updated", 
          contact: updated,
          custom: customResult.ok ? customResult.saved : {},
          warnings: customResult.ok ? customResult.warnings : [],
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Standard CREATE flow
      const name = String(body?.name || "").trim();
      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phone = normalizeMxWhatsappPhone(body?.phone);
      const tags = normalizeTags(body?.tags);

      const { data: created, error: createErr } = await supabaseAdmin
        .from("contacts")
        .insert({
          tenant_id: auth.tenant_id,
          name,
          email: body?.email ? String(body.email).trim() : null,
          phone,
          country: body?.country ? String(body.country).trim() : null,
          tags,
          notes: body?.notes ? String(body.notes) : null,
          status: body?.status ? String(body.status) : "active",
        })
        .select("*")
        .single();

      if (createErr) throw new Error(createErr.message);
      console.log("[public-contacts] create contact ok:", (created as { id: string }).id);

      // Handle custom fields
      const custom = body?.custom && typeof body.custom === "object" ? body.custom : {};
      let customResult: CustomFieldResult = { ok: true, saved: {}, warnings: [] };
      
      if (Object.keys(custom).length) {
        customResult = await processCustomFields(supabaseAdmin, auth.tenant_id, (created as { id: string }).id, custom, true);
        if (!customResult.ok) {
          return new Response(JSON.stringify({ error: "Validation error", fields: customResult.errors }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`[public-contacts] create custom fields ok (${Object.keys(customResult.saved).length} saved, ${customResult.warnings.length} warnings)`);
      }

      return new Response(JSON.stringify({ 
        contact: created, 
        custom: customResult.ok ? customResult.saved : {},
        warnings: customResult.ok ? customResult.warnings : [],
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("[public-contacts] error:", err);
    const status = (err as { status?: number })?.status && Number.isFinite((err as { status?: number }).status) 
      ? (err as { status: number }).status 
      : 500;
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Get custom field values by key for a single contact
// deno-lint-ignore no-explicit-any
async function getCustomFieldsByKey(
  supabase: any,
  tenantId: string,
  contactId: string
): Promise<Record<string, string | null>> {
  // Get field definitions for tenant
  const { data: defsRaw } = await supabase
    .from("contact_custom_fields")
    .select("id, key")
    .eq("tenant_id", tenantId);

  const defs = (defsRaw || []) as { id: string; key: string }[];
  if (!defs.length) return {};

  const fieldIdToKey = new Map(defs.map((d) => [d.id, d.key]));

  // Get custom values for this contact
  const { data: valuesRaw } = await supabase
    .from("contact_custom_field_values")
    .select("field_id, value_text")
    .eq("contact_id", contactId);

  const values = (valuesRaw || []) as { field_id: string; value_text: string | null }[];
  
  const result: Record<string, string | null> = {};
  for (const v of values) {
    const key = fieldIdToKey.get(v.field_id);
    if (key) {
      result[key] = v.value_text;
    }
  }
  
  return result;
}

// deno-lint-ignore no-explicit-any
async function processCustomFields(
  supabase: any,
  tenantId: string,
  contactId: string,
  custom: Record<string, unknown>,
  checkRequired = false
): Promise<CustomFieldResult> {
  // Get field definitions
  const { data: defsRaw } = await supabase
    .from("contact_custom_fields")
    .select("id, key, data_type, is_required")
    .eq("tenant_id", tenantId);

  const defs = (defsRaw || []) as FieldDef[];
  if (!defs.length) {
    // No custom fields defined, return warnings for any keys sent
    const warnings = Object.keys(custom).map(k => `Unknown field: ${k}`);
    return { ok: true, saved: {}, warnings };
  }

  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const selectIds = defs.filter((d) => d.data_type === "select").map((d) => d.id);

  // Get options for select fields (including label for mapping)
  const allowedByFieldId: Record<string, Set<string>> = {};
  const labelToValueByFieldId: Record<string, Map<string, string>> = {};
  const optionsByFieldId: Record<string, string[]> = {};
  
  if (selectIds.length) {
    const { data: optionsRaw } = await supabase
      .from("contact_custom_field_options")
      .select("field_id, label, value")
      .in("field_id", selectIds);

    const options = (optionsRaw || []) as FieldOption[];
    for (const o of options) {
      allowedByFieldId[o.field_id] = allowedByFieldId[o.field_id] || new Set<string>();
      allowedByFieldId[o.field_id].add(o.value);
      
      labelToValueByFieldId[o.field_id] = labelToValueByFieldId[o.field_id] || new Map<string, string>();
      labelToValueByFieldId[o.field_id].set(o.label, o.value);
      
      optionsByFieldId[o.field_id] = optionsByFieldId[o.field_id] || [];
      optionsByFieldId[o.field_id].push(o.value);
    }
  }

  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const items: { field_id: string; key: string; value_text: string | null }[] = [];

  for (const [key, val] of Object.entries(custom)) {
    const def = defByKey.get(key);
    if (!def) {
      warnings.push(`Unknown field: ${key}`);
      continue;
    }

    const normalized = normalizeCustomValue({
      data_type: def.data_type,
      value: val,
      selectAllowedValues: def.data_type === "select" ? allowedByFieldId[def.id] : undefined,
      selectLabelToValue: def.data_type === "select" ? labelToValueByFieldId[def.id] : undefined,
    });

    if (!normalized.ok) {
      // For select fields, include allowed values in error message
      if (def.data_type === "select" && optionsByFieldId[def.id]) {
        errors[key] = `Invalid value for select field ${key}. Allowed: ${optionsByFieldId[def.id].join(", ")}`;
      } else {
        errors[key] = normalized.error;
      }
    } else {
      items.push({ field_id: def.id, key, value_text: normalized.value_text });
    }
  }

  // Check required fields on create
  if (checkRequired) {
    for (const d of defs.filter((d) => d.is_required)) {
      if (!Object.prototype.hasOwnProperty.call(custom, d.key)) {
        errors[d.key] = "Required field";
      }
    }
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }

  // Upsert custom values using proper upsert
  const saved: Record<string, string | null> = {};
  
  if (items.length) {
    for (const item of items) {
      // Delete existing value first, then insert (to handle null values)
      await supabase
        .from("contact_custom_field_values")
        .delete()
        .eq("contact_id", contactId)
        .eq("field_id", item.field_id);

      if (item.value_text !== null && item.value_text !== "") {
        const { error: insertErr } = await supabase.from("contact_custom_field_values").insert({
          contact_id: contactId,
          field_id: item.field_id,
          value_text: item.value_text,
        });
        
        if (insertErr) {
          console.error(`[public-contacts] failed to save custom field ${item.key}:`, insertErr);
          warnings.push(`Failed to save field: ${item.key}`);
        } else {
          saved[item.key] = item.value_text;
        }
      } else {
        saved[item.key] = null;
      }
    }
  }

  return { ok: true, saved, warnings };
}

// Attach custom fields by key to a list of contacts
// deno-lint-ignore no-explicit-any
async function attachCustomFieldsByKey(
  supabase: any,
  tenantId: string,
  contacts: { id: string }[]
): Promise<unknown[]> {
  if (!contacts.length) return contacts;

  const contactIds = contacts.map((c) => c.id);

  // Get field definitions for tenant
  const { data: defsRaw } = await supabase
    .from("contact_custom_fields")
    .select("id, key")
    .eq("tenant_id", tenantId);

  const defs = (defsRaw || []) as { id: string; key: string }[];
  if (!defs.length) return contacts;

  const fieldIdToKey = new Map(defs.map((d) => [d.id, d.key]));

  // Get all custom values for these contacts
  const { data: valuesRaw } = await supabase
    .from("contact_custom_field_values")
    .select("contact_id, field_id, value_text")
    .in("contact_id", contactIds);

  const values = (valuesRaw || []) as { contact_id: string; field_id: string; value_text: string | null }[];

  // Group values by contact_id
  const valuesByContact: Record<string, Record<string, string | null>> = {};
  for (const v of values) {
    const key = fieldIdToKey.get(v.field_id);
    if (!key) continue;
    if (!valuesByContact[v.contact_id]) valuesByContact[v.contact_id] = {};
    valuesByContact[v.contact_id][key] = v.value_text;
  }

  // Attach custom object to each contact
  return contacts.map((c) => ({
    ...c,
    custom: valuesByContact[c.id] || {},
  }));
}
