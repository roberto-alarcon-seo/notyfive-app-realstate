export async function upsertCustomFields({
  supabase,
  contactId,
  tenantId,
  custom,
}: {
  supabase: any;
  contactId: string;
  tenantId: string;
  custom: Record<string, any>;
}) {
  const keys = Object.keys(custom || {});
  if (!keys.length) return;

  // 1) Load field definitions for this tenant
  const { data: fields, error: fieldsErr } = await supabase
    .from("contact_custom_fields")
    .select("id,key,data_type")
    .eq("tenant_id", tenantId)
    .in("key", keys);
  if (fieldsErr) throw fieldsErr;

  const fieldByKey = new Map<string, any>();
  (fields || []).forEach((f: any) => fieldByKey.set(f.key, f));

  // 2) Load select options for fields (only select)
  const selectFieldIds = (fields || [])
    .filter((f: any) => f.data_type === "select")
    .map((f: any) => f.id);

  let optionsByFieldId = new Map<string, any[]>();
  if (selectFieldIds.length) {
    const { data: opts, error: optsErr } = await supabase
      .from("contact_custom_field_options")
      .select("field_id,label,value")
      .in("field_id", selectFieldIds);
    if (optsErr) throw optsErr;
    (opts || []).forEach((o: any) => {
      const arr = optionsByFieldId.get(o.field_id) || [];
      arr.push(o);
      optionsByFieldId.set(o.field_id, arr);
    });
  }

  // 3) Build upserts
  const rows: any[] = [];
  for (const key of keys) {
    const def = fieldByKey.get(key);
    if (!def) continue; // ignore unknown keys

    let v = custom[key];
    if (v === undefined || v === null) continue;

    // normalize to string storage
    if (def.data_type === "boolean") v = v ? "true" : "false";
    else v = String(v).trim();

    // If select: accept label or value, but store value
    if (def.data_type === "select") {
      const opts = optionsByFieldId.get(def.id) || [];
      const found =
        opts.find((o: any) => String(o.value).trim().toLowerCase() === v.toLowerCase()) ||
        opts.find((o: any) => String(o.label).trim().toLowerCase() === v.toLowerCase());

      if (!found) {
        const allowed = opts.map((o: any) => o.value).join(", ");
        const err = new Error(`Invalid value for ${key}. Allowed: ${allowed}`);
        (err as any).status = 422;
        throw err;
      }
      v = String(found.value);
    }

    rows.push({
      contact_id: contactId,
      field_id: def.id,
      value_text: v,
      updated_at: new Date().toISOString(),
    });
  }

  if (!rows.length) return;

  // 4) UPSERT values: update if exists (contact_id + field_id unique)
  const { error: upErr } = await supabase
    .from("contact_custom_field_values")
    .upsert(rows, { onConflict: "contact_id,field_id" });
  if (upErr) throw upErr;
}
