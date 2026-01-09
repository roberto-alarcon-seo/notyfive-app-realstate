-- ====================================================================
-- 1.1 Campos universales (FIJOS para todas las industrias)
-- ====================================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_temperature text NOT NULL DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS engagement_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS source text NULL,
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS intent_detected text NULL,
  ADD COLUMN IF NOT EXISTS opt_in_status text NOT NULL DEFAULT 'unknown';

-- Índices para segmentación rápida
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON public.contacts (lead_score);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_temperature ON public.contacts (lead_temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_level ON public.contacts (engagement_level);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts (source);
CREATE INDEX IF NOT EXISTS idx_contacts_next_action_at ON public.contacts (next_action_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction_at ON public.contacts (last_interaction_at);

-- FK para assigned_agent_id (referencia a profiles)
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_assigned_agent_fk
  FOREIGN KEY (assigned_agent_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ====================================================================
-- 1.2 Campos Real Estate (FIJOS para el remix real estate)
-- ====================================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS re_budget_estimated_mxn numeric NULL,
  ADD COLUMN IF NOT EXISTS re_credit_type text NULL,
  ADD COLUMN IF NOT EXISTS re_credit_preapproved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_down_payment_mxn numeric NULL,
  ADD COLUMN IF NOT EXISTS re_monthly_income_mxn numeric NULL,
  ADD COLUMN IF NOT EXISTS re_property_types text[] NULL,
  ADD COLUMN IF NOT EXISTS re_bedrooms numeric NULL,
  ADD COLUMN IF NOT EXISTS re_bathrooms numeric NULL,
  ADD COLUMN IF NOT EXISTS re_parking_spots numeric NULL,
  ADD COLUMN IF NOT EXISTS re_requires_parking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_zones text[] NULL,
  ADD COLUMN IF NOT EXISTS re_amenities text[] NULL,
  ADD COLUMN IF NOT EXISTS re_accepts_pets boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_reason text NULL,
  ADD COLUMN IF NOT EXISTS re_current_situation text NULL;

-- Índices útiles (arrays con GIN)
CREATE INDEX IF NOT EXISTS idx_contacts_re_budget ON public.contacts (re_budget_estimated_mxn);
CREATE INDEX IF NOT EXISTS idx_contacts_re_credit_preapproved ON public.contacts (re_credit_preapproved);
CREATE INDEX IF NOT EXISTS idx_contacts_re_zones_gin ON public.contacts USING GIN (re_zones);
CREATE INDEX IF NOT EXISTS idx_contacts_re_amenities_gin ON public.contacts USING GIN (re_amenities);
CREATE INDEX IF NOT EXISTS idx_contacts_re_property_types_gin ON public.contacts USING GIN (re_property_types);