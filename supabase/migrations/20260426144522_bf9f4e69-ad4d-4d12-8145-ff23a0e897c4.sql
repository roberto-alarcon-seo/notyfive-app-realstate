CREATE OR REPLACE FUNCTION public.set_tenant_limits_on_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- For externally managed tenants (Core system), respect the values provided
  -- by the Core. Only auto-derive limits for locally managed tenants.
  IF NEW.managed_externally IS DISTINCT FROM TRUE THEN
    -- Set max_users based on plan
    NEW.max_users := CASE 
      WHEN NEW.plan = 'trial' THEN 1
      WHEN NEW.plan = 'starter' THEN 2
      WHEN NEW.plan = 'growth' THEN 5
      WHEN NEW.plan = 'pro' THEN 10
      WHEN NEW.plan = 'scale' THEN 20
      WHEN NEW.plan = 'enterprise' THEN 30
      ELSE 1
    END;

    -- Set max_contacts based on plan
    NEW.max_contacts := CASE 
      WHEN NEW.plan = 'trial' THEN 100
      WHEN NEW.plan = 'starter' THEN 500
      WHEN NEW.plan = 'growth' THEN 2000
      WHEN NEW.plan = 'pro' THEN 10000
      WHEN NEW.plan = 'scale' THEN 25000
      WHEN NEW.plan = 'enterprise' THEN 50000
      ELSE 100
    END;
  END IF;

  -- Set status based on plan for new tenants (applies to both managed types)
  IF TG_OP = 'INSERT' THEN
    IF NEW.plan = 'trial' THEN
      NEW.status := 'trial';
    ELSE
      NEW.status := 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;