
-- Restrict asesores to only see/edit conversations of contacts assigned to them (or unassigned)
-- Managers, administradores, owners, marketers, super_admins keep full tenant visibility.

-- Helper: check if a contact belongs to (or is unassigned for) the current user
CREATE OR REPLACE FUNCTION public.contact_visible_to_agent(_contact_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = _contact_id
      AND (c.assigned_agent_id IS NULL OR c.assigned_agent_id = _user_id)
  );
$$;

-- ===== conversations =====
DROP POLICY IF EXISTS "Users can view conversations in their tenant" ON public.conversations;
CREATE POLICY "Users can view conversations in their tenant"
ON public.conversations FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_any_tenant_role(auth.uid(), ARRAY['administrador'::tenant_role,'manager'::tenant_role,'owner'::tenant_role,'marketer'::tenant_role])
    OR public.contact_visible_to_agent(contact_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins and managers can update conversations" ON public.conversations;
CREATE POLICY "Tenant users can update conversations"
ON public.conversations FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_any_tenant_role(auth.uid(), ARRAY['administrador'::tenant_role,'manager'::tenant_role,'owner'::tenant_role,'marketer'::tenant_role])
    OR public.contact_visible_to_agent(contact_id, auth.uid())
  )
);

-- ===== messages =====
CREATE OR REPLACE FUNCTION public.conversation_visible_to_agent(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations cv
    JOIN public.contacts c ON c.id = cv.contact_id
    WHERE cv.id = _conversation_id
      AND (c.assigned_agent_id IS NULL OR c.assigned_agent_id = _user_id)
  );
$$;

DROP POLICY IF EXISTS "Users can view messages in their tenant" ON public.messages;
CREATE POLICY "Users can view messages in their tenant"
ON public.messages FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_any_tenant_role(auth.uid(), ARRAY['administrador'::tenant_role,'manager'::tenant_role,'owner'::tenant_role,'marketer'::tenant_role])
    OR public.conversation_visible_to_agent(conversation_id, auth.uid())
  )
);
