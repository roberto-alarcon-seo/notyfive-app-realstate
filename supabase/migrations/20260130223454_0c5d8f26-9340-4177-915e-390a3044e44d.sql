-- =============================================
-- PARTE 2: MIGRAR DATOS Y CREAR ESTRUCTURAS
-- =============================================

-- 1. Migrar usuarios existentes a nuevos roles
UPDATE public.user_roles 
SET tenant_role = 'administrador'::public.tenant_role
WHERE tenant_role = 'owner'::public.tenant_role;

UPDATE public.user_roles 
SET tenant_role = 'manager'::public.tenant_role
WHERE tenant_role = 'marketer'::public.tenant_role;

UPDATE public.user_roles 
SET tenant_role = 'asesor'::public.tenant_role
WHERE tenant_role = 'readonly'::public.tenant_role;

-- =============================================
-- TABLA DE ASIGNACIONES DE PROPIEDADES
-- =============================================

CREATE TABLE IF NOT EXISTS public.property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, user_id)
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_property_assignments_user ON public.property_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_property_assignments_property ON public.property_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_property_assignments_tenant ON public.property_assignments(tenant_id);

-- Habilitar RLS
ALTER TABLE public.property_assignments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CAMPOS DE AUDITORÍA EN MENSAJES
-- =============================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS on_behalf_of_user_id UUID REFERENCES auth.users(id);

-- =============================================
-- FUNCIONES DE SEGURIDAD
-- =============================================

-- Función para verificar si es administrador del tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_role = 'administrador'::public.tenant_role
  );
$$;

-- Función para verificar si es manager o administrador (acceso operativo completo)
CREATE OR REPLACE FUNCTION public.is_tenant_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_role IN ('administrador'::public.tenant_role, 'manager'::public.tenant_role)
  );
$$;

-- Función para verificar si un asesor tiene asignada una propiedad
CREATE OR REPLACE FUNCTION public.has_property_assignment(_user_id UUID, _property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.property_assignments
    WHERE user_id = _user_id
      AND property_id = _property_id
  );
$$;

-- Función para verificar si puede acceder a una conversación
CREATE OR REPLACE FUNCTION public.can_access_conversation(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_super_admin(_user_id)
    OR public.is_tenant_manager_or_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.contacts ct ON ct.id = c.contact_id
      LEFT JOIN public.property_assignments pa ON pa.property_id = ct.re_property_interest_id
      WHERE c.id = _conversation_id
        AND (pa.user_id = _user_id OR ct.assigned_agent_id = _user_id)
    );
$$;

-- =============================================
-- POLÍTICAS RLS PARA PROPERTY_ASSIGNMENTS
-- =============================================

-- Usuarios autenticados del tenant pueden ver asignaciones
CREATE POLICY "Tenant users can view assignments" ON public.property_assignments
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Solo Admin/Manager pueden crear asignaciones
CREATE POLICY "Admin/Manager can create assignments" ON public.property_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_manager_or_admin(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

-- Solo Admin/Manager pueden actualizar asignaciones
CREATE POLICY "Admin/Manager can update assignments" ON public.property_assignments
  FOR UPDATE
  TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_manager_or_admin(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

-- Solo Admin/Manager pueden eliminar asignaciones
CREATE POLICY "Admin/Manager can delete assignments" ON public.property_assignments
  FOR DELETE
  TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_manager_or_admin(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

-- =============================================
-- ACTUALIZAR RLS DE PROPERTIES PARA ASESORES
-- =============================================

-- Eliminar política existente si interfiere
DROP POLICY IF EXISTS "Users can view properties" ON public.properties;
DROP POLICY IF EXISTS "Tenant users can view their properties" ON public.properties;
DROP POLICY IF EXISTS "Role-based property access" ON public.properties;

-- Nueva política: todos ven propiedades de su tenant por ahora (la restricción será en el frontend y queries)
-- Esto evita complejidad en RLS mientras mantenemos la seguridad a nivel de tenant
CREATE POLICY "Tenant users can view their properties" ON public.properties
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- =============================================
-- TRIGGER PARA AUDITAR ASIGNACIONES
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_property_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_events (
      tenant_id,
      event_type,
      actor_user_id,
      target_user_id,
      metadata
    ) VALUES (
      NEW.tenant_id,
      'property_assignment',
      auth.uid(),
      NEW.user_id,
      jsonb_build_object(
        'action', 'assigned',
        'property_id', NEW.property_id
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_events (
      tenant_id,
      event_type,
      actor_user_id,
      target_user_id,
      metadata
    ) VALUES (
      OLD.tenant_id,
      'property_assignment',
      auth.uid(),
      OLD.user_id,
      jsonb_build_object(
        'action', 'unassigned',
        'property_id', OLD.property_id
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_property_assignment ON public.property_assignments;
CREATE TRIGGER trg_audit_property_assignment
  AFTER INSERT OR DELETE ON public.property_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_property_assignment();

-- =============================================
-- MIGRAR ASIGNACIONES EXISTENTES
-- =============================================

-- Crear asignaciones basadas en el campo assigned_user_id existente en properties
INSERT INTO public.property_assignments (tenant_id, property_id, user_id, assigned_by)
SELECT 
  p.tenant_id,
  p.id,
  p.assigned_user_id,
  p.assigned_user_id
FROM public.properties p
WHERE p.assigned_user_id IS NOT NULL
ON CONFLICT (property_id, user_id) DO NOTHING;