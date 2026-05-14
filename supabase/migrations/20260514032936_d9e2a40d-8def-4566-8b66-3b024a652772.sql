CREATE OR REPLACE FUNCTION public.admin_delete_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_user_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND global_role = 'super_admin'
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RAISE EXCEPTION 'FORBIDDEN_SUPER_ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.deleting_tenant_id', p_tenant_id::text, true);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_user_ids
  FROM public.profiles
  WHERE tenant_id = p_tenant_id;

  IF array_length(v_user_ids, 1) IS NOT NULL THEN
    UPDATE public.profiles
    SET invited_by = NULL
    WHERE invited_by = ANY(v_user_ids);

    DELETE FROM public.user_roles
    WHERE user_id = ANY(v_user_ids);
  END IF;

  DELETE FROM public.support_internal_notes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.security_events WHERE tenant_id = p_tenant_id;
  DELETE FROM public.partner_wallet_ledger WHERE tenant_id = p_tenant_id;
  DELETE FROM public.password_resets WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_ai_settings WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_integrations WHERE tenant_id = p_tenant_id;
  DELETE FROM public.wallets WHERE tenant_id = p_tenant_id;

  DELETE FROM public.tenants WHERE id = p_tenant_id;

  IF array_length(v_user_ids, 1) IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = ANY(v_user_ids);
  END IF;

  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (
    v_uid,
    'tenant_deleted',
    jsonb_build_object('tenant_id', p_tenant_id, 'user_ids', to_jsonb(v_user_ids))
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_cross_tenant_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_tenant_id uuid;
  v_target_tenant_id uuid;
  v_effective_tenant_id uuid;
  v_deleting_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_actor_tenant_id := get_user_tenant_id(auth.uid());
  v_deleting_tenant_id := NULLIF(current_setting('app.deleting_tenant_id', true), '')::uuid;

  IF TG_TABLE_NAME = 'tenants' THEN
    v_target_tenant_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  END IF;

  IF v_deleting_tenant_id IS NOT NULL AND v_target_tenant_id = v_deleting_tenant_id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_effective_tenant_id := v_target_tenant_id;
  IF v_effective_tenant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_effective_tenant_id) THEN
      v_effective_tenant_id := NULL;
    END IF;
  END IF;

  IF is_super_admin(auth.uid()) AND v_actor_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
    VALUES (
      v_effective_tenant_id,
      auth.uid(),
      'cross_tenant_access',
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'actor_tenant_id', v_actor_tenant_id,
        'target_tenant_id', v_target_tenant_id
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_property_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_deleting_tenant_id uuid := NULLIF(current_setting('app.deleting_tenant_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tenant_id := NEW.tenant_id;

    IF v_deleting_tenant_id IS NOT NULL AND v_tenant_id = v_deleting_tenant_id THEN
      RETURN NEW;
    END IF;

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

    IF v_deleting_tenant_id IS NOT NULL AND v_tenant_id = v_deleting_tenant_id THEN
      RETURN OLD;
    END IF;

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