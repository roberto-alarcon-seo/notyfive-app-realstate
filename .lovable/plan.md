# Plan: White Label Multimarca (Partner Level)

Arquitectura para que la misma instancia sirva múltiples marcas (Brokia24, MLS Latam, Responde) detectando el `hostname` y el `partner_id` del tenant/super-admin para inyectar branding, emails y restricciones de acceso.

---

## 1. Esquema de base de datos

### 1.1 Nueva tabla `partners`
Fuente de verdad del branding y configuración por marca.

```sql
CREATE TABLE public.partners (
  id text PRIMARY KEY,                    -- 'brokia', 'mls_latam', 'responde'
  name text NOT NULL,                     -- 'Brokia24', 'MLS Latam', 'Responde'
  primary_domain text NOT NULL UNIQUE,    -- 'app.brokia24.com'
  alt_domains text[] DEFAULT '{}',        -- dominios alternos (preview, lovable.app)
  country_code text NOT NULL DEFAULT 'MX',
  -- Branding visual
  logo_url text NOT NULL,
  logo_mark_url text,                     -- icono cuadrado para favicons/PWA
  primary_color_hex text NOT NULL,        -- '#7C3AED'
  primary_color_hsl text NOT NULL,        -- '262 83% 58%' (para CSS vars)
  accent_color_hex text,
  -- Branding email
  email_sender_name text NOT NULL,        -- 'Responde'
  email_sender_address text NOT NULL,     -- 'no-reply@notifications.responde.mx'
  email_branding_logo text,               -- logo para HTML del email
  email_footer_text text,
  -- Metadata
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed inicial
INSERT INTO public.partners VALUES
  ('brokia', 'Brokia24', 'app.brokia24.com', ARRAY['linkasa.brokia24.com','notyfive-app-realstate.lovable.app'],
   'MX', 'https://...brokia-logo.png', NULL,
   '#942CCC', '279 65% 49%', NULL,
   'Brokia24', 'no-reply@notifications.brokia24.com', NULL, NULL, true, now(), now()),
  ('mls_latam', 'MLS Latam', 'app.mlslatam.com', '{}',
   'CO', 'https://.../6d226a31-...png', NULL,
   '#00A884', '162 100% 33%', NULL,
   'MLS Latam', 'no-reply@notifications.mlslatam.com', NULL, NULL, true, now(), now()),
  ('responde', 'Responde', 'app.responde.mx', '{}',
   'MX', 'https://.../270634a4-...png', NULL,
   '#7C3AED', '262 83% 58%', NULL,
   'Responde', 'no-reply@notifications.responde.mx', NULL, NULL, true, now(), now());

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
-- Lectura pública (necesaria para branding pre-login)
CREATE POLICY "Anyone can read active partners" ON public.partners
  FOR SELECT USING (is_active = true);
-- Escritura solo super_admin global (sin partner_id)
CREATE POLICY "Global super admins manage partners" ON public.partners
  FOR ALL USING (is_super_admin(auth.uid()));
```

### 1.2 Vincular `tenants` a un partner
```sql
ALTER TABLE public.tenants
  ADD COLUMN partner_id text REFERENCES public.partners(id) DEFAULT 'brokia' NOT NULL;
CREATE INDEX idx_tenants_partner_id ON public.tenants(partner_id);
```

### 1.3 Vincular Super Admins a un partner (segregación)
```sql
ALTER TABLE public.user_roles
  ADD COLUMN partner_scope text REFERENCES public.partners(id);
-- NULL = super admin global (ve todos los partners)
-- 'mls_latam' = super admin restringido a tenants de MLS
COMMENT ON COLUMN public.user_roles.partner_scope IS
  'Scope del super_admin. NULL = global. Valor = solo ve ese partner.';
```

### 1.4 Helper SQL para RLS
```sql
CREATE OR REPLACE FUNCTION public.get_user_partner_scope(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_scope FROM user_roles WHERE user_id = _user_id LIMIT 1;
$$;
```

