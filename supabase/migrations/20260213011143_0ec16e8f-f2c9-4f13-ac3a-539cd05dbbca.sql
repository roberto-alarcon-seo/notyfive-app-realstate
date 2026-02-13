-- Fix UPDATE policy to include administrador role
DROP POLICY IF EXISTS "Users with marketer or owner role can update contacts" ON public.contacts;
CREATE POLICY "Tenant users with admin roles can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'marketer'::tenant_role, 'manager'::tenant_role])
);

-- Fix INSERT policy to include administrador role
DROP POLICY IF EXISTS "Users with marketer or owner role can insert contacts" ON public.contacts;
CREATE POLICY "Tenant users with admin roles can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'marketer'::tenant_role, 'manager'::tenant_role])
);

-- Fix DELETE policy to include administrador role
DROP POLICY IF EXISTS "Users with marketer or owner role can delete contacts" ON public.contacts;
CREATE POLICY "Tenant users with admin roles can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'marketer'::tenant_role])
);