# Documentación del Módulo de Usuarios, Roles y Permisos

## Prompt para ChatGPT

---

**Contexto del Sistema:**

Estoy desarrollando una plataforma SaaS multi-tenant para agentes inmobiliarios (NotyFive) con las siguientes características:
- Stack: React + TypeScript + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- Arquitectura: Multi-tenant con aislamiento por `tenant_id`

---

## 📊 ARQUITECTURA ACTUAL DEL MÓDULO

### 1. TABLAS DE BASE DE DATOS

#### 1.1 `auth.users` (Supabase Auth - Solo lectura)
- Tabla manejada por Supabase Auth
- Contiene credenciales y metadata del usuario
- NO se modifica directamente

#### 1.2 `public.profiles`
Almacena información adicional del usuario y su asociación con el tenant.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),  -- NULL para super_admin
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'active',  -- 'active', 'inactive', 'disabled'
  first_login_required BOOLEAN DEFAULT true,
  password_set_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.3 `public.user_roles`
Almacena los roles de cada usuario (separado de profiles para seguridad).

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_role global_role DEFAULT 'user',  -- 'super_admin' | 'user'
  tenant_role tenant_role,                  -- 'owner' | 'marketer' | 'readonly'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.4 `public.tenants`
Información de cada empresa/organización.

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan tenant_plan DEFAULT 'trial',
  status tenant_status DEFAULT 'active',
  billing_state tenant_billing_state DEFAULT 'ONBOARDING_PAID',
  max_users INTEGER DEFAULT 1,
  max_contacts INTEGER DEFAULT 1000,
  message_credits INTEGER DEFAULT 0,
  -- Campos de Stripe y billing...
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1.5 `public.security_events`
Log de auditoría para eventos de seguridad.

```sql
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2. ENUMS DE ROLES

```sql
-- Rol global del sistema
CREATE TYPE public.global_role AS ENUM ('super_admin', 'user');

-- Rol dentro del tenant
CREATE TYPE public.tenant_role AS ENUM ('owner', 'marketer', 'readonly');
```

---

### 3. JERARQUÍA DE ROLES

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPER_ADMIN                               │
│  - Acceso total al sistema                                       │
│  - Puede ver/editar todos los tenants                           │
│  - Panel de administración global                                │
│  - Impersonación de tenants (support mode)                       │
│  - NO pertenece a ningún tenant (tenant_id = NULL)              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    OWNER      │   │   MARKETER    │   │   READONLY    │
│               │   │               │   │               │
│ - Acceso      │   │ - Contactos   │   │ - Solo        │
│   completo    │   │ - Campañas    │   │   lectura     │
│   al tenant   │   │ - Templates   │   │ - Dashboard   │
│ - Gestión de  │   │ - Inbox       │   │ - Reportes    │
│   usuarios    │   │ - Sin acceso  │   │               │
│ - Facturación │   │   a settings  │   │               │
│ - Integracion │   │   ni usuarios │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

### 4. FUNCIONES DE SEGURIDAD (SECURITY DEFINER)

#### 4.1 Verificación de Super Admin
```sql
CREATE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND global_role = 'super_admin'
  );
$$;
```

#### 4.2 Verificación de Rol de Tenant
```sql
CREATE FUNCTION public.has_tenant_role(_user_id uuid, _role tenant_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_role = _role
  );
$$;
```

#### 4.3 Obtener Tenant ID del Usuario
```sql
CREATE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id;
$$;
```

---

### 5. TRIGGERS DE SEGURIDAD

#### 5.1 Creación Automática de Profile y Rol
```sql
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  _tenant_id UUID;
  _global_role public.global_role;
  _tenant_role public.tenant_role;
