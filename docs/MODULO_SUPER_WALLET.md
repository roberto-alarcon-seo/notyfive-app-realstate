# Módulo: Super Wallet & Asignación de Créditos (Mensajes)

> Documentación técnica detallada del módulo de **Super Wallet por Partner** y la **Asignación de Créditos a Tenants**, incluyendo estructura de base de datos, RPCs, rutas, flujos, validaciones y acciones pendientes.
>
> **Contexto:** Plataforma multi-tenant Brokia24 (CRM inmobiliario LATAM) con modelo White Label por *partner*. Cada partner posee una **Super Wallet** (bolsa global de créditos) desde la cual asigna créditos de mensajería WhatsApp a sus *tenants*. Los créditos del tenant son consumidos por el envío de mensajes (manual, plantillas, campañas, IA).

---

## 1. Glosario

| Término | Significado |
|---|---|
| **Crédito (credit / message)** | Unidad atómica equivalente a 1 mensaje WhatsApp consumible. |
| **Partner** | Organización White Label propietaria de N tenants. Identificado por `partners.id` (text). |
| **Super Wallet** | Saldo global de créditos del partner. Tabla `partner_super_wallets`. |
| **Tenant Wallet** | Saldo efectivo del tenant para enviar mensajes (`tenants.message_credits`). |
| **Asignación / REDEEM** | Operación que descuenta de la Super Wallet del partner y suma al tenant. |
| **TOPUP** | Recarga de créditos a la Super Wallet (solo super admin global). |
| **ADJUSTMENT** | Ajuste manual (positivo o negativo) sobre Super Wallet. |
| **partner_scope** | Campo en `user_roles.partner_scope`. `NULL` = super admin global; un valor = super admin acotado a ese partner. |

---

## 2. Roles y Permisos

| Rol | Capacidad sobre Super Wallet |
|---|---|
| **Super Admin Global** (`global_role='super_admin'` AND `partner_scope IS NULL`) | TOPUP, REDEEM y ADJUSTMENT sobre cualquier partner. Ve todas las wallets y ledgers. |
| **Super Admin de Partner** (`global_role='super_admin'` AND `partner_scope=<partner_id>`) | Solo REDEEM hacia tenants del partner que le corresponde. Ve solo su wallet y ledger. |
| **Tenant Admin / Manager / Asesor** | Sin acceso. Solo ven el saldo del tenant (`message_credits`) en su propio CRM. |

La función auxiliar `get_user_partner_scope(uuid)` retorna el scope del usuario y se usa en RLS.

---

## 3. Estructura de Base de Datos

### 3.1 Tabla `partner_super_wallets`

Saldo único por partner (1:1 con `partners`).

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `partner_id` | text | NO | — | FK → `partners.id` ON DELETE CASCADE. **UNIQUE** |
| `balance_credits` | integer | NO | `0` | Saldo actual. CHECK ≥ 0 |
| `low_balance_threshold` | integer | NO | `1000` | Umbral para alertar saldo crítico |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | Trigger `set_updated_at_partner_wallet` |

**Constraints**
- `partner_super_wallets_balance_nonneg`: `balance_credits >= 0`
- UNIQUE en `partner_id`

**Índices**
- `idx_partner_super_wallets_partner (partner_id)`

**RLS Policies**
- `Global super admins manage all super wallets`: `is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL` (ALL)
- `Partner admins view own super wallet`: `is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) = partner_id` (SELECT)

---

### 3.2 Tabla `partner_wallet_ledger`

