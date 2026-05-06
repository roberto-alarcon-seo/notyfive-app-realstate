-- Permitir a managers ver user_roles dentro de su tenant
-- (necesario para listar asesores en el editor de propiedades)
CREATE POLICY "Managers can view tenant user roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND has_tenant_role(auth.uid(), 'manager'::tenant_role)
);