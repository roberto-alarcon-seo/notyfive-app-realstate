-- Add functional label column to master_templates
ALTER TABLE public.master_templates
  ADD COLUMN IF NOT EXISTS label text;

CREATE INDEX IF NOT EXISTS idx_master_templates_label ON public.master_templates(label);

-- Seed labels for existing master templates
UPDATE public.master_templates SET label = 'Bienvenida' WHERE name IN (
  'system_bienvenida_lead', 're_welcome_zillow', 're_welcome_inmuebles24', 're_welcome_meta_ads'
);

UPDATE public.master_templates SET label = 'Seguimiento' WHERE name IN (
  'system_seguimiento', 're_followup_24h', 're_followup_72h', 're_followup_week'
);

UPDATE public.master_templates SET label = 'Citas' WHERE name IN (
  'system_confirmacion_cita', 're_visit_confirmation', 're_visit_reminder_24h', 're_visit_reminder_2h'
);

UPDATE public.master_templates SET label = 'Documentación' WHERE name IN (
  're_documents_request', 're_documents_reminder', 're_credit_preapproval'
);

UPDATE public.master_templates SET label = 'Post-venta' WHERE name IN (
  're_offer_accepted', 're_post_sale_thanks', 're_post_sale_referral'
);