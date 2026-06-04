ALTER TABLE public.meta_ads_campaigns
  ADD COLUMN IF NOT EXISTS campaign_objective text
    NOT NULL DEFAULT 'LEAD_GENERATION'
    CHECK (campaign_objective IN ('LEAD_GENERATION', 'MESSAGES')),
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number text,
  ADD COLUMN IF NOT EXISTS facebook_page_id text;