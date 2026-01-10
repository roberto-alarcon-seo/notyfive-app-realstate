-- Create tenant_settings table for conversion configuration
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  internal_conversion_stage text NOT NULL DEFAULT 'visit_done',
  internal_conversion_first_time_only boolean NOT NULL DEFAULT true,
  internal_conversion_allow_reversal boolean NOT NULL DEFAULT false,
  meta_enabled boolean NOT NULL DEFAULT false,
  meta_pixel_id text,
  meta_send_pixel boolean NOT NULL DEFAULT true,
  meta_send_capi boolean NOT NULL DEFAULT false,
  meta_capi_access_token text,
  meta_test_event_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create meta_event_mappings table
CREATE TABLE IF NOT EXISTS public.meta_event_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pipeline_stage text NOT NULL,
  meta_event_type text NOT NULL,
  meta_event_name text NOT NULL,
  send_pixel boolean NOT NULL DEFAULT true,
  send_capi boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  event_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pipeline_stage, meta_event_name)
);

CREATE INDEX IF NOT EXISTS idx_meta_event_mappings_tenant_stage
ON public.meta_event_mappings (tenant_id, pipeline_stage);

-- Create conversion_event_logs table
CREATE TABLE IF NOT EXISTS public.conversion_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source text NOT NULL,
  pipeline_stage text,
  event_name text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversion_logs_tenant_contact
ON public.conversion_event_logs (tenant_id, contact_id);

-- Add conversion tracking columns to contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS internal_converted_at timestamptz;

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS internal_converted_stage text;

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS internal_conversion_count int NOT NULL DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_event_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_settings
CREATE POLICY "Users can view tenant settings in their tenant"
ON public.tenant_settings FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage tenant settings"
ON public.tenant_settings FOR ALL
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_tenant_role(auth.uid(), 'owner'::tenant_role));

CREATE POLICY "Super admins can manage all tenant settings"
ON public.tenant_settings FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS policies for meta_event_mappings
CREATE POLICY "Users can view meta mappings in their tenant"
ON public.meta_event_mappings FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage meta mappings"
ON public.meta_event_mappings FOR ALL
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_tenant_role(auth.uid(), 'owner'::tenant_role));

CREATE POLICY "Super admins can manage all meta mappings"
ON public.meta_event_mappings FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS policies for conversion_event_logs
CREATE POLICY "Users can view conversion logs in their tenant"
ON public.conversion_event_logs FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Super admins can manage all conversion logs"
ON public.conversion_event_logs FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert conversion logs"
ON public.conversion_event_logs FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Update trigger for tenant_settings
CREATE OR REPLACE FUNCTION public.update_tenant_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_settings_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_settings_updated_at();

-- Update trigger for meta_event_mappings
CREATE TRIGGER update_meta_event_mappings_updated_at
BEFORE UPDATE ON public.meta_event_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_settings_updated_at();