Registro inmutable de auditoría de todos los movimientos de Super Wallet.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `partner_id` | text | NO | — | FK → `partners.id` |
| `movement_type` | text | NO | — | CHECK IN (`'TOPUP'`, `'REDEEM'`, `'ADJUSTMENT'`) |
| `amount` | integer | NO | — | Monto del movimiento. Puede ser negativo en ADJUSTMENT |
| `balance_before` | integer | NO | — | Saldo antes del movimiento |
| `balance_after` | integer | NO | — | Saldo después del movimiento |
| `tenant_id` | uuid | SÍ | — | FK → `tenants.id` ON DELETE SET NULL. Solo poblada en REDEEM |
| `actor_user_id` | uuid | SÍ | — | `auth.uid()` que originó la operación. NULL si fue invocado por service role |
| `description` | text | SÍ | — | Texto libre / motivo |
| `metadata` | jsonb | NO | `{}` | Datos adicionales (`source`, `external_id`, etc.) |
| `created_at` | timestamptz | NO | `now()` | |

**Índices**
- `idx_partner_ledger_partner_created (partner_id, created_at DESC)`
- `idx_partner_ledger_tenant (tenant_id)`
- `idx_partner_ledger_type (movement_type)`

**RLS Policies**
- `Global super admins view all partner ledger` (SELECT)
- `Partner admins view own ledger` (SELECT, restringido por `partner_scope`)
- **No** existen policies de INSERT/UPDATE/DELETE → solo se inserta vía RPC `SECURITY DEFINER`.

---

### 3.3 Tabla `tenants` (campos relevantes)

| Columna | Tipo | Default | Rol en este módulo |
|---|---|---|---|
| `id` | uuid | — | PK |
| `partner_id` | text | — | FK → `partners.id`. Determina a qué Super Wallet pertenece |
| `message_credits` | integer | `0` | **Saldo efectivo total** del tenant (suma usable para enviar) |
| `monthly_credits_remaining` | integer | `0` | Bolsa mensual de la suscripción |
| `accumulated_credits` | integer | `0` | Bolsa acumulada (rollover, ajustes manuales legacy) |
| `extra_credits` | integer | `0` | **Bolsa de créditos asignados desde Super Wallet** |
| `billing_state` | text | — | `ACTIVE_WITH_CREDITS`, `SUBSCRIBED_ACTIVE`, `SUSPENDED`, etc. |

> **Nota:** `message_credits` debe mantenerse sincronizado con la suma efectiva de bolsas. Las RPCs `partner_wallet_redeem_to_tenant*` actualizan tanto `extra_credits` como `message_credits` en una sola operación.

---

### 3.4 Tabla `wallet_ledger` (tenant)

Espejo a nivel tenant del movimiento entrante.

Cuando `partner_wallet_redeem_to_tenant*` ejecuta, **inserta también** en `wallet_ledger` con:
- `movement_type = 'credit'`
- `reason = 'partner_super_wallet_redeem'`
- `metadata = { partner_id, actor_user_id }` (o `external_id` cuando viene del Core)

> El bloque está envuelto en `EXCEPTION WHEN undefined_table OR undefined_column THEN NULL`, garantizando que la operación principal no falle si esa tabla no existe en una réplica.

---

### 3.5 Tablas legacy relacionadas

| Tabla | Estado | Uso |
|---|---|---|
| `wallets` | **DEPRECATED** (mantenida por compatibilidad) | Espejo legacy: `balance_messages` se actualiza al hacer topup manual |
| `wallet_transactions` | **DEPRECATED** | Reemplazada por `wallet_ledger` y `partner_wallet_ledger` |

---

## 4. RPCs (PostgreSQL Functions)

Todas son `SECURITY DEFINER` con `search_path = public` y se invocan desde el cliente vía `supabase.rpc(...)`.

### 4.1 `partner_wallet_topup(_partner_id text, _amount integer, _description text DEFAULT NULL)`

**Propósito:** Recargar créditos a la Super Wallet de un partner.

**Acceso:** Solo Super Admin Global (`is_super_admin(uid) AND get_user_partner_scope(uid) IS NULL`).

**Lógica:**
1. Valida rol (`RAISE EXCEPTION 'Solo Super Admin global puede abonar a una Super Wallet'`).
2. Valida `_amount > 0` (`'Monto inválido'`).
3. `INSERT … ON CONFLICT DO NOTHING` para garantizar wallet existe.
4. `SELECT … FOR UPDATE` (lock pesimista).
5. UPDATE `balance_credits = balance_credits + _amount`.
6. INSERT en `partner_wallet_ledger` con `movement_type='TOPUP'`.
7. Retorna registro `partner_super_wallets`.

