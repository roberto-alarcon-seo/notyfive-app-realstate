
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms numeric,
  ADD COLUMN IF NOT EXISTS parking_spots integer,
  ADD COLUMN IF NOT EXISTS sq_meters numeric,
  ADD COLUMN IF NOT EXISTS ai_description_template text;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'MX';

CREATE INDEX IF NOT EXISTS idx_tenants_country_code ON public.tenants(country_code);
