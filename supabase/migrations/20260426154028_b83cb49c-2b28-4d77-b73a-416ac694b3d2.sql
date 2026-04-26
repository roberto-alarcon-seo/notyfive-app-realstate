-- Convert tenants.plan from enum to TEXT so the external Core can send
-- custom regional plan names (e.g. "premium_mx", "core_co_basic")
-- without requiring a schema change every time.
--
-- A trigger (trigger_set_tenant_limits) currently depends on this column,
-- so we drop it, alter the column, then recreate it. The trigger function
-- already uses string equality so no change to its body is needed.

DROP TRIGGER IF EXISTS trigger_set_tenant_limits ON public.tenants;

-- Drop default first (it references the enum type).
ALTER TABLE public.tenants ALTER COLUMN plan DROP DEFAULT;

-- Convert the column to TEXT. Existing enum values become their text labels.
ALTER TABLE public.tenants
  ALTER COLUMN plan TYPE TEXT
  USING plan::text;

-- Re-apply a sensible default and NOT NULL guarantee.
ALTER TABLE public.tenants ALTER COLUMN plan SET DEFAULT 'trial';
UPDATE public.tenants SET plan = 'trial' WHERE plan IS NULL;
ALTER TABLE public.tenants ALTER COLUMN plan SET NOT NULL;

-- Recreate the trigger so plan changes still recompute limits/status
-- for locally managed tenants.
CREATE TRIGGER trigger_set_tenant_limits
  BEFORE INSERT OR UPDATE OF plan ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_limits_on_plan();

-- The old enum type is no longer referenced by the column; drop it if
-- nothing else depends on it. Other dependencies will keep it alive.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_plan') THEN
    BEGIN
      DROP TYPE public.tenant_plan;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      NULL;
    END;
  END IF;
END$$;