BEGIN
  _tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::UUID;
  _global_role := COALESCE((NEW.raw_user_meta_data ->> 'global_role')::public.global_role, 'user');
  _tenant_role := (NEW.raw_user_meta_data ->> 'tenant_role')::public.tenant_role;
  
  IF _global_role = 'super_admin' THEN
    _tenant_id := NULL;
    _tenant_role := NULL;
  END IF;
  
  -- Crear perfil
  INSERT INTO public.profiles (id, tenant_id, name, email)
  VALUES (NEW.id, _tenant_id, COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email), NEW.email);
  
  -- Crear rol
  INSERT INTO public.user_roles (user_id, global_role, tenant_role)
  VALUES (NEW.id, _global_role, _tenant_role);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### 5.2 Prevención de Escalación de Privilegios
```sql
CREATE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_actor_is_super_admin boolean;
  v_actor_is_owner boolean;
  v_target_tenant_id uuid;
BEGIN
  v_actor_is_super_admin := is_super_admin(auth.uid());
  v_actor_is_owner := has_tenant_role(auth.uid(), 'owner');
  
  SELECT tenant_id INTO v_target_tenant_id 
  FROM public.profiles WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Super admin puede hacer todo
  IF v_actor_is_super_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Nadie excepto super_admin puede otorgar super_admin
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.global_role = 'super_admin' THEN
      INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
      VALUES (v_target_tenant_id, auth.uid(), 'blocked_privilege_escalation', 
        jsonb_build_object('attempted_role', 'super_admin', 'target_user', NEW.user_id));
      RAISE EXCEPTION 'Cannot grant super_admin role';
    END IF;
    
    -- Owners solo pueden gestionar roles en su propio tenant
    IF v_actor_is_owner THEN
      IF v_target_tenant_id != get_user_tenant_id(auth.uid()) THEN
        INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
        VALUES (v_target_tenant_id, auth.uid(), 'blocked_cross_tenant_role_change',
          jsonb_build_object('target_tenant', v_target_tenant_id));
        RAISE EXCEPTION 'Cannot modify roles in another tenant';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER prevent_role_escalation_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();
```

#### 5.3 Prevención de Cambio de Tenant
```sql
CREATE FUNCTION public.prevent_tenant_id_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
    VALUES (OLD.tenant_id, auth.uid(), 'blocked_tenant_id_change',
      jsonb_build_object('table', TG_TABLE_NAME, 'old_tenant_id', OLD.tenant_id));
    
    IF NOT is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Changing tenant_id is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

---

### 6. POLÍTICAS RLS (Row Level Security)

#### 6.1 Políticas para `profiles`
```sql
-- Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- Owners pueden ver perfiles de su tenant
CREATE POLICY "Owners can view profiles in their tenant" ON public.profiles
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_tenant_role(auth.uid(), 'owner')
);

-- Owners pueden insertar perfiles en su tenant
CREATE POLICY "Owners can insert profiles in their tenant" ON public.profiles
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_tenant_role(auth.uid(), 'owner')
);

-- Super admins tienen acceso total
CREATE POLICY "Super admins can manage all profiles" ON public.profiles
FOR ALL USING (is_super_admin(auth.uid()));
```

#### 6.2 Políticas para `user_roles`
```sql
-- Usuarios pueden ver su propio rol
CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

-- Owners pueden ver roles de su tenant
CREATE POLICY "Owners can view roles in their tenant" ON public.user_roles
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_roles.user_id 
          AND p.tenant_id = get_user_tenant_id(auth.uid()))
  AND has_tenant_role(auth.uid(), 'owner')
);

-- Owners pueden actualizar roles en su tenant
CREATE POLICY "Owners can update roles in their tenant" ON public.user_roles
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_roles.user_id 
          AND p.tenant_id = get_user_tenant_id(auth.uid()))
  AND has_tenant_role(auth.uid(), 'owner')
);

-- Super admins tienen acceso total
CREATE POLICY "Super admins can manage all roles" ON public.user_roles
FOR ALL USING (is_super_admin(auth.uid()));
```

#### 6.3 Políticas para `tenants`
```sql
-- Usuarios pueden ver su propio tenant
CREATE POLICY "Users can view their own tenant" ON public.tenants
FOR SELECT USING (id = get_user_tenant_id(auth.uid()));

