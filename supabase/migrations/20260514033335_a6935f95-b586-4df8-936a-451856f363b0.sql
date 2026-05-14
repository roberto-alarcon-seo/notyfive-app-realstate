CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleting_tenant_id uuid := NULLIF(current_setting('app.deleting_tenant_id', true), '')::uuid;
  v_effective_tenant_id uuid;
BEGIN
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    IF v_deleting_tenant_id IS NOT NULL AND OLD.tenant_id = v_deleting_tenant_id THEN
      RETURN NEW;
    END IF;

    v_effective_tenant_id := OLD.tenant_id;
    IF v_effective_tenant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tenants WHERE id = v_effective_tenant_id
    ) THEN
      v_effective_tenant_id := NULL;
    END IF;

    INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
    VALUES (
      v_effective_tenant_id,
      auth.uid(),
      'blocked_tenant_id_change',
      jsonb_build_object(
        'target_table', TG_TABLE_NAME,
        'old_tenant_id', OLD.tenant_id,
        'attempted_tenant_id', NEW.tenant_id
      )
    );

    IF NOT is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Changing tenant_id is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;