
-- Fix conversations RLS: allow administrador and manager roles for INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users with marketer or owner role can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users with marketer or owner role can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users with marketer or owner role can update conversations" ON public.conversations;

CREATE POLICY "Admins and managers can insert conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

CREATE POLICY "Admins and managers can update conversations"
ON public.conversations FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

CREATE POLICY "Admins and managers can delete conversations"
ON public.conversations FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

-- Fix messages RLS: allow administrador and manager roles for INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users with marketer or owner role can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Users with marketer or owner role can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users with marketer or owner role can update messages" ON public.messages;

CREATE POLICY "Admins and managers can insert messages"
ON public.messages FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

CREATE POLICY "Admins and managers can update messages"
ON public.messages FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);

CREATE POLICY "Admins and managers can delete messages"
ON public.messages FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_tenant_role(auth.uid(), ARRAY['administrador','manager','owner','marketer']::tenant_role[])
);