**Permisos:** `GRANT EXECUTE … TO authenticated`.

---

### 4.2 `partner_wallet_redeem_to_tenant(_partner_id text, _tenant_id uuid, _amount integer, _description text DEFAULT NULL)`

**Propósito:** Asignar créditos de la Super Wallet del partner al saldo de un tenant.

**Acceso:** Super Admin Global, o Super Admin de Partner cuyo `partner_scope = _partner_id`.

**Lógica:**
1. `is_super_admin(uid)` (acceso denegado en caso contrario).
2. Si `partner_scope IS NOT NULL` y `<> _partner_id` → `'No autorizado para esta Super Wallet'`.
3. Valida `_amount > 0`.
4. Verifica `tenants.partner_id = _partner_id` (`'El tenant no pertenece a este partner'`).
5. Lock + verifica `balance_credits >= _amount` (`'Saldo insuficiente en la Super Wallet'`).
6. UPDATE Super Wallet (resta).
7. UPDATE `tenants`: `extra_credits += _amount`, `message_credits += _amount`.
8. INSERT en `partner_wallet_ledger` con `movement_type='REDEEM'` y `tenant_id`.
9. INSERT espejo en `wallet_ledger` (best-effort).
10. Retorna wallet actualizado.

---

### 4.3 `partner_wallet_redeem_to_tenant_service(_partner_id text, _tenant_id uuid, _amount integer, _description text DEFAULT NULL, _metadata jsonb DEFAULT '{}')`

**Propósito:** Variante invocada por **service role** (sin JWT). Usada por el Core externo (sync) o webhooks.

**Acceso:** No valida `auth.uid()` — debe ser llamada únicamente desde edge functions con `SUPABASE_SERVICE_ROLE_KEY`.

**Diferencias vs versión authenticated:**
- Sin checks de rol.
- `actor_user_id = NULL` en el ledger.
- Acepta `_metadata` jsonb que se persiste en el ledger (e.g. `{ external_id: '...', source: 'core_sync' }`).
- Errores con SQLSTATE específicos:
  - `22023` → monto inválido
  - `P0002` → tenant o wallet no encontrado
  - `42501` → tenant no pertenece al partner
  - `P0003` → **saldo insuficiente** (mapear a HTTP 402 en el edge function)

---

### 4.4 `partner_wallet_adjust(_partner_id text, _amount integer, _description text)`

**Propósito:** Ajuste manual de saldo (positivo o negativo).

**Acceso:** Solo Super Admin Global.

**Lógica:**
1. Verifica `auth.uid() IS NOT NULL` (`'NOT_AUTHENTICATED'`, `42501`).
2. Verifica que sea super admin global vía query directa a `user_roles` (`'FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY'`, `42501`).
3. `_amount != 0` (`'INVALID_AMOUNT'`, `22023`).
4. `_description` no vacío (`'DESCRIPTION_REQUIRED'`, `22023`).
5. Upsert wallet con FOR UPDATE.
6. `balance_after = balance_before + _amount`. Si `< 0` → `'NEGATIVE_BALANCE_NOT_ALLOWED'` (`22023`).
7. UPDATE wallet, INSERT ledger con `movement_type='ADJUSTMENT'`, `metadata={'source':'manual_adjustment'}`.

**Permisos:** REVOKE ALL FROM public; GRANT EXECUTE TO authenticated.

> **Histórico:** Existió una versión previa con `_partner_id uuid` que fue dropeada y recreada con `text` (migración `20260427181913`).

---

## 5. Rutas (Endpoints)

### 5.1 Rutas del Frontend (React Router, `src/App.tsx`)

