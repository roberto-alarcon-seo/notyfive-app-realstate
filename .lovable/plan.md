# Plan: Módulo de Roles y Asignación Inteligente de Leads

## Estado actual (lo que ya existe)
- Roles `administrador / manager / asesor` ya definidos con RLS y helpers (`is_tenant_admin`, `is_tenant_manager_or_admin`, `has_property_assignment`, `can_access_conversation`).
- `contacts.assigned_agent_id` (FK a profiles) ya existe.
- `properties` con asignaciones vía tabla `property_assignments`.
- Handoff IA → humano ya marca `needs_human=true` y `ai_state='escalated'` en `conversations`, pero **no asigna asesor**.
- Permisos del manager y admin sobre Inbox ya están en RLS; el manager ya puede ver todas las conversaciones.

## Lo que falta (gap funcional)
1. No existe motor de asignación al hacer handoff (Sticky / Property / Round Robin).
2. No hay configuración por tenant para reglas de asignación.
3. No hay log de auditoría de asignaciones (`assignment_logs`).
4. No hay timeout de respuesta del asesor con marcado "en riesgo".
5. No hay UI de reasignación manual ni para el manager ni para el admin.
6. Falta flag `is_active` operativo a nivel asesor para excluirlos de la rotación.

---

## Fase 1 — Fundamentos de datos y configuración (sin lógica activa)

**Objetivo:** dejar el esquema y la UI de settings listos sin cambiar comportamiento.

1. Migración SQL:
   - Tabla `assignment_rules` (1:1 con tenant):
     - `tenant_id` (PK), `round_robin_enabled bool default true`,
     - `sticky_agent_enabled bool default true`,
     - `sticky_overrides_property bool default false` (configurable),
     - `lead_timeout_minutes int default 30`,
     - `timeout_action text default 'notify'` (`notify` | `reassign` | `notify_and_reassign`),
     - `max_active_leads_per_agent int null` (null = sin tope),
     - `last_assigned_agent_id uuid null` (puntero round robin).
   - Tabla `assignment_logs`:
     - `id`, `tenant_id`, `conversation_id`, `contact_id`, `previous_agent_id`, `new_agent_id`, `assigned_by` (uuid o null si sistema), `strategy text` (`sticky|property|round_robin|manual|timeout_reassign|fallback`), `reason text`, `created_at`.
   - Columnas en `conversations`: `last_assigned_at timestamptz`, `risk_flagged_at timestamptz`, agregar valor `'risk'` permitido en status (mantener enum/text actual).
   - Columna en `profiles`: `is_active_for_assignment bool default true` (independiente de status, controlable por admin/manager).
   - RLS:
     - `assignment_rules`: select para usuarios del tenant; update solo `administrador` + `super_admin`.
     - `assignment_logs`: select admin/manager; insert solo SECURITY DEFINER.

2. Hook `useAssignmentRules` + página `/settings/assignment-rules` (solo admin):
   - Toggles: Round Robin, Sticky, Sticky overrides property.
   - Inputs: Timeout (min), Acción al timeout, Máx leads activos por asesor.
   - Lista de asesores con switch `is_active_for_assignment`.
   - Visible en `SettingsLayout`. Bloqueado para manager/asesor (RLS + UI).

**Pruebas Fase 1:** crear/editar reglas como admin; manager no ve la entrada; valores persisten.

---

## Fase 2 — Motor de asignación (core)

**Objetivo:** función SQL determinística que decide a quién se asigna.

1. Función `public.fn_assign_conversation(p_conversation_id uuid, p_assigned_by uuid, p_force_strategy text default null)` `SECURITY DEFINER`:
   - Carga conversation + contact + property_interest + rules.
   - Orden:
     a. Si `sticky_agent_enabled` y existe `contacts.assigned_agent_id` activo → usar ese (a menos que `sticky_overrides_property=false` y el inmueble actual tenga otro asesor activo).
     b. Si el `re_property_interest_id` tiene asesor en `property_assignments` activo → usar ese.
     c. Si `round_robin_enabled` → seleccionar siguiente asesor activo de la lista del tenant ordenada por `profiles.id`, partiendo del que sigue a `last_assigned_agent_id`. Saltar a quien tenga > `max_active_leads_per_agent` (si está definido). Persistir `last_assigned_agent_id`.
     d. Fallback: cualquier admin/manager activo. Si no hay → dejar `assigned_agent_id=null` y log `reason='no_active_agents'`.
   - Actualizar `conversations.assigned_agent_id`, `last_assigned_at`, `contacts.assigned_agent_id`.
   - Insertar en `assignment_logs`.
   - Devolver `{ agent_id, strategy, reason }`.

