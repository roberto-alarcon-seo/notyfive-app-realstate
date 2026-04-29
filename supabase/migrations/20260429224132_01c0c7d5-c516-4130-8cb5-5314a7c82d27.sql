-- 1) Columnas para identificar subcuentas Twilio
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS is_subaccount boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_account_sid text;

-- 2) Trigger de auto-activación: al recibir un phone_number válido en una subcuenta pending_setup,
--    pasar status -> 'connected' (lo cual ya dispara invoke_seed_tenant_templates)
CREATE OR REPLACE FUNCTION public.auto_activate_subaccount_on_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_subaccount = true
     AND NEW.provider = 'twilio'
     AND NEW.phone_number IS NOT NULL
     AND length(trim(NEW.phone_number)) > 5
     AND COALESCE(OLD.phone_number, '') IS DISTINCT FROM NEW.phone_number
     AND NEW.status::text IN ('pending_setup', 'disconnected')
  THEN
    NEW.status := 'connected';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_activate_subaccount ON public.tenant_integrations;
CREATE TRIGGER trg_auto_activate_subaccount
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_activate_subaccount_on_phone();