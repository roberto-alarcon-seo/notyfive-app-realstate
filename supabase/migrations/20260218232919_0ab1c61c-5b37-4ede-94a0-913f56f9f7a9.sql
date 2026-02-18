
-- Add event_id for deduplication between Pixel and CAPI
ALTER TABLE public.conversion_event_logs ADD COLUMN IF NOT EXISTS event_id text;
CREATE INDEX IF NOT EXISTS idx_conversion_event_logs_event_id ON public.conversion_event_logs(event_id);

-- Add currency to meta_event_mappings
ALTER TABLE public.meta_event_mappings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN';
