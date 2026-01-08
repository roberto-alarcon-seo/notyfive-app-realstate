import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { toast } from "sonner";
import { Segment, SegmentRules } from "@/types/segments";
import { Json } from "@/integrations/supabase/types";


export function useSegments(showArchived: boolean = false) {
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  const segmentsQuery = useQuery({
    queryKey: ["segments", tenantId, showArchived],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("segments")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", showArchived ? "archived" : "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map the data to our Segment type
      return (data || []).map((s) => ({
        ...s,
        rules_json: s.rules_json as unknown as SegmentRules | null,
      })) as Segment[];
    },
    enabled: !!tenantId,
  });

  const createSegment = useMutation({
    mutationFn: async ({
      name,
      description,
      type,
      rules_json,
      contactIds,
      fingerprint,
    }: {
      name: string;
      description?: string;
      type: "static" | "dynamic";
      rules_json?: SegmentRules;
      contactIds?: string[];
      fingerprint?: string;
    }) => {
      if (!tenantId) throw new Error("No tenant ID");

      // Create segment
      const { data: segment, error: segmentError } = await supabase
        .from("segments")
        .insert({
          tenant_id: tenantId,
          name,
          description: description || null,
          type,
          rules_json: type === "dynamic" ? (rules_json as unknown as Json) : null,
          status: "active" as const,
          last_calculated_at: new Date().toISOString(),
          fingerprint: fingerprint || null,
        })
        .select()
        .single();

      if (segmentError) throw segmentError;

      // If static, add contacts
      if (type === "static" && contactIds && contactIds.length > 0) {
        const segmentContacts = contactIds.map((contactId) => ({
          segment_id: segment.id,
          contact_id: contactId,
        }));

        const { error: contactsError } = await supabase
          .from("segment_contacts")
          .insert(segmentContacts);

        if (contactsError) throw contactsError;
      }

      return segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segmento creado exitosamente");
    },
    onError: (error) => {
      console.error("Error creating segment:", error);
      toast.error("Error al crear el segmento");
    },
  });

  // Find existing segment by fingerprint or create new one
  const findOrCreateSegment = async ({
    name,
    description,
    rules_json,
    fingerprint,
  }: {
    name: string;
    description?: string;
    rules_json: SegmentRules;
    fingerprint: string;
  }): Promise<{ segment: any; wasReused: boolean }> => {
    if (!tenantId) throw new Error("No tenant ID");

    // 1. Try to find existing segment with same fingerprint
    const { data: existingSegment } = await supabase
      .from("segments")
      .select("id, name, reuse_count")
      .eq("tenant_id", tenantId)
      .eq("fingerprint", fingerprint)
      .eq("status", "active")
      .maybeSingle();

    if (existingSegment?.id) {
      // Increment reuse_count
      await supabase
        .from("segments")
        .update({ reuse_count: (existingSegment.reuse_count || 0) + 1 })
        .eq("id", existingSegment.id);
      
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      return { segment: existingSegment, wasReused: true };
    }

    // 2. Create new segment with fingerprint
    try {
      const { data: newSegment, error } = await supabase
        .from("segments")
        .insert({
          tenant_id: tenantId,
          name,
          description: description || null,
          type: "dynamic",
          rules_json: rules_json as unknown as Json,
          status: "active" as const,
          last_calculated_at: new Date().toISOString(),
          fingerprint,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["segments"] });
      return { segment: newSegment, wasReused: false };
    } catch (err: any) {
      // 3. Handle race condition (unique constraint violation)
      const { data: fallbackSegment } = await supabase
        .from("segments")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("fingerprint", fingerprint)
        .eq("status", "active")
        .maybeSingle();

      if (fallbackSegment?.id) {
        return { segment: fallbackSegment, wasReused: true };
      }

      throw err;
    }
  };

  const updateSegment = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      rules_json,
      contactIds,
      type,
    }: {
      id: string;
      name: string;
      description?: string;
      rules_json?: SegmentRules;
      contactIds?: string[];
      type: "static" | "dynamic";
    }) => {
      const { data: segment, error: segmentError } = await supabase
        .from("segments")
        .update({
          name,
          description: description || null,
          rules_json: type === "dynamic" ? (rules_json as unknown as Json) : null,
          last_calculated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (segmentError) throw segmentError;

      // If static, update contacts
      if (type === "static") {
        // Delete existing contacts
        await supabase
          .from("segment_contacts")
          .delete()
          .eq("segment_id", id);

        // Add new contacts
        if (contactIds && contactIds.length > 0) {
          const segmentContacts = contactIds.map((contactId) => ({
            segment_id: id,
            contact_id: contactId,
          }));

          const { error: contactsError } = await supabase
            .from("segment_contacts")
            .insert(segmentContacts);

          if (contactsError) throw contactsError;
        }
      }

      return segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segmento actualizado exitosamente");
    },
    onError: (error) => {
      console.error("Error updating segment:", error);
      toast.error("Error al actualizar el segmento");
    },
  });

  const archiveSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("segments")
        .update({ status: "archived" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (error) => {
      console.error("Error archiving segment:", error);
      toast.error("Error al archivar el segmento");
    },
  });

  const restoreSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("segments")
        .update({ status: "active" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (error) => {
      console.error("Error restoring segment:", error);
      toast.error("Error al restaurar el segmento");
    },
  });

  return {
    segments: segmentsQuery.data || [],
    isLoading: segmentsQuery.isLoading,
    error: segmentsQuery.error,
    createSegment,
    updateSegment,
    archiveSegment,
    restoreSegment,
    findOrCreateSegment,
  };
}

