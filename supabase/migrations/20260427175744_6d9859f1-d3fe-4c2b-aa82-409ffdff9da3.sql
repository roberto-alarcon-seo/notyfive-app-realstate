-- Service-role variant of partner_wallet_redeem_to_tenant for trusted backend
-- contexts (e.g. external Core sync). Does NOT check auth.uid() because it is
-- invoked by the service role (no JWT). Accepts a metadata payload so the
-- caller can attach external references (external_id from the Core webhook).

CREATE OR REPLACE FUNCTION public.partner_wallet_redeem_to_tenant_service(
  _partner_id text,
  _tenant_id uuid,
  _amount integer,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.partner_super_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet public.partner_super_wallets;
  _before integer;
  _tenant_partner text;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023';
  END IF;

  SELECT partner_id INTO _tenant_partner FROM public.tenants WHERE id = _tenant_id;
  IF _tenant_partner IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF _tenant_partner <> _partner_id THEN
    RAISE EXCEPTION 'El tenant no pertenece a este partner' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _wallet FROM public.partner_super_wallets
    WHERE partner_id = _partner_id FOR UPDATE;
  IF _wallet IS NULL THEN
    RAISE EXCEPTION 'Super Wallet no inicializada' USING ERRCODE = 'P0002';
  END IF;
  IF _wallet.balance_credits < _amount THEN
    -- Distinct SQLSTATE so the edge function can map this to HTTP 402
    RAISE EXCEPTION 'Saldo insuficiente en la Super Wallet' USING ERRCODE = 'P0003';
  END IF;

  _before := _wallet.balance_credits;

  UPDATE public.partner_super_wallets
    SET balance_credits = balance_credits - _amount
    WHERE partner_id = _partner_id
    RETURNING * INTO _wallet;

  UPDATE public.tenants
    SET extra_credits = COALESCE(extra_credits,0) + _amount,
        message_credits = COALESCE(message_credits,0) + _amount,
        updated_at = now()
    WHERE id = _tenant_id;

  INSERT INTO public.partner_wallet_ledger(
    partner_id, movement_type, amount, balance_before, balance_after,
    tenant_id, actor_user_id, description, metadata
  ) VALUES (
    _partner_id, 'REDEEM', _amount, _before, _wallet.balance_credits,
    _tenant_id, NULL, _description, COALESCE(_metadata, '{}'::jsonb)
  );

  BEGIN
    INSERT INTO public.wallet_ledger(
      tenant_id, movement_type, amount, reason, description,
      balance_before, balance_after, metadata
    ) VALUES (
      _tenant_id, 'credit', _amount, 'partner_super_wallet_redeem',
      COALESCE(_description, 'Asignación desde Super Wallet del partner'),
      0, 0,
      jsonb_build_object('partner_id', _partner_id, 'source', 'sync-external-core')
        || COALESCE(_metadata, '{}'::jsonb)
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RETURN _wallet;
END;
$$;

-- Only callable via service role; no GRANT to authenticated/anon.
REVOKE ALL ON FUNCTION public.partner_wallet_redeem_to_tenant_service(text, uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_wallet_redeem_to_tenant_service(text, uuid, integer, text, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.partner_wallet_redeem_to_tenant_service(text, uuid, integer, text, jsonb) FROM anon;