| Path | Componente | Guard | Descripción |
|---|---|---|---|
| `/admin/super-wallet` | `PartnerSuperWallet` | `<ProtectedRoute requireSuperAdmin>` | Vista principal de Super Wallet: saldo, abonar, ajustar, ledger filtrable |
| `/admin/tenants/:id` (tab "Super Wallet") | `TenantSuperWalletTab` dentro de `TenantDetailPanel` | requireSuperAdmin | Vista por tenant para asignar créditos desde la Super Wallet del partner |

### 5.2 RPC Endpoints (PostgREST)

Invocados con `supabase.rpc('<name>', { ... })`:

| RPC | Método | Body |
|---|---|---|
| `partner_wallet_topup` | POST | `{ _partner_id, _amount, _description? }` |
| `partner_wallet_redeem_to_tenant` | POST | `{ _partner_id, _tenant_id, _amount, _description? }` |
| `partner_wallet_adjust` | POST | `{ _partner_id, _amount, _description }` |
| `partner_wallet_redeem_to_tenant_service` | POST | Solo service role; `{ _partner_id, _tenant_id, _amount, _description?, _metadata? }` |

### 5.3 Edge Functions involucradas

| Función | Rol en este módulo |
|---|---|
| `sync-external-core` | Recibe webhook del Core externo y llama `partner_wallet_redeem_to_tenant_service` para asignar créditos comprados externamente. |
| `send-manual-message` | **Consume** créditos del tenant. Verifica `tenants.message_credits > 0` o `billing_state='SUBSCRIBED_ACTIVE'`. |
| `send-template-message`, `execute-campaign`, `automation-worker`, `ai-chat-response` | Otros consumidores de créditos del tenant. |

### 5.4 Hooks de cliente (`src/hooks/usePartnerWallet.ts`)

| Hook | Tipo | Llama a |
|---|---|---|
| `usePartnerWallet(partnerId)` | Query | SELECT directo a `partner_super_wallets` |
| `useAllPartnerWallets()` | Query | SELECT lista global |
| `usePartnerLedger(filters)` | Query | SELECT a `partner_wallet_ledger` con join a `tenants(name)` |
| `useTopupPartnerWallet()` | Mutation | RPC `partner_wallet_topup` |
| `useRedeemPartnerWalletToTenant()` | Mutation | RPC `partner_wallet_redeem_to_tenant` |
| `useAdjustPartnerWallet()` | Mutation | RPC `partner_wallet_adjust` |

Invalidaciones tras mutación: `partner-wallet`, `partner-wallets-all`, `partner-ledger`, `admin-tenant-credits`, `tenant-wallet`, `wallet-ledger`.

---

## 6. Flujos Funcionales

### 6.1 Flujo: Recarga de la Super Wallet (TOPUP)

**Actor:** Super Admin Global.
**UI:** `PartnerSuperWallet.tsx` → botón **"Abonar saldo"**.

1. Usuario selecciona partner (Select de partners activos).
2. Click en **"Abonar saldo"** abre Dialog.
3. Selecciona monto preset (`20000`, `30000`, `50000`) o ingresa nota libre.
4. Click "Abonar X créditos" → `useTopupPartnerWallet().mutateAsync({ partnerId, amount, description })`.
5. RPC `partner_wallet_topup`:
   - Verifica rol global super admin.
   - Lockea wallet, suma créditos, escribe ledger TOPUP.
6. React Query invalida y refresca saldo + ledger.
7. Toast "Abonados N créditos".

### 6.2 Flujo: Asignación a Tenant (REDEEM) desde detalle del tenant

**Actor:** Super Admin (Global o de Partner).
**UI:** `TenantSuperWalletTab.tsx` dentro del `TenantDetailPanel`.

1. Carga `usePartnerWallet(partnerId)` y `usePartnerLedger({ partnerId })` filtrado a movimientos `tenant_id = currentTenant`.
2. Muestra saldo actual y badge "Saldo crítico" si `balance < threshold`.
3. Botón **"Asignar al tenant"** abre Dialog (Monto, Nota).
4. Validaciones cliente:
   - `amount > 0`
   - `amount <= balance`
