import { SegmentRules } from '@/types/segments';

/**
 * Computes a SHA-256 fingerprint for segment rules to enable deduplication.
 * Rules with the same logical content (regardless of order) produce the same fingerprint.
 */
export async function computeSegmentFingerprint(rulesJson: SegmentRules | null): Promise<string> {
  const normalized = normalizeRulesJson(rulesJson);
  const encoded = new TextEncoder().encode(JSON.stringify(normalized));
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalizes rules JSON to ensure consistent fingerprinting:
 * - Normalizes logic to uppercase
 * - Sorts conditions deterministically
 * - Lowercases string values for comparison
 */
function normalizeRulesJson(rulesJson: SegmentRules | null) {
  if (!rulesJson) {
    return { logic: 'AND', conditions: [] };
  }

  const logic = String(rulesJson.logic || 'AND').toUpperCase();

  const conditions = [...(rulesJson.conditions || [])]
    .map(c => ({
      field: String(c.field || '').trim().toLowerCase(),
      operator: String(c.operator || '').trim().toLowerCase(),
      value: String(c.value || '').trim().toLowerCase(),
      fieldType: String(c.fieldType || '').trim().toLowerCase(),
      dataType: String(c.dataType || '').trim().toLowerCase(),
    }))
    .sort((a, b) =>
      `${a.field}|${a.operator}|${a.value}|${a.fieldType}|${a.dataType}`
        .localeCompare(
          `${b.field}|${b.operator}|${b.value}|${b.fieldType}|${b.dataType}`
        )
    );

  return { logic, conditions };
}
