
-- Drop old policies that reference 'owner' role
DROP POLICY IF EXISTS "Owners can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Owners can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Owners can insert profiles in their tenant" ON public.profiles;

-- Create new policies with updated roles (administrador instead of owner)
-- Administradores can view all profiles in their tenant
CREATE POLICY "Admins can view profiles in their tenant" 
ON public.profiles 
FOR SELECT 
USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND 
  (has_tenant_role(auth.uid(), 'administrador'::tenant_role) OR has_tenant_role(auth.uid(), 'owner'::tenant_role))
);

-- Administradores can update profiles in their tenant
CREATE POLICY "Admins can update profiles in their tenant" 
ON public.profiles 
FOR UPDATE 
USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND 
  (has_tenant_role(auth.uid(), 'administrador'::tenant_role) OR has_tenant_role(auth.uid(), 'owner'::tenant_role))
);

-- Administradores can insert profiles in their tenant
CREATE POLICY "Admins can insert profiles in their tenant" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) AND 
  (has_tenant_role(auth.uid(), 'administrador'::tenant_role) OR has_tenant_role(auth.uid(), 'owner'::tenant_role))
);

-- Also update user_roles policies to allow viewing team members
DROP POLICY IF EXISTS "Owners can view tenant user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update tenant user roles" ON public.user_roles;

-- Admins can view all user roles in their tenant
CREATE POLICY "Admins can view tenant user roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = user_roles.user_id 
    AND p.tenant_id = get_user_tenant_id(auth.uid())
  ) AND (has_tenant_role(auth.uid(), 'administrador'::tenant_role) OR has_tenant_role(auth.uid(), 'owner'::tenant_role))
);

-- Admins can update user roles in their tenant
CREATE POLICY "Admins can update tenant user roles"
ON public.user_roles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = user_roles.user_id 
    AND p.tenant_id = get_user_tenant_id(auth.uid())
  ) AND (has_tenant_role(auth.uid(), 'administrador'::tenant_role) OR has_tenant_role(auth.uid(), 'owner'::tenant_role))
);