5. Click "Asignar" → `useRedeemPartnerWalletToTenant().mutateAsync({ partnerId, tenantId, amount, description })`.
6. RPC `partner_wallet_redeem_to_tenant`:
   - Verifica scope del usuario.
   - Verifica `tenant.partner_id == partner_id`.
   - Lockea wallet, valida saldo suficiente.
   - Resta de Super Wallet, suma a `tenants.extra_credits` y `tenants.message_credits`.
   - Inserta ledger REDEEM (con `tenant_id`).
   - Inserta espejo en `wallet_ledger`.
7. Invalida queries del tenant (`admin-tenant-credits`, `tenant-wallet`, `wallet-ledger`).
8. Toast "N créditos asignados al tenant".

### 6.3 Flujo: Asignación automática desde Core externo

**Actor:** Sistema externo (Core de billing).

1. Core ejecuta una compra de paquete de créditos para tenant X.
2. POST a edge function `sync-external-core` con payload `{ tenant_id, partner_id, amount, external_id, ... }`.
3. Edge function valida firma/HMAC y llama `partner_wallet_redeem_to_tenant_service` (service role) con `_metadata = { external_id, source: 'core_sync' }`.
4. Si `P0003` (saldo insuficiente) → retorna HTTP 402 al Core para reintentar tras topup.
5. Caso éxito: Core recibe 200; tenant ya puede operar.

### 6.4 Flujo: Ajuste Manual (ADJUSTMENT)

**Actor:** Super Admin Global.
**UI:** `PartnerSuperWallet.tsx` → "Ajuste de saldo".

1. Dialog solicita monto (puede ser negativo) y motivo (Select tipificado + nota libre).
2. Validaciones cliente:
   - Monto entero distinto de 0.
   - Motivo seleccionado obligatorio.
   - Si tipo "Otro", nota requerida.
3. RPC `partner_wallet_adjust` valida nuevamente y nunca permite saldo negativo final.
4. Ledger graba `ADJUSTMENT` con descripción concatenada `"<Tipo>: <Nota>"`.

### 6.5 Flujo: Consumo de Créditos por Tenant

Cada acción de envío descuenta del saldo del tenant:

1. **Origen:** `send-manual-message`, `send-template-message`, `execute-campaign`, `automation-worker`, `ai-chat-response`.
2. **Pre-check** (`useOperationStatus`): `canOperate = (totalCredits > 0 OR billing_state='SUBSCRIBED_ACTIVE') AND billing_state != 'SUSPENDED'`.
3. La edge function debita 1 crédito de `tenants.message_credits` y registra en `wallet_ledger` (movement `debit`).
4. Cuando `message_credits == 0` y no hay suscripción activa → bloqueo de envíos hasta nueva REDEEM o renovación de suscripción.

### 6.6 Visualización de Ledger

**UI:** Tabla en `PartnerSuperWallet.tsx` con filtros: Tenant (texto), Tipo (`ALL/TOPUP/REDEEM/ADJUSTMENT`), Rango de fechas. Límite 500 filas, orden DESC.

---

## 7. Validaciones (resumen consolidado)

### 7.1 Validaciones DB-level

| Regla | Implementación |
|---|---|
| Saldo Super Wallet ≥ 0 | CHECK constraint + lógica RPC |
| Tipo de movimiento válido | CHECK `IN ('TOPUP','REDEEM','ADJUSTMENT')` |
| Tenant pertenece al partner | RPC valida `tenants.partner_id = _partner_id` |
| Solo Super Admin Global puede TOPUP/ADJUSTMENT | RPC valida `partner_scope IS NULL` |
| Solo Super Admin del partner puede REDEEM | RPC valida `partner_scope IS NULL OR = _partner_id` |
| Monto > 0 (TOPUP, REDEEM) | RPC RAISE EXCEPTION `'Monto inválido'` |
| Monto ≠ 0 (ADJUSTMENT) | RPC `'INVALID_AMOUNT'` (22023) |
| ADJUSTMENT con descripción no vacía | RPC `'DESCRIPTION_REQUIRED'` (22023) |
| ADJUSTMENT no produce saldo negativo | RPC `'NEGATIVE_BALANCE_NOT_ALLOWED'` (22023) |
| Concurrencia segura | `SELECT … FOR UPDATE` antes de mutar |
| RLS estricta en SELECT | Policies por `partner_scope` |
| Insert/Update/Delete en ledger | **Bloqueado**: solo vía RPC SECURITY DEFINER |

