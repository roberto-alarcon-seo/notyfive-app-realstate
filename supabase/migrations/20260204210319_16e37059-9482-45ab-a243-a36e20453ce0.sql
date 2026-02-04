
-- Actualizar handle_new_user para crear perfiles como inactive por defecto
-- Esto permite que pasen el check de límite de usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
  _global_role public.global_role;
  _tenant_role public.tenant_role;
BEGIN
  -- Obtener metadata del usuario
  _tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::UUID;
  _global_role := COALESCE((NEW.raw_user_meta_data ->> 'global_role')::public.global_role, 'user');
  _tenant_role := (NEW.raw_user_meta_data ->> 'tenant_role')::public.tenant_role;
  
  -- Si es super_admin, no tiene tenant ni tenant_role
  IF _global_role = 'super_admin' THEN
    _tenant_id := NULL;
    _tenant_role := NULL;
  END IF;
  
  -- Crear perfil con status inactive por defecto (bypass del límite de usuarios)
  -- El usuario será activado cuando complete su primer login
  INSERT INTO public.profiles (id, tenant_id, name, email, status, first_login_required)
  VALUES (
    NEW.id,
    _tenant_id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    'inactive',
    true
  );
  
  -- Crear rol
  INSERT INTO public.user_roles (user_id, global_role, tenant_role)
  VALUES (NEW.id, _global_role, _tenant_role);
  
  RETURN NEW;
END;
$function$;
