# Plan: Página de detalle de Partner (Super Admin global)

## Objetivo
Crear `/admin/partners/:partnerId` accesible solo a Super Admin global, con visión 360° del partner: identidad, dominios, métricas, wallet, integración y acciones críticas (suspender, eliminar con cascada).

## Cambios de UI

### 1. Nueva página `src/pages/admin/PartnerDetail.tsx`
Layout en `AdminLayout` con tabs:

- **Resumen**
  - Header con logo, nombre, badge `Activo/Suspendido`, `partner_id`, dominio principal.
  - 4 KPI cards: Tenants totales, Usuarios totales, Saldo Super Wallet, Créditos consumidos último 30d.
  - Mini timeline de últimos 10 movimientos del ledger.
- **Identidad y Dominios**
  - Editar `name`, `country_code`, `primary_domain`, `dashboard_url`, `non_sso_redirect_url`, `logout_redirect_url`.
  - Gestión de `alt_domains` (array): añadir/eliminar con validación regex de hostname y prevención de duplicados entre partners.
  - Toggle **`is_active`** con `AlertDialog` de confirmación. Al desactivar: bloquear logins de tenants del partner (badge visible y banner explicativo).
- **Integración**
  - Mostrar `api_key` enmascarada con botón copiar y botón **Regenerar** (genera nueva, invalida la anterior, exige confirmación escribiendo `REGENERAR`).
  - Toggle `external_sync_enabled`.
  - Link rápido a `/admin/partner-settings` para branding/email.
- **Tenants** (lista)
  - Tabla de tenants del partner con columnas: nombre, plan, estado, créditos, usuarios, creado.
  - Click → navega a `/admin/tenants/:id`.
  - Acción "Ver todos" filtra `AdminTenants` por partner.
- **Wallet & Consumo**
  - Saldo actual, low-balance threshold (editable), botones a `/admin/super-wallet?partner=...`.
  - Mini gráfica (Recharts) consumo últimos 30 días por tenant (top 5).
- **Zona Peligrosa**
  - **Suspender partner** (toggle alterno a `is_active`).
  - **Eliminar partner** con cascada: requiere escribir el `partner_id` exacto. Bloqueado si tiene tenants activos (forzar mover/eliminar tenants antes).

### 2. Cambios en `AdminTenants.tsx`
- En la lista de partners (cuando es Super Admin global) y en `CreatePartnerDialog` post-éxito, redirigir/enlazar a `/admin/partners/:id`.
- Añadir botón "Gestionar partner" en el dropdown de cada fila partner-scoped.

### 3. Ruta en `src/App.tsx`
```
<Route path="/admin/partners/:partnerId" element={
  <ProtectedRoute requireSuperAdmin><PartnerDetail /></ProtectedRoute>
} />
```
(El guard ya rebota partner-scoped admins fuera de rutas super-admin globales.)

## Cambios de backend

### Migración SQL
1. **RPC `partner_update_settings(_partner_id, _patch jsonb)`** SECURITY DEFINER:
   - Verifica `is_super_admin(auth.uid())` y `partner_scope IS NULL`.
   - Whitelista campos editables: `name, country_code, primary_domain, alt_domains, dashboard_url, non_sso_redirect_url, logout_redirect_url, is_active, external_sync_enabled, low_balance_threshold` (este último vía `partner_super_wallets`).
   - Valida unicidad de `primary_domain` y `alt_domains` global (no choque con otro partner).
   - Inserta evento en `security_events` (`partner_settings_change`).
2. **RPC `partner_regenerate_api_key(_partner_id)`** SECURITY DEFINER:
   - Genera token server-side (`encode(gen_random_bytes(32),'base64')`), prefijo `pk_live_`.
   - Actualiza `partners.api_key`, registra en `security_events`.
   - Devuelve la key en plano **una sola vez**.
3. **RPC `partner_delete_cascade(_partner_id, _confirm_id text)`** SECURITY DEFINER:
   - Solo super admin global. `_confirm_id` debe coincidir con `_partner_id`.
   - Aborta si existen tenants con el partner (`SELECT count(*) FROM tenants WHERE partner_id=_partner_id > 0`).
   - Borra `partner_wallet_ledger`, `partner_super_wallets`, `partners` en transacción.
   - Audita en `security_events`.
4. **Vista materializada o RPC `partner_metrics(_partner_id)`** que devuelva: tenants_total, users_total, credits_consumed_30d, top_tenants_consumption_30d.

### Edge function (opcional, sólo si vemos que `tenants` deja huérfanos)
No necesaria en este sprint porque el RPC bloquea borrado si hay tenants. Se documenta para sprint posterior con `delete-tenant-cascade`.

## Hooks nuevos
`src/hooks/usePartner.ts` con:
- `usePartner(partnerId)` – fetch de fila + wallet.
- `usePartnerMetrics(partnerId)` – RPC de métricas.
- `useUpdatePartner()`, `useRegeneratePartnerKey()`, `useDeletePartner()` – mutaciones con `react-query` invalidando `['partners']`, `['partner-wallets-all']`.

## Seguridad
- Todas las mutaciones pasan por RPC (no UPDATE directo desde cliente; aprovecha que `is_super_admin` ya está validado server-side).
- API key sólo se muestra en el momento de regeneración (modal de "una sola vez", igual que en `CreatePartnerDialog`).
- Confirmaciones tipo "escribe X" para acciones destructivas.

## Detalles técnicos

```text
/admin/partners/:partnerId
 ├─ Header [logo · name · is_active toggle]
 ├─ Tabs
 │   ├─ Resumen (KPIs + mini ledger)
 │   ├─ Identidad & Dominios (form + alt_domains chips)
 │   ├─ Integración (api_key + regen)
 │   ├─ Tenants (tabla)
 │   ├─ Wallet (saldo + threshold + chart)
 │   └─ Zona Peligrosa (suspender · eliminar)
```

## Fuera de alcance (siguientes sprints)
- Verificación TXT de `alt_domains`.
- `delete-tenant-cascade` edge function.
- Dashboard partner con MRR/facturación.
- Feature flags a nivel partner.

## Archivos
- **Nuevo**: `src/pages/admin/PartnerDetail.tsx`, `src/hooks/usePartner.ts`
- **Editar**: `src/App.tsx` (ruta), `src/pages/admin/AdminTenants.tsx` (link "Gestionar"), `src/components/admin/CreatePartnerDialog.tsx` (redirigir tras crear)
- **Migración**: 3 RPCs nuevas + 1 RPC de métricas
