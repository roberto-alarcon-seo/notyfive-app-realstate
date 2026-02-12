
-- Fix property_images RLS policies
DROP POLICY IF EXISTS "Users with marketer or owner role can manage property_images" ON public.property_images;

CREATE POLICY "Admins and managers can manage property_images"
ON public.property_images FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

-- Fix property_documents RLS policies
DROP POLICY IF EXISTS "Users with marketer or owner role can manage property_documents" ON public.property_documents;

CREATE POLICY "Admins and managers can manage property_documents"
ON public.property_documents FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

-- Fix property_faq RLS policies
DROP POLICY IF EXISTS "Users with marketer or owner role can manage property_faq" ON public.property_faq;

CREATE POLICY "Admins and managers can manage property_faq"
ON public.property_faq FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);
