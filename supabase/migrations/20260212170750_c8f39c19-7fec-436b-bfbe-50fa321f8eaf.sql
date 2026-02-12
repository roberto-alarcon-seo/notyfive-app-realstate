
-- Drop outdated policies
DROP POLICY IF EXISTS "Users with marketer or owner role can insert properties" ON public.properties;
DROP POLICY IF EXISTS "Users with marketer or owner role can update properties" ON public.properties;
DROP POLICY IF EXISTS "Users with marketer or owner role can delete properties" ON public.properties;

-- Recreate with correct roles (administrador, manager, plus legacy owner/marketer)
CREATE POLICY "Admins and managers can insert properties"
ON public.properties FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

CREATE POLICY "Admins and managers can update properties"
ON public.properties FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

CREATE POLICY "Admins and managers can delete properties"
ON public.properties FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);
