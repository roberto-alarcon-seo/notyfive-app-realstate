# Módulo de Usuarios, Roles y Permisos - Brokia24

## Resumen de la Reestructuración

### Nuevos Roles de Tenant

| Rol Anterior | Rol Nuevo | Descripción |
|--------------|-----------|-------------|
| `owner` | `administrador` | Acceso completo a toda la plataforma |
| `marketer` | `manager` | Acceso operativo total (sin configuración) |
| `readonly` | `asesor` | Solo propiedades asignadas |

---

## 1️⃣ Definición de Roles

### ADMINISTRADOR
- ✅ Acceso TOTAL a la plataforma
- ✅ Acceso a Configuración
- ✅ Crear / editar / desactivar usuarios
- ✅ Cambiar roles
- ✅ Configurar WhatsApp, IA, API, facturación
- ✅ Ver y responder cualquier conversación
- ✅ Ver todas las propiedades
- ✅ Asignar propiedades a asesores

### MANAGER
- ✅ Acceso a TODO lo operativo
- ❌ NO tiene acceso a Configuración
- ❌ NO puede gestionar usuarios
- ✅ Ver TODAS las propiedades
- ✅ Ver TODOS los seguimientos
- ✅ Ver TODAS las conversaciones
- ✅ Responder mensajes incluso en propiedades de asesores
- ✅ Asignar propiedades a asesores

### ASESOR
- ⚠️ Acceso LIMITADO y ESTRICTO
- ✅ Ver mensajes (Inbox)
- ✅ Ver seguimientos
- SOLO de propiedades asignadas
- ❌ NO puede ver otras propiedades
- ❌ NO puede ver conversaciones de otros asesores
- ❌ NO puede acceder a Configuración
- ❌ NO puede crear usuarios

---

## 2️⃣ Base de Datos

### Tabla: `user_roles`
```sql
-- Nuevos valores en el enum tenant_role:
-- 'administrador' | 'manager' | 'asesor'
```

### Nueva Tabla: `property_assignments`
```sql
CREATE TABLE public.property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, user_id)
);
```

### Campos de Auditoría en Mensajes
```sql
ALTER TABLE public.messages ADD COLUMN sent_by_user_id UUID;
ALTER TABLE public.messages ADD COLUMN on_behalf_of_user_id UUID;
```

---

## 3️⃣ Funciones de Seguridad

```sql
-- Verificar si es administrador
public.is_tenant_admin(_user_id UUID) → BOOLEAN

-- Verificar si es manager o administrador
public.is_tenant_manager_or_admin(_user_id UUID) → BOOLEAN

-- Verificar si tiene una propiedad asignada
public.has_property_assignment(_user_id UUID, _property_id UUID) → BOOLEAN

-- Verificar acceso a conversación
public.can_access_conversation(_user_id UUID, _conversation_id UUID) → BOOLEAN
```

---

## 4️⃣ Edge Functions

### `assign-property-to-user`
Asigna una propiedad a un asesor.

**Request:**
```json
{
  "property_id": "uuid",
  "user_id": "uuid" // null para desasignar
}
```

**Validaciones:**
- Solo `administrador` o `manager` puede asignar
- Usuario destino debe ser `asesor`
- Registra evento en `security_events`

---

## 5️⃣ Frontend

### AuthContext
```typescript
export type TenantRole = 'administrador' | 'manager' | 'asesor';
```

### ProtectedRoute
- Verifica roles usando `requireRoles`
- Super admin pasa todos los checks

### IconSidebar
- Configuración visible solo para `administrador`
- Manager y Asesor no ven el ícono

### PropertyInfoTab
- Campo "Asesor asignado" solo muestra usuarios con rol `asesor`

---

## 6️⃣ Auditoría (security_events)

Eventos registrados:
- `role_change` - Cambio de rol de usuario
- `property_assignment` - Asignación/desasignación de propiedad
- `message_on_behalf` - Respuesta en nombre de otro usuario
- `access_denied` - Intentos de acceso bloqueados
- `user_created` - Creación de usuario
- `user_disabled` - Desactivación de usuario

---

## 7️⃣ Reglas de Oro

1. ✅ Ningún usuario ve data fuera de su scope
2. ✅ El rol Asesor JAMÁS puede escalar permisos
3. ✅ Manager NO puede crear usuarios ni acceder a configuración
4. ✅ Todo acceso indebido se bloquea en RLS (no solo UI)
5. ✅ Todo lo crítico queda auditado en security_events

---

## 8️⃣ Migración de Datos

Los roles se migraron automáticamente:
- `owner` → `administrador`
- `marketer` → `manager`
- `readonly` → `asesor`

Las asignaciones existentes en `properties.assigned_user_id` se copiaron a `property_assignments`.