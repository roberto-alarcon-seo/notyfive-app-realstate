
-- =========================================================
-- SUPER WALLET POR PARTNER
-- =========================================================

CREATE TABLE IF NOT EXISTS public.partner_super_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text NOT NULL UNIQUE REFERENCES public.partners(id) ON UPDATE CASCADE ON DELETE CASCADE,
  balance_credits integer NOT NULL DEFAULT 0,
  low_balance_threshold integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_super_wallets_balance_nonneg CHECK (balance_credits >= 0)
);

CREATE INDEX IF NOT EXISTS idx_partner_super_wallets_partner ON public.partner_super_wallets(partner_id);

ALTER TABLE public.partner_super_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global super admins manage all super wallets"
  ON public.partner_super_wallets
  FOR ALL
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL)
  WITH CHECK (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL);

CREATE POLICY "Partner admins view own super wallet"
  ON public.partner_super_wallets
  FOR SELECT
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) = partner_id);

-- ledger
CREATE TABLE IF NOT EXISTS public.partner_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text NOT NULL REFERENCES public.partners(id) ON UPDATE CASCADE ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('TOPUP','REDEEM','ADJUSTMENT')),
  amount integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_user_id uuid,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner_created ON public.partner_wallet_ledger(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_tenant ON public.partner_wallet_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_type ON public.partner_wallet_ledger(movement_type);

ALTER TABLE public.partner_wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global super admins view all partner ledger"
  ON public.partner_wallet_ledger
  FOR SELECT
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL);

CREATE POLICY "Partner admins view own ledger"
  ON public.partner_wallet_ledger
  FOR SELECT
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) = partner_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_partner_wallet()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_partner_super_wallets_updated_at ON public.partner_super_wallets;
CREATE TRIGGER trg_partner_super_wallets_updated_at
  BEFORE UPDATE ON public.partner_super_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_partner_wallet();

-- =========================================================
-- RPC: TOPUP (only global super admin)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_wallet_topup(
  _partner_id text,
  _amount integer,
  _description text DEFAULT NULL
)
RETURNS public.partner_super_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet public.partner_super_wallets;
  _before integer;
  _uid uuid := auth.uid();
BEGIN
  IF NOT is_super_admin(_uid) OR get_user_partner_scope(_uid) IS NOT NULL THEN
    RAISE EXCEPTION 'Solo Super Admin global puede abonar a una Super Wallet';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  INSERT INTO public.partner_super_wallets(partner_id, balance_credits)
  VALUES (_partner_id, 0)
  ON CONFLICT (partner_id) DO NOTHING;

  SELECT * INTO _wallet FROM public.partner_super_wallets WHERE partner_id = _partner_id FOR UPDATE;
  _before := _wallet.balance_credits;

  UPDATE public.partner_super_wallets
    SET balance_credits = balance_credits + _amount
    WHERE partner_id = _partner_id
    RETURNING * INTO _wallet;

  INSERT INTO public.partner_wallet_ledger(
    partner_id, movement_type, amount, balance_before, balance_after,
    actor_user_id, description
  ) VALUES (
    _partner_id, 'TOPUP', _amount, _before, _wallet.balance_credits, _uid, _description
  );

  RETURN _wallet;
END;
$$;

-- =========================================================
-- RPC: REDEEM to tenant (super admin global, OR partner admin
-- whose partner_scope matches both wallet and tenant.partner_id)
-- =========================================================
CREATE OR REPLACE FUNCTION public.partner_wallet_redeem_to_tenant(
  _partner_id text,
  _tenant_id uuid,
  _amount integer,
  _description text DEFAULT NULL
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
  _scope text;
  _uid uuid := auth.uid();
BEGIN
  IF NOT is_super_admin(_uid) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  _scope := get_user_partner_scope(_uid);
  IF _scope IS NOT NULL AND _scope <> _partner_id THEN
    RAISE EXCEPTION 'No autorizado para esta Super Wallet';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT partner_id INTO _tenant_partner FROM public.tenants WHERE id = _tenant_id;
  IF _tenant_partner IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;
  IF _tenant_partner <> _partner_id THEN
    RAISE EXCEPTION 'El tenant no pertenece a este partner';
  END IF;

  SELECT * INTO _wallet FROM public.partner_super_wallets WHERE partner_id = _partner_id FOR UPDATE;
  IF _wallet IS NULL THEN
    RAISE EXCEPTION 'Super Wallet no inicializada';
  END IF;
  IF _wallet.balance_credits < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en la Super Wallet';
  END IF;

  _before := _wallet.balance_credits;

  UPDATE public.partner_super_wallets
    SET balance_credits = balance_credits - _amount
    WHERE partner_id = _partner_id
    RETURNING * INTO _wallet;

  -- Sumar al tenant (extra_credits acumulativo) y a message_credits efectivo.
  UPDATE public.tenants
    SET extra_credits = COALESCE(extra_credits,0) + _amount,
        message_credits = COALESCE(message_credits,0) + _amount
    WHERE id = _tenant_id;

  INSERT INTO public.partner_wallet_ledger(
    partner_id, movement_type, amount, balance_before, balance_after,
    tenant_id, actor_user_id, description
  ) VALUES (
    _partner_id, 'REDEEM', _amount, _before, _wallet.balance_credits,
    _tenant_id, _uid, _description
  );

  -- Registrar también en wallet_ledger del tenant si la tabla existe
  BEGIN
    INSERT INTO public.wallet_ledger(
      tenant_id, movement_type, amount, reason, description,
      balance_before, balance_after, metadata
    ) VALUES (
      _tenant_id, 'credit', _amount, 'partner_super_wallet_redeem',
      COALESCE(_description, 'Asignación desde Super Wallet del partner'),
      0, 0,
      jsonb_build_object('partner_id', _partner_id, 'actor_user_id', _uid)
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RETURN _wallet;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_wallet_topup(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_wallet_redeem_to_tenant(text, uuid, integer, text) TO authenticated;
