
-- Drop existing restrictive policies for INSERT, UPDATE, DELETE on events
DROP POLICY IF EXISTS "Users with marketer or owner role can insert events" ON public.events;
DROP POLICY IF EXISTS "Users with marketer or owner role can update events" ON public.events;
DROP POLICY IF EXISTS "Users with marketer or owner role can delete events" ON public.events;

-- Recreate with all operational roles
CREATE POLICY "Tenant users can insert events"
ON public.events FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role, 'asesor'::tenant_role])
);

CREATE POLICY "Tenant users can update events"
ON public.events FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role, 'asesor'::tenant_role])
);

CREATE POLICY "Tenant users can delete events"
ON public.events FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role])
);
