
CREATE OR REPLACE FUNCTION public.partner_wallet_adjust(
  _partner_id uuid,
  _amount integer,
  _description text
)
RETURNS public.partner_super_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_global_super boolean;
  v_wallet public.partner_super_wallets;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  -- Only GLOBAL super admins (no partner_scope) can adjust
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND global_role = 'super_admin'
      AND partner_scope IS NULL
  ) INTO v_is_global_super;

  IF NOT v_is_global_super THEN
    RAISE EXCEPTION 'FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22023';
  END IF;

  IF _description IS NULL OR length(btrim(_description)) = 0 THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Ensure wallet row exists, lock for update
  INSERT INTO public.partner_super_wallets (partner_id, balance_credits)
  VALUES (_partner_id, 0)
  ON CONFLICT (partner_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.partner_super_wallets
  WHERE partner_id = _partner_id
  FOR UPDATE;

  v_balance_before := v_wallet.balance_credits;
  v_balance_after := v_balance_before + _amount;

  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_BALANCE_NOT_ALLOWED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.partner_super_wallets
  SET balance_credits = v_balance_after,
      updated_at = now()
  WHERE partner_id = _partner_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.partner_wallet_ledger (
    partner_id, movement_type, amount, balance_before, balance_after,
    tenant_id, actor_user_id, description, metadata
  ) VALUES (
    _partner_id, 'ADJUSTMENT', _amount, v_balance_before, v_balance_after,
    NULL, v_uid, _description,
    jsonb_build_object('source', 'manual_adjustment')
  );

  RETURN v_wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_wallet_adjust(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.partner_wallet_adjust(uuid, integer, text) TO authenticated;
