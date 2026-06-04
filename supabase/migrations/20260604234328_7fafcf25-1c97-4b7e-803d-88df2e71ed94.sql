
CREATE TABLE public.meta_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,

  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  meta_form_id text,

  name text NOT NULL,
  objective text NOT NULL DEFAULT 'LEAD_GENERATION',

  headline text NOT NULL,
  primary_text text NOT NULL,
  description text,
  cta_type text DEFAULT 'LEARN_MORE',

  age_min int DEFAULT 25,
  age_max int DEFAULT 65,
  genders text[] DEFAULT ARRAY['1','2'],
  geo_locations jsonb,
  interests jsonb,
  daily_budget_cents int,

  image_url text,

  lead_form_fields jsonb DEFAULT '[{"type":"FULL_NAME"},{"type":"PHONE"},{"type":"EMAIL"}]'::jsonb,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','publishing','active','paused','error')),
  publish_error text,
  ai_generated_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_ads_campaigns_tenant ON public.meta_ads_campaigns(tenant_id, created_at DESC);
CREATE INDEX idx_meta_ads_campaigns_property ON public.meta_ads_campaigns(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ads_campaigns TO authenticated;
GRANT ALL ON public.meta_ads_campaigns TO service_role;

ALTER TABLE public.meta_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_meta_campaigns" ON public.meta_ads_campaigns
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "super_admin_access_meta_campaigns" ON public.meta_ads_campaigns
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_meta_ads_campaigns_updated_at
  BEFORE UPDATE ON public.meta_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
