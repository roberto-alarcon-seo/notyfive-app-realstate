ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS variable_index_map jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.templates.variable_index_map IS 'Maps user-friendly variable names to Twilio numeric placeholders. Example: {"nombre": 1, "precio": 2}';