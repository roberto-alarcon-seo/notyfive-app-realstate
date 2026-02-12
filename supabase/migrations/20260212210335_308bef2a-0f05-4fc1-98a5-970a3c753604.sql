
-- Drop restrictive INSERT policy on conversation_activity
DROP POLICY IF EXISTS "Users with marketer or owner role can insert activity" ON public.conversation_activity;

-- Create broader tenant-level INSERT policy
CREATE POLICY "Tenant users can insert activity"
ON public.conversation_activity
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
