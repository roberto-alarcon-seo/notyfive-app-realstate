
-- Actualizar la función check_tenant_user_limit para usar nuevos roles
CREATE OR REPLACE FUNCTION public.check_tenant_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
  _max_users INTEGER;
  _current_users INTEGER;
  _is_admin BOOLEAN;
BEGIN
  -- Get tenant_id from the new profile
  _tenant_id := NEW.tenant_id;
  
  -- Skip check if no tenant_id (super admin)
  IF _tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this user is being assigned as administrador (legacy: owner)
  -- Administradores don't count against limit
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND (tenant_role = 'administrador' OR tenant_role = 'owner')
  ) INTO _is_admin;
  
  -- Also check if we're in the middle of creating a user (profile created before role)
  -- This happens during tenant creation flow
  IF _is_admin OR NEW.status = 'inactive' THEN
    RETURN NEW;
  END IF;
  
  -- Get tenant limits
  SELECT max_users INTO _max_users
  FROM public.tenants
  WHERE id = _tenant_id;
  
  -- Count current active users in the tenant (excluding administradores and owners)
  SELECT COUNT(*) INTO _current_users
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.tenant_id = _tenant_id
    AND p.status = 'active'
    AND ur.tenant_role NOT IN ('owner', 'administrador');
  
  -- Check if limit would be exceeded
  IF _current_users >= _max_users THEN
    RAISE EXCEPTION 'Has alcanzado el número máximo de usuarios permitidos por tu plan. Actualiza tu plan para agregar más usuarios.';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crear trigger para manejar nuevos usuarios (si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insertar perfil para el usuario huérfano con status=inactive para bypass el límite
INSERT INTO public.profiles (id, tenant_id, name, email, status, first_login_required)
SELECT 
  'e754d96b-64b6-4dfe-a56f-579f9907136e'::uuid,
  'cb321620-7a99-484b-a35e-a411695faadc'::uuid,
  'Manager',
  'manager_linkasamx@gmail.com',
  'inactive',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = 'e754d96b-64b6-4dfe-a56f-579f9907136e'
);

-- Insertar rol para el usuario huérfano
INSERT INTO public.user_roles (user_id, global_role, tenant_role)
SELECT 
  'e754d96b-64b6-4dfe-a56f-579f9907136e'::uuid,
  'user'::public.global_role,
  'manager'::public.tenant_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = 'e754d96b-64b6-4dfe-a56f-579f9907136e'
);