-- Solo super admins pueden crear/modificar/eliminar tenants
CREATE POLICY "Super admins can insert tenants" ON public.tenants
FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update tenants" ON public.tenants
FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete tenants" ON public.tenants
FOR DELETE USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all tenants" ON public.tenants
FOR SELECT USING (is_super_admin(auth.uid()));
```

---

### 7. EDGE FUNCTIONS

#### 7.1 `admin-invite-owner`
Invita a un nuevo owner a un tenant (solo super_admin).

**Flujo:**
1. Verifica que el caller sea super_admin
2. Crea usuario en auth.users vía Admin API (sin contraseña)
3. Crea profile con status='inactive', first_login_required=true
4. Crea user_role con global_role='user', tenant_role='owner'
5. Genera link de recovery para establecer contraseña
6. Envía email de invitación via Resend
7. Registra security_event

```typescript
// Endpoint: POST /admin-invite-owner
{
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
}
```

#### 7.2 `admin-impersonate`
Permite a super_admin "impersonar" un tenant para soporte.

**Flujo:**
1. Verifica que el caller sea super_admin
2. Registra inicio/fin de impersonación en security_events
3. El frontend usa SupportModeContext para cambiar el tenant efectivo

```typescript
// Endpoint: POST /admin-impersonate
{
  action: 'start' | 'stop';
  tenant_id: string;
}
```

#### 7.3 `admin-complete-onboarding`
Completa el onboarding de un tenant (solo super_admin).

#### 7.4 `seed-super-admin`
Crea o actualiza el super admin inicial del sistema.

---

### 8. FLUJOS DE USUARIO

#### 8.1 Flujo: Creación de Tenant + Owner (por Super Admin)
```
1. Super Admin crea tenant en /admin
2. Super Admin invita owner via admin-invite-owner
3. Sistema crea auth.user sin contraseña
4. Trigger handle_new_user crea profile + user_role
5. Sistema envía email con link de activación
6. Owner hace clic en link → /auth/complete-signup
7. Owner establece contraseña
8. Sistema actualiza profile.status='active', first_login_required=false
9. Owner accede al dashboard
```

#### 8.2 Flujo: Creación de Usuario del Tenant (por Owner)
```
1. Owner accede a /settings/users
2. Owner crea usuario con supabase.auth.signUp()
   - Incluye metadata: tenant_id, global_role='user', tenant_role
3. Trigger handle_new_user crea profile + user_role
4. Usuario recibe email de verificación (si está habilitado)
5. Usuario establece contraseña e ingresa
```

#### 8.3 Flujo: Cambio de Rol (por Owner)
```
1. Owner accede a /settings/users
2. Owner selecciona "Cambiar rol" en el menú del usuario
3. Sistema verifica:
   - Owner no puede quitarse el rol owner si es el único
   - No se puede asignar super_admin
4. Update a user_roles.tenant_role
5. Trigger prevent_role_escalation valida la operación
```

#### 8.4 Flujo: Support Mode (Impersonación)
```
1. Super Admin accede a /admin
2. Hace clic en "Ver como tenant" en la lista
3. Frontend llama a admin-impersonate con action='start'
4. SupportModeContext almacena tenant_id impersonado
5. useEffectiveTenantId() retorna el tenant impersonado
6. Todos los hooks de datos usan ese tenant_id
7. Super Admin ve banner amarillo indicando modo soporte
8. Al salir, llama a admin-impersonate con action='stop'
```

---

### 9. CONTEXTO DE AUTENTICACIÓN (Frontend)

#### 9.1 AuthContext
```typescript
interface AuthState {
  user: User | null;           // Supabase user
  session: Session | null;     // Supabase session
  profile: Profile | null;     // public.profiles
  userRole: UserRole | null;   // public.user_roles
  tenant: Tenant | null;       // public.tenants
  isLoading: boolean;
  isSuperAdmin: boolean;       // Derivado de global_role
  tenantRole: TenantRole | null; // 'owner' | 'marketer' | 'readonly'
}

