/**
 * Value normalization utilities for public API writes.
 * Ensures canonical formats for segmentation and queries.
 */

type DataType =
  | "short_text"
  | "long_text"
  | "number"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "url"
  | "select";

export function normalizeTags(tags: unknown): string[] | null {
  if (!Array.isArray(tags)) return null;
  const out = tags
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .map((t) => t.toLowerCase());
  return out.length ? Array.from(new Set(out)) : null;
}

/**
 * Normalize phone to E.164 Mexico format for WhatsApp.
 * - 10 digits -> +521XXXXXXXXXX
 * - +52XXXXXXXXXX -> +521XXXXXXXXXX (add mobile prefix)
 */
export function normalizeMxWhatsappPhone(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  let raw = String(input).trim();
  if (!raw) return null;
  raw = raw.replace(/\s+/g, "");
  
  const plus = raw.startsWith("+");
  raw = raw.replace(/[^\d+]/g, "");
  if (plus && !raw.startsWith("+")) raw = "+" + raw.replace(/\+/g, "");

  // If already starts with +52... canonicalize to +521 + 10 digits
  if (raw.startsWith("+52")) {
    const digits = raw.replace(/[^\d]/g, "");
    const rest = digits.slice(2);
    if (rest.length === 10) return "+521" + rest;
    if (rest.length === 11 && rest.startsWith("1")) return "+52" + rest;
    return "+" + digits;
  }

  // 10 digits -> assume MX mobile
  const onlyDigits = raw.replace(/[^\d]/g, "");
  if (onlyDigits.length === 10) return "+521" + onlyDigits;
  if (onlyDigits.length === 12 && onlyDigits.startsWith("52")) {
    const rest = onlyDigits.slice(2);
    return "+521" + rest;
  }

  // Fallback: keep as-is if has +, otherwise null
  if (raw.startsWith("+")) return raw;
  return null;
}

export function normalizeCustomValue(params: {
  data_type: DataType | string;
  value: unknown;
  selectAllowedValues?: Set<string>;
  selectLabelToValue?: Map<string, string>;
}): { ok: true; value_text: string | null } | { ok: false; error: string } {
  const t = params.data_type as string;
  const v = params.value;

  if (v === null || v === undefined || v === "") return { ok: true, value_text: null };

  if (t === "boolean") {
    if (typeof v === "boolean") return { ok: true, value_text: v ? "true" : "false" };
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "yes", "si"].includes(s)) return { ok: true, value_text: "true" };
    if (["false", "0", "no"].includes(s)) return { ok: true, value_text: "false" };
    return { ok: false, error: "Invalid boolean" };
  }

  if (t === "number" || t === "decimal") {
    const s = String(v).trim().replace(/,/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, error: "Invalid number" };
    return { ok: true, value_text: s };
  }

  if (t === "date") {
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: "Invalid date (expected YYYY-MM-DD)" };
    return { ok: true, value_text: s };
  }

  if (t === "datetime") {
    const s = String(v).trim();
    const d = new Date(s);
    if (isNaN(d.getTime())) return { ok: false, error: "Invalid datetime (expected ISO8601)" };
    return { ok: true, value_text: d.toISOString() };
  }

  if (t === "select") {
    const s = String(v).trim();
    const allowed = params.selectAllowedValues;
    const labelMap = params.selectLabelToValue;
    
    // First check if it's already a valid value
    if (allowed && allowed.has(s)) {
      return { ok: true, value_text: s };
    }
    
    // Try case-insensitive match on values
    if (allowed) {
      for (const allowedVal of allowed) {
        if (allowedVal.toLowerCase() === s.toLowerCase()) {
          return { ok: true, value_text: allowedVal };
        }
      }
    }
    
    // Try mapping from label to value (case-insensitive)
    if (labelMap) {
      for (const [label, value] of labelMap) {
        if (label.toLowerCase() === s.toLowerCase()) {
          return { ok: true, value_text: value };
        }
      }
    }
    
    return { ok: false, error: `Invalid select option: "${s}"` };
  }

  // text/url fallback
  return { ok: true, value_text: String(v) };
}
