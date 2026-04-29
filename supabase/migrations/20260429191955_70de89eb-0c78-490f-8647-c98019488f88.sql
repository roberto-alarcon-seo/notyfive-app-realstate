-- Add partner_id to master_templates for partner-scoped templates
ALTER TABLE public.master_templates
  ADD COLUMN IF NOT EXISTS partner_id text REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_master_templates_partner ON public.master_templates(partner_id);
CREATE INDEX IF NOT EXISTS idx_master_templates_category ON public.master_templates(category);

-- Drop the unique-by-name constraint (we now allow same name across partners)
ALTER TABLE public.master_templates DROP CONSTRAINT IF EXISTS master_templates_name_key;

-- Replace with composite uniqueness: (partner_id, name) — NULL partner_id treated as global
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_templates_partner_name
  ON public.master_templates(COALESCE(partner_id, '__global__'), name);
