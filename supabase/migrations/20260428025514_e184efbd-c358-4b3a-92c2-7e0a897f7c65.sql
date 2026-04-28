ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS external_sync_enabled boolean NOT NULL DEFAULT true;