ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS enabled_features text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.tenants.enabled_features IS 'Feature flags activos para el tenant. Valores posibles: campaigns, segments, automations_builder, templates_library, quick_automations';