### 7.2 Validaciones Cliente

| Vista | Regla |
|---|---|
| `PartnerSuperWallet` topup | Monto preset; descripción opcional |
| `PartnerSuperWallet` adjust | Monto numérico ≠ 0; tipo de motivo obligatorio; nota obligatoria si "Otro" |
| `TenantSuperWalletTab` redeem | `amount > 0`; `amount <= balance`; toast "Saldo insuficiente" si excede |
| Selector de partner | Solo visible para super admin global; partner admin queda fijado |

### 7.3 Mapeo de Errores

| SQLSTATE | Mensaje RPC | HTTP sugerido (edge) |
|---|---|---|
| `22023` | `INVALID_AMOUNT`, `DESCRIPTION_REQUIRED`, `NEGATIVE_BALANCE_NOT_ALLOWED`, `'Monto inválido'` | 400 |
| `42501` | `NOT_AUTHENTICATED`, `FORBIDDEN_GLOBAL_SUPER_ADMIN_ONLY`, `'No autorizado…'`, `'El tenant no pertenece…'` | 401/403 |
| `P0002` | `'Tenant no encontrado'`, `'Super Wallet no inicializada'` | 404 |
| `P0003` | `'Saldo insuficiente en la Super Wallet'` | **402** |

---

## 8. Eventos y Side-Effects

| Evento | Side-effect |
|---|---|
| TOPUP | Wallet+; ledger TOPUP |
| REDEEM (interactive) | Wallet−; tenant.extra_credits+; tenant.message_credits+; partner_wallet_ledger REDEEM; wallet_ledger credit |
| REDEEM (service) | Igual que interactive + actor NULL + metadata externa |
| ADJUSTMENT | Wallet±; ledger ADJUSTMENT con `metadata.source='manual_adjustment'` |
| `tenants.message_credits` cambia | Header `CreditsBadge` (cliente) refresca vía invalidaciones |

---

## 9. Acciones Pendientes / Roadmap

### 9.1 Críticas (Hardening)

1. **Trigger `set_updated_at` en `tenants`** al modificar `message_credits` para auditar timestamp; actualmente solo `partner_wallet_redeem_to_tenant_service` setea `updated_at = now()`.
2. **Validación de saldo no-negativo en `tenants.message_credits`** (CHECK o trigger). Hoy el debit en edge function podría dejar valor negativo si hay condiciones de carrera.
3. **Idempotencia REDEEM externa**: en `partner_wallet_redeem_to_tenant_service`, persistir `metadata.external_id` con UNIQUE para impedir doble cobro si el Core reintenta.
4. **Renombrar / unificar buckets de créditos en `tenants`**: hoy coexisten `monthly_credits_remaining + accumulated_credits + extra_credits + message_credits`. Documentar fórmula canónica y mover el cálculo a una `GENERATED COLUMN` o función `get_total_credits(tenant_id)`.
5. **Eliminar tabla legacy `wallets` y `wallet_transactions`** (marcadas DEPRECATED en `useWallet.ts`). Existe escritura paralela que puede divergir del estado real.

### 9.2 Funcionales (UX/Capacidad)

