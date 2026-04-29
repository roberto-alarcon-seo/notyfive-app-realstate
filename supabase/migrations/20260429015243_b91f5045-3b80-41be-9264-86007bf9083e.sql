-- Allow super admins to insert audit events directly from the admin panel
CREATE POLICY "Super admins can insert security events"
ON public.security_events
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));