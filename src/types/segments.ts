export type SegmentType = 'static' | 'dynamic';
export type SegmentStatus = 'active' | 'archived';

export interface SegmentCondition {
  id: string;
  field: string;
  fieldType: 'base' | 'system' | 'custom';
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

// Operators for array fields
export const OPERATORS_ARRAY: { value: string; label: string }[] = [
  { value: 'contains_any', label: 'Contiene alguno' },
  { value: 'contains_all', label: 'Contiene todos' },
  { value: 'is_empty', label: 'Está vacío' },
  { value: 'is_not_empty', label: 'No está vacío' },
];

// Base contact fields
export const BASE_CONTACT_FIELDS = [
  { key: 'name', label: 'Nombre', dataType: 'short_text' },
  { key: 'email', label: 'Email', dataType: 'short_text' },
  { key: 'phone', label: 'Teléfono', dataType: 'short_text' },
  { key: 'country', label: 'País', dataType: 'short_text' },
  { key: 'tags', label: 'Tags', dataType: 'tags' },
  { key: 'status', label: 'Estado', dataType: 'select', options: ['active', 'inactive', 'archived'] },
  { key: 'notes', label: 'Notas', dataType: 'long_text' },
  { key: 'created_at', label: 'Fecha de creación', dataType: 'datetime' },
  { key: 'updated_at', label: 'Última actualización', dataType: 'datetime' },
];

// Universal fixed fields (for all industries)
export const UNIVERSAL_FIXED_FIELDS = [
  { key: 'lead_score', label: 'Lead Score', dataType: 'number' },
  { key: 'lead_temperature', label: 'Temperatura', dataType: 'select', options: ['cold', 'warm', 'hot'] },
  { key: 'engagement_level', label: 'Engagement', dataType: 'select', options: ['low', 'medium', 'high'] },
  { key: 'source', label: 'Fuente', dataType: 'short_text' },
  { key: 'opt_in_status', label: 'Estado Opt-in', dataType: 'select', options: ['unknown', 'opt_in', 'opt_out'] },
  { key: 'next_action_at', label: 'Próxima acción', dataType: 'datetime' },
  { key: 'last_interaction_at', label: 'Última interacción', dataType: 'datetime' },
];

// Operational fields (Real Estate pipeline)
export const OPERATIONAL_FIELDS = [
  { key: 'pipeline_stage', label: 'Etapa del pipeline', dataType: 'select', options: ['new_lead', 'interest_confirmed', 'financial_validation', 'searching', 'visit_scheduled', 'visit_done', 'follow_up', 'negotiation', 'closed_won', 'closed_lost'] },
  { key: 'operational_status', label: 'Estado del contacto', dataType: 'select', options: ['ACTIVE', 'WAITING_CUSTOMER', 'GHOSTING', 'DND', 'CLOSED'] },
  { key: 're_block_reason', label: 'Motivo de bloqueo', dataType: 'select', options: ['NO_RESPONSE', 'BUDGET_TOO_LOW', 'CREDIT_NOT_APPROVED', 'CREDIT_UNKNOWN_AMOUNT', 'CREDIT_NOT_COMPATIBLE', 'NO_PROPERTIES_MATCH', 'NOT_INTERESTED_AFTER_VISIT', 'POSTPONED', 'OTHER'] },
  { key: 're_visit_outcome', label: 'Resultado de visita', dataType: 'select', options: ['LIKED', 'DIDNT_LIKE', 'NO_SHOW', 'RESCHEDULE', 'PENDING'] },
];

// Real Estate fixed fields
export const REAL_ESTATE_FIXED_FIELDS = [
  { key: 're_budget_estimated_mxn', label: 'Presupuesto (MXN)', dataType: 'number' },
  { key: 're_credit_type', label: 'Tipo de crédito', dataType: 'select', options: ['INFONAVIT', 'COFINAVIT', 'BANK', 'CASH', 'MIXED'] },
  { key: 're_credit_preapproved', label: 'Crédito preaprobado', dataType: 'boolean' },
  { key: 're_down_payment_mxn', label: 'Enganche (MXN)', dataType: 'number' },
  { key: 're_monthly_income_mxn', label: 'Ingreso mensual (MXN)', dataType: 'number' },
  { key: 're_property_types', label: 'Tipo de propiedad', dataType: 'array' },
  { key: 're_bedrooms', label: 'Recámaras', dataType: 'number' },
  { key: 're_bathrooms', label: 'Baños', dataType: 'number' },
  { key: 're_parking_spots', label: 'Estacionamientos', dataType: 'number' },
  { key: 're_requires_parking', label: 'Requiere estacionamiento', dataType: 'boolean' },
  { key: 're_zones', label: 'Zonas de interés', dataType: 'array' },
  { key: 're_amenities', label: 'Amenidades', dataType: 'array' },
  { key: 're_accepts_pets', label: 'Acepta mascotas', dataType: 'boolean' },
  { key: 're_reason', label: 'Motivo', dataType: 'select', options: ['BUY', 'RENT', 'INVEST', 'MOVE', 'UPGRADE', 'DOWNSIZE', 'OTHER'] },
  { key: 're_current_situation', label: 'Situación actual', dataType: 'select', options: ['RENTING', 'OWNING', 'LIVING_WITH_FAMILY', 'LOOKING_TO_MOVE', 'OTHER'] },
];

// All system fields (base + universal + operational + real estate)
export const ALL_SYSTEM_FIELDS = [
  ...BASE_CONTACT_FIELDS,
  ...UNIVERSAL_FIXED_FIELDS,
  ...OPERATIONAL_FIELDS,
  ...REAL_ESTATE_FIXED_FIELDS,
];
