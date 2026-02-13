
DROP POLICY "Owners and marketers can manage knowledge base" ON public.ai_knowledge_base;

CREATE POLICY "Admins owners and marketers can manage knowledge base"
ON public.ai_knowledge_base
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role])
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['owner'::tenant_role, 'administrador'::tenant_role, 'manager'::tenant_role, 'marketer'::tenant_role])
);
