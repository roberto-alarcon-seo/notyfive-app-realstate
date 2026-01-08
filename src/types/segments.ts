export type SegmentType = 'static' | 'dynamic';
export type SegmentStatus = 'active' | 'archived';

export interface SegmentCondition {
  id: string;
  field: string;
  fieldType: 'base' | 'custom';
  dataType: string;
  operator: string;
  value: string | number | boolean | string[];
}

export interface SegmentRules {
  logic: 'AND' | 'OR';
  conditions: SegmentCondition[];
}

export interface Segment {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  type: SegmentType;
  rules_json: SegmentRules | null;
  status: SegmentStatus;
  last_calculated_at: string | null;
  fingerprint?: string | null;
  reuse_count?: number;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

export interface SegmentContact {
  id: string;
  segment_id: string;
  contact_id: string;
  created_at: string;
}

// Operators by data type
export const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  short_text: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'contains', label: 'Contiene' },
    { value: 'not_contains', label: 'No contiene' },
    { value: 'starts_with', label: 'Empieza con' },
    { value: 'ends_with', label: 'Termina con' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
  long_text: [
    { value: 'contains', label: 'Contiene' },
    { value: 'not_contains', label: 'No contiene' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'greater_or_equal', label: '≥' },
    { value: 'less_than', label: '<' },
    { value: 'less_or_equal', label: '≤' },
  ],
  decimal: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'greater_or_equal', label: '≥' },
    { value: 'less_than', label: '<' },
    { value: 'less_or_equal', label: '≤' },
  ],
  boolean: [
    { value: 'is_true', label: 'Es verdadero' },
    { value: 'is_false', label: 'Es falso' },
  ],
  date: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'before', label: 'Antes de' },
    { value: 'after', label: 'Después de' },
    { value: 'last_days', label: 'En los últimos X días' },
    { value: 'next_days', label: 'En los próximos X días' },
  ],
  datetime: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'before', label: 'Antes de' },
    { value: 'after', label: 'Después de' },
    { value: 'last_days', label: 'En los últimos X días' },
    { value: 'next_days', label: 'En los próximos X días' },
  ],
  url: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'contains', label: 'Contiene' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
  select: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
  tags: [
    { value: 'contains_tag', label: 'Contiene tag' },
    { value: 'not_contains_tag', label: 'No contiene tag' },
    { value: 'is_empty', label: 'Sin tags' },
    { value: 'is_not_empty', label: 'Con tags' },
  ],
};

// Base contact fields
export const BASE_CONTACT_FIELDS = [
  { key: 'name', label: 'Nombre', dataType: 'short_text' },
  { key: 'email', label: 'Email', dataType: 'short_text' },
  { key: 'phone', label: 'Teléfono', dataType: 'short_text' },
  { key: 'country', label: 'País', dataType: 'short_text' },
  { key: 'tags', label: 'Tags', dataType: 'tags' },
  { key: 'created_at', label: 'Fecha de creación', dataType: 'datetime' },
];
