
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS whatsapp_sender_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_sender_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_sender_error text;
