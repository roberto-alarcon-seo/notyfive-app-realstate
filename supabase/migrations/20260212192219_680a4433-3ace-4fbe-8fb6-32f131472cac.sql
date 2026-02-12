
-- Fix tenant_ai_settings RLS: allow administrador and manager roles
DROP POLICY IF EXISTS "Owners can manage AI settings in their tenant" ON public.tenant_ai_settings;

CREATE POLICY "Admins and managers can manage AI settings"
ON public.tenant_ai_settings FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner']::tenant_role[])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner']::tenant_role[])
);