Actualizar políticas SELECT de `tenants` para que un super admin con `partner_scope` solo vea tenants de ese partner (filtro adicional, no reemplazo del `is_super_admin`).

---

## 2. Frontend: branding dinámico

### 2.1 `src/config/partnerConfig.ts`
- Fallback estático con los 3 partners (brokia, mls_latam, responde) por si la DB no responde antes del primer paint.
- Mapa `hostname → partner_id` que cubre dominios primarios + previews (`*.lovable.app` → 'brokia' por default).

### 2.2 Hook `src/hooks/usePartnerBranding.ts`
- Detecta `window.location.hostname` al montar.
- Resuelve partner: 1) cache estático, 2) fetch a `partners` table.
- Inyecta CSS variables en `:root`:
  ```ts
  document.documentElement.style.setProperty('--primary', partner.primary_color_hsl);
  document.documentElement.style.setProperty('--ring', partner.primary_color_hsl);
  document.documentElement.style.setProperty('--sidebar-primary', partner.primary_color_hsl);
  ```
- Actualiza `<title>`, favicon, meta theme-color y manifest.
- Expone `{ partner, logoUrl, brandName, isLoading }` vía Context.

### 2.3 `PartnerBrandingProvider`
- Wrapper en `App.tsx` (envuelve `AuthProvider`).
- Inicializa branding ANTES de cualquier render para evitar flash de marca incorrecta.

### 2.4 Reemplazar logos hardcodeados
- `Auth.tsx`, `Landing.tsx`, `IconSidebar.tsx`, `MobileLayout.tsx`, `SsoCallback.tsx`: usar `usePartnerBranding().logoUrl` y `brandName` en lugar de `import logo from '@/assets/...'`.
- Mantener fallback al logo Brokia si el partner no carga.

---

## 3. Segregación Super Admins

### 3.1 Extender `AuthContext`
- Agregar `partnerScope: string | null` al estado (leído de `user_roles.partner_scope`).
- Agregar `currentPartner` (resuelto del hostname vía `usePartnerBranding`).

### 3.2 `AdminTenants.tsx`
- En `fetchTenants()`: si `partnerScope` no es null, agregar `.eq('partner_id', partnerScope)` al query.
- En el formulario "Nuevo Tenant": si tiene scope, forzar `partner_id = partnerScope` (campo oculto). Si es global, agregar selector de partner.
- Mostrar badge de partner por fila en la tabla.

### 3.3 `AdminUsers.tsx`
- Mismo filtro: super admins con scope solo ven usuarios cuyos tenants pertenecen a su partner.
- Al invitar nuevo super admin, permitir asignar `partner_scope` (solo super admins globales pueden hacerlo).

### 3.4 Validación en edge functions
- `admin-invite-owner`, `admin-invite-super-admin`, `admin-impersonate-sso`: validar que el caller con `partner_scope != null` solo opere sobre tenants de su partner. Devolver 403 si no.

---

## 4. Restricción cross-domain (auto-redirect)

### 4.1 En `auth-sso/index.ts`
Después de resolver el tenant pero antes de generar el magic link:
1. Leer `tenant.partner_id` y joinear `partners.primary_domain`.
2. Comparar contra el `origin` del request (host del referer/Origin header).
3. Si NO coincide y NO está en `alt_domains`:
   - Reconstruir URL al `primary_domain` correcto preservando `?token=...&redirect=...&mode=...`.
   - Devolver 302 a `https://{partner.primary_domain}/auth/sso?token=...`.
4. Si coincide: continuar flujo normal.

### 4.2 En login manual (`Auth.tsx` super admins)
- Después del `signIn`, si el super admin tiene `partner_scope` y el hostname actual no coincide con `partner.primary_domain`:
  - Mostrar toast "Esta cuenta pertenece a {partner.name}. Redirigiendo..."
  - `window.location.replace('https://' + partner.primary_domain + '/admin')`.

### 4.3 Pre-validación en frontend
- En `App.tsx`, hook que compara `currentPartner.id` vs `tenant.partner_id` post-login. Si mismatch, signOut + redirect con toast.

---

## 5. Emails dinámicos por marca

