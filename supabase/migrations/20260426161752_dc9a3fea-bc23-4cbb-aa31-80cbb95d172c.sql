-- Add description and metadata columns to wallet_ledger for richer auditing
-- of external (Core) recharges and other movements.
ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_tenant_created
  ON public.wallet_ledger (tenant_id, created_at DESC);
