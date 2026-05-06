CREATE POLICY "Asesores can update their assigned contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND assigned_agent_id = auth.uid()
  AND has_any_tenant_role(auth.uid(), ARRAY['asesor'::tenant_role])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND assigned_agent_id = auth.uid()
);