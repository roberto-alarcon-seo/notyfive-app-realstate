# Plan: Crear Partners desde Admin Global

## ¿Es buen momento?

Sí. La infraestructura ya está lista y no hay que romper contratos existentes:

- Tabla `partners` existe con todas las columnas necesarias (`id`, `name`, `primary_domain`, `primary_color_hex/hsl`, `logo_url`, `email_sender_*`, `branding`, `api_key`, `non_sso_redirect_url`, `logout_redirect_url`, etc.).
- RLS ya permite `INSERT` solo a global super admins (sin `partner_scope`) — exactamente el rol pedido.
- `partner_super_wallets` se relaciona vía FK con `ON DELETE CASCADE`; la RPC `partner_wallet_topup` ya sirve para asignar saldo inicial.
- `PartnerSettings.tsx` ya edita un partner existente (apariencia, redirects, API key visible). Reutilizamos sus pedazos.

No tocamos endpoints, RPC, ni el flujo actual del partner ya operativo (Brokia, MLS, Responde). Solo añadimos creación.

## Qué se construye

### 1. Botón "Nuevo Partner" en `/admin/tenants` (o donde aparezca la lista de partners)

Visible **solo** si `isSuperAdmin && !partnerScope`. Abre un Dialog wizard de 3 pasos.

### 2. Componente `src/components/admin/CreatePartnerDialog.tsx` — wizard de 3 pasos

**Paso 1 — Identidad**
- `id` (slug, lowercase, sin espacios, ej. `acme`) — validado único contra DB on blur.
- `name` (display).
- `primary_domain` (ej. `app.acme.com`) — único.
- `country_code` (select MX/CO/AR/CL/PE/US, default MX).

**Paso 2 — Apariencia y Email**
- `primary_color_hex` (color picker) → calcula `primary_color_hsl` con `hexToHslString` ya existente en `@/lib/partnerTheme`.
- `logo_url` (upload a bucket `partner-assets` ya usado por `PartnerSettings`).
- `email_sender_name` (default = `name`).
- `email_sender_address` (ej. `no-reply@notifications.acme.com`).
- `non_sso_redirect_url` y `logout_redirect_url` (opcionales).

**Paso 3 — API & Wallet inicial**
- Toggle "Generar API Key (x-api-key)" → genera token seguro client-side (`crypto.getRandomValues` → base64url, 32 bytes) con prefijo `pk_live_`. Se muestra UNA SOLA VEZ con botón "Copiar" y aviso de que no se podrá volver a ver completo.
- Toggle "external_sync_enabled" (default ON) — habilita ingestión de tenants vía API.
- Input numérico "Saldo inicial Super Wallet (créditos)" (default 0, opcional).
- Input "low_balance_threshold" (default 1000).

**Acción "Crear":**
1. `INSERT` en `partners` con todos los campos + `branding: buildDefaultTheme(hsl)`.
2. `INSERT` en `partner_super_wallets` (`partner_id`, `low_balance_threshold`, `balance_credits: 0`).
3. Si saldo inicial > 0 → `supabase.rpc('partner_wallet_topup', { p_partner_id, p_amount, p_reason: 'initial_provision' })` para que quede registrado en `partner_wallet_ledger`.
4. Toast de éxito + invalidate de la query de partners + cerrar dialog y mostrar pantalla final con el API key copiable (si se generó).

### 3. Validaciones cliente

- `id`: regex `^[a-z][a-z0-9_]{2,30}$`.
- `primary_domain`: regex de dominio válido.
- Email sender: regex email.
- Color hex: regex `^#[0-9a-fA-F]{6}$`.
- Saldo inicial ≥ 0.
- Antes de crear, query `select id from partners where id=? or primary_domain=?` para detectar duplicados con mensaje claro.

### 4. Manejo de errores

- Errores RLS (no debería darse pero por si acaso) → toast "Solo super admins globales pueden crear partners".
- Conflicto de unique → toast específico.
- Si paso 1 OK pero falla wallet → mostrar warning y dejar el partner creado (no rollback automático; ofrecer "Reintentar wallet" desde detalle del partner).

### 5. UX / Seguridad

- Confirmación final en paso 3: typing "CREAR" antes de habilitar el botón (consistente con la UX de fricción ya implementada en `TenantWalletTab` modal de asignación).
- API key solo visible al final, nunca se vuelve a mostrar completo (en `PartnerSettings` ya se muestra enmascarada).
- El botón "Nuevo Partner" se oculta para `partnerScope` (admin scoped) — solo super admins globales.

## Archivos a crear/modificar

```text
src/components/admin/CreatePartnerDialog.tsx   [NUEVO] - Wizard 3 pasos
src/pages/admin/AdminTenants.tsx               [EDIT]  - Botón "Nuevo Partner" en header (solo global admin) — o agregarlo en PartnerSettings header como "+ Crear Partner"
src/hooks/useCreatePartner.ts                  [NUEVO] - Mutation con react-query: insert partner + wallet + topup opcional
```

## Lo que NO se toca

- RPC existentes (`partner_wallet_topup`, `partner_wallet_redeem_to_tenant`, etc.).
- Esquema de tablas (no se requiere migración — todo ya existe).
- Flujo actual de `PartnerSettings.tsx` (sigue editando partner existente).
- Endpoints de API de provisioning de tenants (ya consumen `api_key` de la columna existente).

## Riesgos / mitigaciones

- **`partner_super_wallets` no se crea automáticamente** al insertar partner → lo creamos explícito en el flujo.
- **Trigger de `set_user_partner_scope`** no se invoca aquí porque no asignamos usuario admin del partner en este wizard (queda fuera de alcance — el super admin global puede invitar al admin del partner desde `AdminUsers` después).
- **Bucket de logos**: usamos el bucket que ya existe en `PartnerSettings` (verificado en código).