export function useSegmentContacts(segmentId: string | null) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ["segment-contacts", segmentId],
    queryFn: async () => {
      if (!segmentId) return [];

      const { data, error } = await supabase
        .from("segment_contacts")
        .select("contact_id")
        .eq("segment_id", segmentId);

      if (error) throw error;
      return data.map((sc) => sc.contact_id);
    },
    enabled: !!segmentId && !!tenantId,
  });
}

export function useSegmentContactCount(segment: Segment | null) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ["segment-contact-count", segment?.id, segment?.type, segment?.rules_json],
    queryFn: async () => {
      if (!segment || !tenantId) return 0;

      if (segment.type === "static") {
        const { count, error } = await supabase
          .from("segment_contacts")
          .select("*", { count: "exact", head: true })
          .eq("segment_id", segment.id);

        if (error) throw error;
        return count || 0;
      } else {
        // For dynamic segments, evaluate rules
        const count = await evaluateDynamicSegmentCount(
          tenantId,
          segment.rules_json as SegmentRules
        );
        return count;
      }
    },
    enabled: !!segment && !!tenantId,
  });
}

async function evaluateDynamicSegmentCount(
  tenantId: string,
  rules: SegmentRules | null
): Promise<number> {
  if (!rules || !rules.conditions || rules.conditions.length === 0) {
    // No rules, return all contacts
    const { count, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error) throw error;
    return count || 0;
  }

  const baseConditions = rules.conditions.filter((c) => c.fieldType === "base");
  const customConditions = rules.conditions.filter((c) => c.fieldType === "custom");

  // Start with base query
  let query = supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  // Apply base conditions to query
  for (const condition of baseConditions) {
    query = applyConditionToQuery(query, condition);
  }

  // If no custom conditions, we can use count directly
  if (customConditions.length === 0) {
    const { count, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");
    
    // Re-apply base conditions for count
    let countQuery = supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");
    
    for (const condition of baseConditions) {
      countQuery = applyConditionToQuery(countQuery, condition);
    }
    
    const { count: finalCount, error: countError } = await countQuery;
    if (countError) throw countError;
    return finalCount || 0;
  }

  // If there are custom conditions, we need to evaluate in memory
  const { data: contacts, error } = await query;
  if (error) throw error;
  if (!contacts || contacts.length === 0) return 0;

  const contactIds = contacts.map((c) => c.id);

  // Get all custom field values for these contacts
  const { data: customFieldValues, error: cfvError } = await supabase
    .from("contact_custom_field_values")
    .select("contact_id, value_text, field:contact_custom_fields(key)")
    .in("contact_id", contactIds);

  if (cfvError) throw cfvError;

  // Build a map of contact -> field -> value
  const contactFieldMap: Record<string, Record<string, string>> = {};
  for (const cfv of customFieldValues || []) {
    const field = cfv.field as { key: string } | null;
    if (!field) continue;
    if (!contactFieldMap[cfv.contact_id]) contactFieldMap[cfv.contact_id] = {};
    contactFieldMap[cfv.contact_id][field.key] = cfv.value_text || "";
  }

  // Filter contacts by custom field conditions
  const logic = rules.logic || "AND";
  const matchingContacts = contacts.filter((contact) => {
    const fieldValues = contactFieldMap[contact.id] || {};

    if (logic === "AND") {
      return customConditions.every((cond) => evaluateCustomCondition(cond, fieldValues));
    } else {
      return customConditions.some((cond) => evaluateCustomCondition(cond, fieldValues));
    }
  });

  return matchingContacts.length;
}

function evaluateCustomCondition(
  condition: import("@/types/segments").SegmentCondition,
  fieldValues: Record<string, string>
): boolean {
  const { field, operator, value } = condition;
  const fieldValue = fieldValues[field] || "";
  const compareValue = String(value || "");

  switch (operator) {
    case "equals":
      return fieldValue.toLowerCase() === compareValue.toLowerCase();
    case "not_equals":
      return fieldValue.toLowerCase() !== compareValue.toLowerCase();
    case "contains":
      return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case "not_contains":
      return !fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case "starts_with":
      return fieldValue.toLowerCase().startsWith(compareValue.toLowerCase());
    case "ends_with":
      return fieldValue.toLowerCase().endsWith(compareValue.toLowerCase());
    case "is_empty":
      return !fieldValue || fieldValue.trim() === "";
    case "is_not_empty":
      return !!fieldValue && fieldValue.trim() !== "";
    case "greater_than":
      return parseFloat(fieldValue) > parseFloat(compareValue);
    case "greater_or_equal":
      return parseFloat(fieldValue) >= parseFloat(compareValue);
    case "less_than":
      return parseFloat(fieldValue) < parseFloat(compareValue);
    case "less_or_equal":
      return parseFloat(fieldValue) <= parseFloat(compareValue);
    default:
      return true;
  }
}

function applyConditionToQuery(query: ReturnType<typeof supabase.from>, condition: import("@/types/segments").SegmentCondition) {
  const { field, operator, value } = condition;

  switch (operator) {
    case "equals":
      return query.eq(field, value);
    case "not_equals":
      return query.neq(field, value);
    case "contains":
      return query.ilike(field, `%${value}%`);
    case "not_contains":
      return query.not(field, "ilike", `%${value}%`);
    case "starts_with":
      return query.ilike(field, `${value}%`);
    case "ends_with":
      return query.ilike(field, `%${value}`);
    case "is_empty":
      return query.is(field, null);
    case "is_not_empty":
      return query.not(field, "is", null);
    case "greater_than":
      return query.gt(field, value);
    case "greater_or_equal":
      return query.gte(field, value);
    case "less_than":
      return query.lt(field, value);
    case "less_or_equal":
      return query.lte(field, value);
    case "before":
      return query.lt(field, value);
    case "after":
      return query.gt(field, value);
    case "contains_tag":
      return query.contains(field, [value]);
    case "not_contains_tag":
      return query.not(field, "cs", `{${value}}`);
    default:
      return query;
  }
}

export async function getSegmentContactsPreview(
  tenantId: string,
  type: "static" | "dynamic",
  rules?: SegmentRules | null,
  contactIds?: string[]
): Promise<{ id: string; name: string; email: string | null; phone: string | null }[]> {
  if (type === "static") {
    if (!contactIds || contactIds.length === 0) return [];

    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, email, phone")
      .in("id", contactIds)
      .eq("tenant_id", tenantId)
      .limit(50);

    if (error) throw error;
    return data || [];
  } else {
    // Dynamic segment preview
    if (!rules || !rules.conditions || rules.conditions.length === 0) {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .limit(50);

      if (error) throw error;
      return data || [];
    }

    const baseConditions = rules.conditions.filter((c) => c.fieldType === "base");
    const customConditions = rules.conditions.filter((c) => c.fieldType === "custom");

    let query = supabase
      .from("contacts")
      .select("id, name, email, phone")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    for (const condition of baseConditions) {
      query = applyConditionToQuery(query, condition) as typeof query;
    }

    // If no custom conditions, return directly
    if (customConditions.length === 0) {
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    }

    // If there are custom conditions, fetch more and filter in memory
    const { data: contacts, error } = await query.limit(500);
    if (error) throw error;
    if (!contacts || contacts.length === 0) return [];

    const contactIds = contacts.map((c) => c.id);

    // Get custom field values
    const { data: customFieldValues, error: cfvError } = await supabase
      .from("contact_custom_field_values")
      .select("contact_id, value_text, field:contact_custom_fields(key)")
      .in("contact_id", contactIds);

    if (cfvError) throw cfvError;

    // Build contact -> field -> value map
    const contactFieldMap: Record<string, Record<string, string>> = {};
    for (const cfv of customFieldValues || []) {
      const field = cfv.field as { key: string } | null;
      if (!field) continue;
      if (!contactFieldMap[cfv.contact_id]) contactFieldMap[cfv.contact_id] = {};
      contactFieldMap[cfv.contact_id][field.key] = cfv.value_text || "";
    }

    // Filter by custom conditions
    const logic = rules.logic || "AND";
    const filteredContacts = contacts.filter((contact) => {
      const fieldValues = contactFieldMap[contact.id] || {};

      if (logic === "AND") {
        return customConditions.every((cond) => evaluateCustomCondition(cond, fieldValues));
      } else {
        return customConditions.some((cond) => evaluateCustomCondition(cond, fieldValues));
      }
    });

    return filteredContacts.slice(0, 50);
  }
}