// Helpers
signIn(email, password)
signOut()
hasRole(roles: TenantRole[]): boolean  // Super admin siempre retorna true
```

#### 9.2 SupportModeContext
```typescript
interface SupportModeState {
  isSupportMode: boolean;
  supportTenantId: string | null;
  supportTenantName: string | null;
}

// Helpers
startSupportMode(tenantId, tenantName)
stopSupportMode()
getEffectiveTenantId(): string | null  // Retorna supportTenantId si está activo
```

#### 9.3 ProtectedRoute
```tsx
<ProtectedRoute 
  requireSuperAdmin={boolean}  // Requiere super_admin
  requireRoles={['owner', 'marketer']}  // Requiere alguno de estos roles
>
  {children}
</ProtectedRoute>
```

---

### 10. PROBLEMAS CONOCIDOS / ÁREAS DE MEJORA

1. **Límites de Usuarios**: La lógica `check_tenant_user_limit` está deshabilitada (usuarios ilimitados)
2. **Re-envío de Invitaciones**: Rate limiting básico (3/hora) pero sin UI de feedback
3. **Cambio de Contraseña**: No hay flujo diferenciado para cambio vs reset
4. **Auditoría de Acceso**: Solo se registran algunos eventos, no todos los accesos
5. **Gestión de Sesiones**: No hay forma de cerrar sesiones activas de otros dispositivos
6. **MFA/2FA**: No implementado
7. **Roles Granulares**: Solo 3 roles fijos, no hay permisos personalizables
8. **Desactivación de Usuarios**: Los usuarios desactivados pueden seguir con sesiones activas
9. **Transferencia de Ownership**: No hay flujo para transferir ownership a otro usuario

---

## 🎯 INSTRUCCIONES PARA ChatGPT

Basándote en esta documentación completa del módulo de usuarios, roles y permisos:

1. **Analiza la arquitectura actual** e identifica:
   - Vulnerabilidades de seguridad potenciales
   - Oportunidades de mejora en la estructura de datos
   - Patrones que podrían escalarse mejor

2. **Propón mejoras específicas** para:
   - Sistema de permisos más granular (ACL o RBAC extendido)
   - Auditoría completa de accesos
   - Flujos de onboarding más robustos
   - Gestión de sesiones
   - MFA/2FA

3. **Considera las restricciones**:
   - Supabase como backend (PostgreSQL + Auth)
   - Multi-tenancy con aislamiento por tenant_id
   - Necesidad de mantener retrocompatibilidad

4. **Genera propuestas detalladas** incluyendo:
   - Cambios de schema (migraciones SQL)
   - Nuevas funciones/triggers
   - Edge functions necesarias
   - Cambios en el frontend (React)
   - Flujos de usuario actualizados

---

## 📎 ARCHIVOS RELEVANTES

### Backend (Edge Functions)
- `supabase/functions/admin-invite-owner/index.ts`
- `supabase/functions/admin-impersonate/index.ts`
- `supabase/functions/admin-complete-onboarding/index.ts`
- `supabase/functions/seed-super-admin/index.ts`
- `supabase/functions/auth-change-password/index.ts`
- `supabase/functions/auth-password-reset/index.ts`

### Frontend
- `src/contexts/AuthContext.tsx`
- `src/contexts/SupportModeContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/settings/SettingsUsersPage.tsx`
- `src/pages/auth/CompleteSignup.tsx`
- `src/pages/auth/ForgotPassword.tsx`
- `src/pages/auth/ResetPassword.tsx`
- `src/pages/Admin.tsx`
- `src/hooks/useEffectiveTenantId.ts`
