-- Allow partner-scoped super admins to view, insert, update, delete tenants
-- belonging to their partner scope.

-- Helper: get the partner_scope of the current user from user_roles
CREATE OR REPLACE FUNCTION public.get_user_partner_scope(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_scope
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- SELECT: partner admins can view tenants in their partner scope
CREATE POLICY "Partner admins can view their partner tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) IS NOT NULL
  AND partner_id = get_user_partner_scope(auth.uid())
);

-- INSERT: partner admins can create tenants assigned to their own partner scope
CREATE POLICY "Partner admins can insert tenants in their scope"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) IS NOT NULL
  AND partner_id = get_user_partner_scope(auth.uid())
);

-- UPDATE: partner admins can update their own partner's tenants
CREATE POLICY "Partner admins can update their partner tenants"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) IS NOT NULL
  AND partner_id = get_user_partner_scope(auth.uid())
)
WITH CHECK (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) IS NOT NULL
  AND partner_id = get_user_partner_scope(auth.uid())
);

-- DELETE: partner admins can delete tenants in their scope
CREATE POLICY "Partner admins can delete their partner tenants"
ON public.tenants
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) IS NOT NULL
  AND partner_id = get_user_partner_scope(auth.uid())
);