### 5.1 Helper compartido `supabase/functions/_shared/partnerBranding.ts`
```ts
export async function getPartnerForTenant(supabase, tenantId): Promise<Partner>
export async function getPartnerById(supabase, partnerId): Promise<Partner>
export function buildEmailFrom(partner): string  // "Responde <no-reply@notifications.responde.mx>"
export function injectPartnerIntoTemplate(html, partner): string
  // Reemplaza {{LOGO_URL}}, {{BRAND_NAME}}, {{PRIMARY_COLOR}}, {{FOOTER}} en el HTML
```

### 5.2 Refactor de funciones de email
Aplicar el helper en:
- `invite-tenant-user/index.ts` → resuelve partner via `tenant.partner_id`
- `admin-invite-owner/index.ts` → idem
- `admin-invite-super-admin/index.ts` → resuelve via `partner_scope` del invitador (o partner del dominio si es global)
- `auth-password-reset/index.ts` → resuelve via tenant del usuario que solicita reset
- `auth-change-password/index.ts` → idem
- `send-email/index.ts` → aceptar `partner_id` opcional en el body, default 'brokia'

Reemplazar `from: "NotyFive <no-reply@notifications.notyfive.com>"` hardcodeado por `from: buildEmailFrom(partner)`.

### 5.3 Templates HTML parametrizados
Cambiar templates inline (texto "Brokia", logo hardcoded, color `#7C3AED`) por placeholders sustituidos en runtime con datos del partner. Botones del CTA deben usar `partner.primary_color_hex`.

### 5.4 Verificación de dominios Resend
**Acción del usuario** (no automatizable): verificar `notifications.mlslatam.com` y `notifications.responde.mx` en el dashboard de Resend. Mientras tanto, fallback a `no-reply@resend.dev` con `email_sender_name` correcto.

---

## 6. UI Super Admin: gestión de Partners

### 6.1 Nueva página `src/pages/admin/AdminPartners.tsx` (solo super admins globales)
- Lista de partners con logo, dominio, color, # de tenants.
- Formulario CRUD con secciones:
  - **Identidad**: id, nombre, dominio primario, dominios alternos
  - **Branding visual**: logo, logo mark, colores (color picker → genera hex+hsl auto)
  - **Branding email**: nombre emisor, dirección emisor, logo email, footer
  - **País + estado activo**

### 6.2 En `TenantDetailPanel.tsx`
- Mostrar badge del partner.
- Si es super admin global: selector para reasignar partner del tenant.

---

## 7. Orden de implementación

1. **Migración DB** — tabla `partners`, columnas `partner_id`/`partner_scope`, seed de 3 partners, helper SQL.
2. **Frontend branding** — `partnerConfig.ts`, `usePartnerBranding`, `PartnerBrandingProvider`, reemplazar logos hardcoded.
3. **Edge functions emails** — helper compartido + refactor de las 6 funciones.
4. **Segregación admin** — AuthContext, filtros en AdminTenants/AdminUsers, validación en edge functions.
5. **Cross-domain redirect** — lógica en `auth-sso` + frontend post-login.
6. **CRUD partners** — página AdminPartners.

---

## ⚠️ Notas importantes

- **Los previews `*.lovable.app`** caen en partner 'brokia' por defecto (configurable en `alt_domains`).
- **Dominios DNS**: `app.mlslatam.com` y `app.responde.mx` deben apuntar (CNAME) al hosting de Lovable. El usuario debe configurarlos en Project Settings → Domains.
- **Resend**: los dominios `notifications.mlslatam.com` y `notifications.responde.mx` requieren verificación manual SPF/DKIM en el dashboard de Resend antes de enviar emails reales.
- **No rompe nada existente**: tenants actuales heredan `partner_id = 'brokia'` por default, super admins actuales mantienen `partner_scope = NULL` (global).
- **Lovable Cloud Emails**: Si prefieres en lugar de Resend usar el sistema de emails nativo de Lovable Cloud (queue, retry, suppression), se puede migrar después — el helper de partner branding queda igual.
