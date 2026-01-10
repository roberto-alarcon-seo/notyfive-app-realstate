-- ====================================================================
-- PROPERTIES MODULE - Tables and Indexes
-- ====================================================================

-- 2.1 Main properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_code text NOT NULL,
  title text NOT NULL,
  operation_type text NOT NULL DEFAULT 'sale',
  property_type text,
  zone text NOT NULL,
  address text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'available',
  is_active boolean NOT NULL DEFAULT true,
  assigned_user_id uuid REFERENCES public.profiles(id),
  template_id uuid REFERENCES public.templates(id),
  ai_prompt text,
  internal_notes text,
  maintenance_fee numeric,
  visit_availability text,
  accepted_credits text[] DEFAULT '{}'::text[],
  youtube_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_tenant_code ON public.properties (tenant_id, property_code);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_status ON public.properties (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_zone ON public.properties (tenant_id, zone);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_price ON public.properties (tenant_id, price);

-- 2.2 Property FAQ
CREATE TABLE IF NOT EXISTS public.property_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_faq_property ON public.property_faq (property_id, sort_order);

-- 2.3 Property Images
CREATE TABLE IF NOT EXISTS public.property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_path text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON public.property_images (property_id, sort_order);

-- 2.4 Property Documents
CREATE TABLE IF NOT EXISTS public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_path text,
  file_name text NOT NULL,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_documents_property ON public.property_documents (property_id);

-- 2.5 Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_properties_updated_at();

-- 6.1 Add columns to contacts for property integration
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS re_property_interest_id uuid REFERENCES public.properties(id);

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS re_properties_viewed_ids uuid[] DEFAULT '{}'::uuid[];

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS re_property_not_interested_reason text;

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS re_property_followup_status text;

CREATE INDEX IF NOT EXISTS idx_contacts_property_interest ON public.contacts (re_property_interest_id);

-- ====================================================================
-- RLS Policies
-- ====================================================================

-- Enable RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

-- Properties policies
CREATE POLICY "Users can view properties in their tenant"
ON public.properties FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users with marketer or owner role can insert properties"
ON public.properties FOR INSERT
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'marketer'::tenant_role]));

CREATE POLICY "Users with marketer or owner role can update properties"
ON public.properties FOR UPDATE
USING ((tenant_id = get_user_tenant_id(auth.uid())) AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'marketer'::tenant_role]));

CREATE POLICY "Users with marketer or owner role can delete properties"
ON public.properties FOR DELETE
USING ((tenant_id = get_user_tenant_id(auth.uid())) AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'marketer'::tenant_role]));

CREATE POLICY "Super admins can manage all properties"
ON public.properties FOR ALL
USING (is_super_admin(auth.uid()));

-- Property FAQ policies
CREATE POLICY "Users can view property_faq in their tenant"
ON public.property_faq FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users with marketer or owner role can manage property_faq"
ON public.property_faq FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'marketer'::tenant_role]));

CREATE POLICY "Super admins can manage all property_faq"
ON public.property_faq FOR ALL
USING (is_super_admin(auth.uid()));

-- Property Images policies
CREATE POLICY "Users can view property_images in their tenant"
ON public.property_images FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users with marketer or owner role can manage property_images"
ON public.property_images FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'marketer'::tenant_role]));

CREATE POLICY "Super admins can manage all property_images"
ON public.property_images FOR ALL
USING (is_super_admin(auth.uid()));

-- Property Documents policies
CREATE POLICY "Users can view property_documents in their tenant"
ON public.property_documents FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users with marketer or owner role can manage property_documents"
ON public.property_documents FOR ALL
USING ((tenant_id = get_user_tenant_id(auth.uid())) AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'marketer'::tenant_role]));

CREATE POLICY "Super admins can manage all property_documents"
ON public.property_documents FOR ALL
USING (is_super_admin(auth.uid()));

-- ====================================================================
-- Storage Buckets
-- ====================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-documents', 'property-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for property-images
CREATE POLICY "Authenticated users can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view property images"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can update property images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete property images"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-images' AND auth.role() = 'authenticated');

-- Storage policies for property-documents
CREATE POLICY "Authenticated users can upload property documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view property documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update property documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete property documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');