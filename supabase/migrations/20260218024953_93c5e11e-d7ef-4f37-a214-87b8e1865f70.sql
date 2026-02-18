
-- Fix templates RLS policies to include administrador and manager roles

DROP POLICY "Users with marketer or owner role can insert templates" ON public.templates;
CREATE POLICY "Operational roles can insert templates" ON public.templates
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role])
);

DROP POLICY "Users with marketer or owner role can update templates" ON public.templates;
CREATE POLICY "Operational roles can update templates" ON public.templates
FOR UPDATE USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role])
);

DROP POLICY "Users with marketer or owner role can delete templates" ON public.templates;
CREATE POLICY "Operational roles can delete templates" ON public.templates
FOR DELETE USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role])
);
