CREATE OR REPLACE FUNCTION public.audit_property_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_events (tenant_id, event_type, user_id, metadata)
    VALUES (
      NEW.tenant_id,
      'property_assignment',
      auth.uid(),
      jsonb_build_object('action','assigned','property_id',NEW.property_id,'target_user_id',NEW.user_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_events (tenant_id, event_type, user_id, metadata)
    VALUES (
      OLD.tenant_id,
      'property_assignment',
      auth.uid(),
      jsonb_build_object('action','unassigned','property_id',OLD.property_id,'target_user_id',OLD.user_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;