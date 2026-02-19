
-- Drop the restrictive owner-only policy
DROP POLICY IF EXISTS "Owners can manage tenant settings" ON public.tenant_settings;

-- Create a new policy that allows both owners and administradores
CREATE POLICY "Admins can manage tenant settings"
ON public.tenant_settings
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role])
);
