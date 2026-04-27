ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS location_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_properties_metadata_gin
  ON public.properties USING GIN (metadata);