6. **Topup montos personalizados**: actualmente solo `[20000, 30000, 50000]`; permitir input libre con validación.
7. **Asignación masiva (batch redeem)**: distribuir N créditos entre M tenants en una sola transacción (RPC `partner_wallet_redeem_batch`).
8. **Programar asignaciones recurrentes** (mensuales) por tenant.
9. **Notificaciones automáticas de saldo crítico** (`balance < low_balance_threshold`) → email/in-app al super admin del partner.
10. **Notificación al tenant** cuando recibe créditos (toast in-app o email).
11. **Exportar ledger a CSV** desde `PartnerSuperWallet`.
12. **Vista del tenant**: tab "Historial de créditos" en Settings que muestre solo movimientos REDEEM hacia él (lectura desde `wallet_ledger`).

### 9.3 Reportes / Analítica

13. Dashboard de consumo por tenant: créditos asignados vs consumidos, ROI por canal (manual / IA / campañas / automations).
14. Métricas de partner: burn rate mensual, días estimados de runway.
15. Endpoint REST/GraphQL público (`api-tokens`) para que el Core externo consulte saldo de cada tenant.

### 9.4 Técnicas / Arquitectura

16. **Webhook `partner_wallet_low_balance`** disparado por trigger AFTER UPDATE cuando `balance_credits` cruza `low_balance_threshold`.
17. **Trigger AFTER INSERT en `partner_wallet_ledger`** para publicar evento Realtime al canal `partner:{id}` (saldo en vivo en UI).
18. **Reemplazar concatenación manual `tipo: nota`** por columnas separadas `reason_type`, `reason_note` en `partner_wallet_ledger` para reportes estructurados.
19. **Test e2e** que cubra escenarios: REDEEM con scope incorrecto, TOPUP por partner admin (debe fallar), saldo insuficiente, ADJUSTMENT negativo dejando saldo en 0.
20. **Migración a `pgcrypto`** para metadata sensible si en futuro se almacenan referencias bancarias.
21. Cambiar policy ALL `Global super admins manage all super wallets` por policies separadas (SELECT/INSERT/UPDATE/DELETE) — la UI nunca debe permitir DELETE manual.

### 9.5 Documentación / DX

22. Documentar el ciclo completo de `billing_state` (`ACTIVE_WITH_CREDITS` ↔ `SUBSCRIBED_ACTIVE` ↔ `SUSPENDED`) y quién lo escribe (Core externo vs RPCs internas).
23. Diagrama de secuencia del flujo Core → `sync-external-core` → `partner_wallet_redeem_to_tenant_service`.
24. Especificación OpenAPI del endpoint `sync-external-core`.

---

## 10. Referencias de Código

| Archivo | Propósito |
|---|---|
| `supabase/migrations/20260427174513_*.sql` | Crea `partner_super_wallets`, `partner_wallet_ledger`, RPC `topup` y `redeem_to_tenant` |
| `supabase/migrations/20260427175744_*.sql` | RPC `redeem_to_tenant_service` (service role) |
| `supabase/migrations/20260427181120_*.sql` | RPC `partner_wallet_adjust(uuid,…)` (versión inicial) |
| `supabase/migrations/20260427181913_*.sql` | DROP + recreate `partner_wallet_adjust(text,…)` |
| `src/pages/admin/PartnerSuperWallet.tsx` | UI principal del módulo (saldo, topup, ajuste, ledger) |
| `src/components/admin/TenantSuperWalletTab.tsx` | Sub-vista para asignar créditos desde el detalle del tenant |
| `src/hooks/usePartnerWallet.ts` | Hooks de queries y mutaciones |
| `src/hooks/useTenantCredits.ts` | Lectura del saldo efectivo del tenant |
| `src/hooks/useOperationStatus.ts` | Gating de operaciones según saldo + billing_state |
| `src/hooks/useWallet.ts` | **DEPRECATED** — mantener congelado, planificar remoción |
| `supabase/functions/sync-external-core/` | Edge function que invoca la variante service-role |
| `supabase/functions/send-manual-message/` | Consumidor principal de créditos |

---

**Versión:** 1.0  
**Última actualización:** 2026-05-04
