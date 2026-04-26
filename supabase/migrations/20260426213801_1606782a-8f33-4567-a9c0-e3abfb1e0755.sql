-- Add partner_id column to properties for multi-tenant isolation at inventory level
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS partner_id TEXT;

-- Backfill existing properties using their tenant's partner_id
UPDATE public.properties p
SET partner_id = t.partner_id
FROM public.tenants t
WHERE p.tenant_id = t.id
  AND p.partner_id IS NULL
  AND t.partner_id IS NOT NULL;

-- Index for filtering by partner
CREATE INDEX IF NOT EXISTS properties_partner_id_idx
  ON public.properties (partner_id);