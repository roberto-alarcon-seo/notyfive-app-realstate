
-- Drop existing restrictive INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Users with marketer or owner role can insert followups" ON public.conversation_followups;
DROP POLICY IF EXISTS "Users with marketer or owner role can update followups" ON public.conversation_followups;
DROP POLICY IF EXISTS "Users with marketer or owner role can delete followups" ON public.conversation_followups;

-- Recreate with all tenant roles allowed
CREATE POLICY "Tenant users can insert followups"
ON public.conversation_followups FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can update followups"
ON public.conversation_followups FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can delete followups"
ON public.conversation_followups FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()));
