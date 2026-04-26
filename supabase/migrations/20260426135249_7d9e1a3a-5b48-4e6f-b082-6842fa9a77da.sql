-- Add external integration columns to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS managed_externally BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_external_id 
  ON public.tenants(external_id) 
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_managed_externally 
  ON public.tenants(managed_externally) 
  WHERE managed_externally = true;

-- Internal system auth table
CREATE TABLE IF NOT EXISTS public.internal_system_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_system_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage internal_system_auth"
  ON public.internal_system_auth
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_internal_system_auth_updated_at
  BEFORE UPDATE ON public.internal_system_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();