CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_uid uuid;
  v_actor_is_super_admin boolean;
  v_actor_is_owner boolean;
  v_target_tenant_id uuid;
BEGIN
  v_actor_uid := auth.uid();

  -- System / service-role context (no auth.uid()) is allowed (e.g. handle_new_user trigger
  -- triggered by service-role auth.admin.createUser). Edge Functions still validate caller
  -- privileges before calling this path.
  IF v_actor_uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_actor_is_super_admin := is_super_admin(v_actor_uid);
  v_actor_is_owner := has_tenant_role(v_actor_uid, 'owner');

  SELECT tenant_id INTO v_target_tenant_id
  FROM public.profiles
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF v_actor_is_super_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.global_role = 'super_admin' THEN
      INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
      VALUES (v_target_tenant_id, v_actor_uid, 'blocked_privilege_escalation',
        jsonb_build_object('attempted_role', 'super_admin', 'target_user', NEW.user_id));
      RAISE EXCEPTION 'Cannot grant super_admin role';
    END IF;

    IF v_actor_is_owner THEN
      IF v_target_tenant_id != get_user_tenant_id(v_actor_uid) THEN
        INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
        VALUES (v_target_tenant_id, v_actor_uid, 'blocked_cross_tenant_role_change',
          jsonb_build_object('target_tenant', v_target_tenant_id, 'target_user', NEW.user_id));
        RAISE EXCEPTION 'Cannot modify roles in another tenant';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;