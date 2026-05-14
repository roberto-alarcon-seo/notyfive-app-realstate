CREATE OR REPLACE FUNCTION public.audit_property_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tenant_id := NEW.tenant_id;
    IF v_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
      v_tenant_id := NULL;
    END IF;
    INSERT INTO public.security_events (tenant_id, event_type, user_id, metadata)
    VALUES (
      v_tenant_id,
      'property_assignment',
      auth.uid(),
      jsonb_build_object('action','assigned','property_id',NEW.property_id,'target_user_id',NEW.user_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    -- Skip audit row when the parent tenant is being cascaded away,
    -- otherwise the FK to tenants in security_events would fail.
    IF v_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
      RETURN OLD;
    END IF;
    INSERT INTO public.security_events (tenant_id, event_type, user_id, metadata)
    VALUES (
      v_tenant_id,
      'property_assignment',
      auth.uid(),
      jsonb_build_object('action','unassigned','property_id',OLD.property_id,'target_user_id',OLD.user_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;