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

  -- Disable triggers (audit, etc.) inside this transaction so cascades don't
  -- re-insert rows referencing the tenant we're about to delete.
  PERFORM set_config('session_replication_role', 'replica', true);

  -- Collect users that belong to this tenant.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_user_ids
  FROM public.profiles
  WHERE tenant_id = p_tenant_id;

  -- Break self-referential profile chain (invited_by) before deletion.
  IF array_length(v_user_ids, 1) IS NOT NULL THEN
    UPDATE public.profiles SET invited_by = NULL
    WHERE invited_by = ANY(v_user_ids);

    DELETE FROM public.user_roles WHERE user_id = ANY(v_user_ids);
  END IF;

  -- Pre-clean tables that don't cascade or that reference the tenant in
  -- "ON DELETE NO ACTION" mode.
  DELETE FROM public.support_internal_notes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.security_events WHERE tenant_id = p_tenant_id;
  DELETE FROM public.partner_wallet_ledger WHERE tenant_id = p_tenant_id;
  DELETE FROM public.password_resets WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_ai_settings WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_integrations WHERE tenant_id = p_tenant_id;
  DELETE FROM public.wallets WHERE tenant_id = p_tenant_id;

  -- Now delete the tenant; cascading FKs handle the rest.
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  -- Finally remove the orphan profile rows for this tenant's users.
  IF array_length(v_user_ids, 1) IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = ANY(v_user_ids);
  END IF;

  -- Re-enable triggers in this session.
  PERFORM set_config('session_replication_role', 'origin', true);

  -- Audit (with NULL tenant_id since the tenant no longer exists).
  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (v_uid, 'tenant_deleted', jsonb_build_object('tenant_id', p_tenant_id, 'user_ids', to_jsonb(v_user_ids)));

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Make sure replication role is restored on error.
  PERFORM set_config('session_replication_role', 'origin', true);
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_tenant(uuid) TO authenticated;