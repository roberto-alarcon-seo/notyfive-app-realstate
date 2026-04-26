-- Add api_key column to partners table for per-partner authentication
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Ensure uniqueness so a key can only belong to one partner
CREATE UNIQUE INDEX IF NOT EXISTS partners_api_key_unique_idx
  ON public.partners (api_key)
  WHERE api_key IS NOT NULL;