2. Edge function `assign-conversation`: wrapper para reasignación manual desde UI (valida que caller sea admin o manager via RLS helpers).

**Pruebas Fase 2:** invocar la función en SQL con casos:
- Lead nuevo sin sticky → round robin rota.
- Lead recurrente con sticky on → mismo asesor.
- Inmueble con asesor distinto y sticky_overrides_property → usa inmueble.
- Sin asesores activos → fallback null + log.

---

## Fase 3 — Integración con el handoff de IA

**Objetivo:** cada vez que la IA escala, se asigne automáticamente.

1. En `supabase/functions/ai-chat-response/index.ts`, en cada bloque que setea `needs_human=true` (no_balance, human_request, frustration, visit_request, ai_api_error, [ESCALAR]):
   - Llamar `supabase.rpc('fn_assign_conversation', { p_conversation_id, p_assigned_by: null })` después del update.
   - Registrar `conversation_activity` con `event_type='lead_assigned'` (payload con strategy + agent).

2. Igual en `twilio-inbound-webhook` cuando se cree una conversación que arranque sin IA.

3. Mostrar en Inbox el badge "Asignado a: …" basado en `conversations.assigned_agent_id`.

**Pruebas Fase 3:** simular mensaje "quiero hablar con un humano" → verificar log + asignación + badge.

---

## Fase 4 — Reasignación manual y supervisión del manager

1. UI en `ContactProfilePanel` / Inbox header:
   - Selector "Asesor asignado" para admin y manager (asesor ve solo lectura).
   - Acción "Reasignar" → llama `assign-conversation` con `p_force_strategy='manual'`.
2. Vista nueva `/admin-leads` (manager + admin):
   - Tabla de conversaciones con `assigned_agent_id`, último mensaje, status, badge `risk`.
   - Filtros por asesor, status, riesgo.
   - Botón "Reasignar" inline.
3. Mostrar timeline de `assignment_logs` por conversación en `ContactActivityTimeline` (evento "Reasignado por X de A → B").

**Pruebas Fase 4:** manager reasigna; asesor antiguo pierde acceso (RLS), nuevo lo ve; log auditado.

---

## Fase 5 — Timeout y leads en riesgo

1. Cron edge function `assignment-timeout-monitor` (cada 5 min, scheduler):
   - Selecciona conversaciones con `assigned_agent_id not null`, `last_agent_message_at < now() - interval lead_timeout_minutes`, status no `closed`, `risk_flagged_at is null`.
   - Marca `status='risk'`, `risk_flagged_at=now()`.
   - Según `timeout_action`:
     - `notify`: insert en `notifications` para manager/admin.
     - `reassign`: llama `fn_assign_conversation` con `p_force_strategy='timeout_reassign'` (excluye al asesor actual).
     - `notify_and_reassign`: ambas.
2. Badge visual "En riesgo" en Inbox y `/admin-leads`.
3. Limpiar `risk` y `risk_flagged_at` cuando el asesor (o manager) responde.

**Pruebas Fase 5:** forzar `last_agent_message_at` antiguo → verificar marcado, notificación y reasignación según config.

---

## Fase 6 — Pulido, métricas y memoria

1. Mini dashboard en `/admin-leads`: leads por asesor, tasa de respuesta, leads en riesgo (Recharts hex).
2. Documentación: actualizar `docs/MODULO_USUARIOS_ROLES.md` con nuevo módulo.
3. Memoria del proyecto: agregar `mem://features/lead-assignment-engine` con la jerarquía Sticky → Property → RR y la ubicación de las reglas.
4. QA cross-rol y pruebas RLS finales.

---

## Decisiones confirmadas
- **Saturación:** `max_active_leads_per_agent` opcional, default sin tope.
- **Sticky vs Inmueble:** configurable por tenant (`sticky_overrides_property`).
- **Timeout:** acción configurable (notify / reassign / ambos).
- **Manager intervención:** sin typing presence; solo lectura realtime de mensajes ya enviados (lo actual).

---

## Detalles técnicos clave
- Toda la decisión de asignación vive en `fn_assign_conversation` (SECURITY DEFINER, search_path=public) para no duplicar lógica entre edge functions y UI.
- `assignment_logs` es append-only; sin policies de update/delete (solo super_admin).
- Round robin usa `last_assigned_agent_id` por tenant para evitar contar leads en cada asignación (O(n) donde n = asesores activos).
- Se reutiliza `is_active_for_assignment` en lugar de `profiles.status` para no acoplar bajas operativas con bajas de cuenta.
- Cron usa `pg_cron` o el patrón existente de `automation-scheduler` (revisar cuál está activo antes de fase 5).

¿Avanzamos con Fase 1?
