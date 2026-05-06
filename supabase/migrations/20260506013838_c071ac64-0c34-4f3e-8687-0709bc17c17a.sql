CREATE POLICY "Managers can view profiles in their tenant"
ON public.profiles FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_tenant_role(auth.uid(), 'manager'::tenant_role)
);