
-- ===================================================================
-- Partner detail: RPCs for update settings, regen API key, delete cascade, metrics
-- ===================================================================

-- 1) Update partner settings (whitelisted)
CREATE OR REPLACE FUNCTION public.partner_update_settings(_partner_id text, _patch jsonb)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_global_super boolean;
  v_row public.partners;
  v_new_primary text;
  v_new_alt text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND global_role = 'super_admin' AND partner_scope IS NULL
  ) INTO v_is_global_super;

  IF NOT v_is_global_super THEN
    RAISE EXCEPTION 'FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.partners WHERE id = _partner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Validate domain uniqueness if provided
  IF _patch ? 'primary_domain' THEN
    v_new_primary := lower(btrim(_patch->>'primary_domain'));
    IF v_new_primary = '' OR v_new_primary !~ '^[a-z0-9.-]+\.[a-z]{2,}$' THEN
      RAISE EXCEPTION 'INVALID_PRIMARY_DOMAIN' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.partners
      WHERE id <> _partner_id
        AND (primary_domain = v_new_primary OR v_new_primary = ANY(alt_domains))
    ) THEN
      RAISE EXCEPTION 'PRIMARY_DOMAIN_ALREADY_USED' USING ERRCODE = '23505';
    END IF;
  END IF;

  IF _patch ? 'alt_domains' THEN
    SELECT array_agg(lower(btrim(d)))
    INTO v_new_alt
    FROM jsonb_array_elements_text(_patch->'alt_domains') d
    WHERE btrim(d) <> '';
    v_new_alt := COALESCE(v_new_alt, ARRAY[]::text[]);

    IF EXISTS (
      SELECT 1 FROM unnest(v_new_alt) x
      WHERE x !~ '^[a-z0-9.-]+\.[a-z]{2,}$'
    ) THEN
      RAISE EXCEPTION 'INVALID_ALT_DOMAIN' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.partners p, unnest(v_new_alt) x
      WHERE p.id <> _partner_id
        AND (p.primary_domain = x OR x = ANY(p.alt_domains))
    ) THEN
      RAISE EXCEPTION 'ALT_DOMAIN_ALREADY_USED' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.partners SET
    name                  = COALESCE(_patch->>'name', name),
    country_code          = COALESCE(_patch->>'country_code', country_code),
    primary_domain        = COALESCE(v_new_primary, primary_domain),
    alt_domains           = COALESCE(v_new_alt, alt_domains),
    dashboard_url         = CASE WHEN _patch ? 'dashboard_url' THEN NULLIF(_patch->>'dashboard_url','') ELSE dashboard_url END,
    non_sso_redirect_url  = CASE WHEN _patch ? 'non_sso_redirect_url' THEN NULLIF(_patch->>'non_sso_redirect_url','') ELSE non_sso_redirect_url END,
    logout_redirect_url   = CASE WHEN _patch ? 'logout_redirect_url' THEN NULLIF(_patch->>'logout_redirect_url','') ELSE logout_redirect_url END,
    is_active             = COALESCE((_patch->>'is_active')::boolean, is_active),
    external_sync_enabled = COALESCE((_patch->>'external_sync_enabled')::boolean, external_sync_enabled),
    updated_at            = now()
  WHERE id = _partner_id
  RETURNING * INTO v_row;

  -- Update wallet threshold if provided
  IF _patch ? 'low_balance_threshold' THEN
    UPDATE public.partner_super_wallets
    SET low_balance_threshold = GREATEST(0, (_patch->>'low_balance_threshold')::int),
        updated_at = now()
    WHERE partner_id = _partner_id;
  END IF;

  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (v_uid, 'partner_settings_change',
    jsonb_build_object('partner_id', _partner_id, 'patch_keys', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) k)));

  RETURN v_row;
END;
$$;

-- 2) Regenerate API key
CREATE OR REPLACE FUNCTION public.partner_regenerate_api_key(_partner_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_global_super boolean;
  v_key text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND global_role = 'super_admin' AND partner_scope IS NULL
  ) INTO v_is_global_super;
  IF NOT v_is_global_super THEN
    RAISE EXCEPTION 'FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  v_key := 'pk_live_' || replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+',''), '/',''), '=','');

  UPDATE public.partners SET api_key = v_key, updated_at = now()
  WHERE id = _partner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (v_uid, 'partner_api_key_regenerated', jsonb_build_object('partner_id', _partner_id));

  RETURN v_key;
END;
$$;

-- 3) Delete partner with cascade (only if no tenants)
CREATE OR REPLACE FUNCTION public.partner_delete_cascade(_partner_id text, _confirm_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_global_super boolean;
  v_tenant_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND global_role = 'super_admin' AND partner_scope IS NULL
  ) INTO v_is_global_super;
  IF NOT v_is_global_super THEN
    RAISE EXCEPTION 'FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  IF _confirm_id IS DISTINCT FROM _partner_id THEN
    RAISE EXCEPTION 'CONFIRMATION_MISMATCH' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_tenant_count FROM public.tenants WHERE partner_id = _partner_id;
  IF v_tenant_count > 0 THEN
    RAISE EXCEPTION 'PARTNER_HAS_TENANTS' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.partner_wallet_ledger WHERE partner_id = _partner_id;
  DELETE FROM public.partner_super_wallets WHERE partner_id = _partner_id;
  DELETE FROM public.partners WHERE id = _partner_id;

  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (v_uid, 'partner_deleted', jsonb_build_object('partner_id', _partner_id));

  RETURN true;
END;
$$;

-- 4) Metrics RPC
CREATE OR REPLACE FUNCTION public.partner_metrics(_partner_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_global_super boolean;
  v_tenants_total int;
  v_users_total int;
  v_wallet_balance int;
  v_credits_30d int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND global_role = 'super_admin' AND partner_scope IS NULL
  ) INTO v_is_global_super;
  IF NOT v_is_global_super THEN
    RAISE EXCEPTION 'FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_tenants_total FROM public.tenants WHERE partner_id = _partner_id;
  SELECT count(*) INTO v_users_total
    FROM public.profiles p
    JOIN public.tenants t ON t.id = p.tenant_id
    WHERE t.partner_id = _partner_id;
  SELECT COALESCE(balance_credits, 0) INTO v_wallet_balance
    FROM public.partner_super_wallets WHERE partner_id = _partner_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_credits_30d
    FROM public.partner_wallet_ledger
    WHERE partner_id = _partner_id
      AND movement_type = 'REDEEM'
      AND created_at >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'tenants_total', v_tenants_total,
    'users_total', v_users_total,
    'wallet_balance', v_wallet_balance,
    'credits_consumed_30d', v_credits_30d
  );
END;
$$;
