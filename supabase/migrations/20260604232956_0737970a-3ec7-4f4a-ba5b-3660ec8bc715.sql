CREATE TABLE public.meta_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  app_id text,
  ad_account_id text,
  ad_account_name text,
  pixel_id text,
  pixel_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  error_message text,
  meta_user_id text,
  meta_user_name text,
  connected_by uuid REFERENCES auth.users(id),
  connected_at timestamptz,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX meta_ads_connections_tenant_unique
  ON public.meta_ads_connections(tenant_id)
  WHERE status != 'disconnected';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ads_connections TO authenticated;
GRANT ALL ON public.meta_ads_connections TO service_role;

ALTER TABLE public.meta_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.meta_ads_connections
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "super_admin_access" ON public.meta_ads_connections
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.meta_ads_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();