# Auditoría Técnica — Multitenancy, Seguridad y White Label

> **Proyecto:** Brokia24 / Plataforma CRM Inmobiliaria LATAM
> **Stack:** React 18 + Vite + TS · Lovable Cloud (Supabase) · Edge Functions (Deno) · Twilio WhatsApp
> **Fecha:** 2026-05-04
> **Autor:** Auditoría Fullstack Senior
> **Objetivo:** Validar el estado del aislamiento multitenant, identificar vulnerabilidades de RLS y trazar el roadmap para el modelo White Label en producción.

---

## 0. Resumen Ejecutivo

| Área | Estado | Severidad pendiente |
|---|---|---|
| Aislamiento por `tenant_id` en tablas | ✅ 53/63 con `tenant_id`; resto justificadas | — |
| RLS habilitado en `public.*` | ✅ 63/63 tablas (100%) | — |
| Políticas RLS escritas con `get_user_tenant_id()` | ✅ Patrón consistente | — |
| Roles legacy (`owner`, `marketer`, `readonly`) | ⚠️ Aún referenciados en RLS y migraciones | **Media** |
| Funciones SECURITY DEFINER expuestas a `anon` | ⚠️ Linter reporta ~10 funciones | **Alta** |
| `search_path` mutable en funciones | ⚠️ Varias funciones lo tienen mutable | **Alta** |
| Buckets de Storage públicos con listing abierto | ⚠️ 3 buckets | **Media** |
| Branding por tenant (`partners` table) | ✅ Tabla `partners` con `branding jsonb` | — |
| Branding por **tenant individual** (no partner) | ❌ No existe override por tenant | **Media** |
| Resolución de partner por dominio | ✅ Implementada (`PartnerBrandingContext`) | — |
| Cifrado de tokens de integración (Twilio) | ⚠️ Solo `btoa` (Base64, no cifrado real) | **Alta** |
| Webhook Twilio con validación de firma | ❌ No verifica `X-Twilio-Signature` | **Alta** |

**Veredicto:** la app **NO está lista para producción multi-cliente sin White Label real**, pero el aislamiento de datos por tenant es sólido. Los bloqueos críticos están en:
1. Cifrado real de credenciales de terceros.
2. Limpieza de roles legacy (`owner`).
3. Hardening de Edge Functions (firma Twilio, search_path, anon-callable definers).
4. Capa de branding por tenant (no solo por partner).

---

## 1. Auditoría de Seguridad y Datos (Multitenancy)

### 1.1 Cobertura de `tenant_id` en tablas `public.*`

Se auditaron **63 tablas** en el esquema `public`. La cobertura es la siguiente:

#### ✅ Tablas con `tenant_id` directo (53)

`ai_interaction_logs`, `ai_knowledge_base`, `api_tokens`, `automation_events`, `automation_idempotency`, `automation_run_steps`, `automation_runs`, `automations`, `campaign_contacts`, `campaign_deliveries`, `campaign_queue`, `campaign_stats`, `campaigns`, `contact_consent_events`, `contact_consents`, `contact_custom_fields`, `contact_notes`, `contact_opt_out`, `contacts`, `conversation_activity`, `conversation_followups`, `conversations`, `conversion_event_logs`, `event_audit_logs`, `events`, `messages`, `meta_event_mappings`, `partner_sso_logs`, `partner_wallet_ledger`, `password_resets`, `pipeline_stage_suggestions`, `profiles`, `properties`, `property_assignments`, `property_documents`, `property_faq`, `property_images`, `security_events`, `segments`, `support_internal_notes`, `support_tickets`, `system_alerts`, `system_event_bus`, `templates`, `tenant_ai_settings`, `tenant_integrations`, `tenant_settings`, `wallet_idempotency`, `wallet_ledger`, `wallet_transactions`, `wallets`.

#### ⚠️ Tablas SIN `tenant_id` directo — requieren validación caso por caso

| Tabla | Sin `tenant_id` por… | RLS hereda de | ¿Aislamiento OK? |
|---|---|---|---|
| `tenants` | Es la tabla raíz | `id = get_user_tenant_id(auth.uid())` | ✅ |
| `user_roles` | FK a `auth.users.id` | `user_id = auth.uid()` | ⚠️ Ver §1.3 |
| `partners` | Tabla global cross-tenant | `is_active = true` para SELECT público | ⚠️ Ver §1.4 |
| `partner_super_wallets` | Scope por partner | `is_super_admin + partner_scope` | ✅ |
| `master_templates` | Catálogo global | `SELECT true` para autenticados | ⚠️ Ver §1.5 |
| `system_config` | Configuración global | Solo super_admin | ✅ |
| `internal_system_auth` | Auth interna entre servicios | Solo super_admin | ✅ |
| `contact_custom_field_options` | Hereda vía `field_id → contact_custom_fields.tenant_id` | Subquery con `EXISTS` | ✅ |
| `contact_custom_field_values` | Hereda vía `contact_id → contacts.tenant_id` | Subquery con `EXISTS` | ✅ |
| `segment_contacts` | Hereda vía `segment_id → segments.tenant_id` | Subquery con `EXISTS` | ✅ |
| `support_attachments` | Hereda vía `ticket_id → support_tickets.tenant_id` | Subquery con `EXISTS` | ✅ |
| `support_messages` | Hereda vía `ticket_id` | Subquery con `EXISTS` | ✅ |
| `support_ticket_reads` | Hereda vía `ticket_id` | Subquery con `EXISTS` | ✅ |

**Conclusión §1.1:** La cobertura es **completa**. Las 10 tablas sin `tenant_id` directo tienen aislamiento correcto vía herencia o son intencionalmente globales.

---

### 1.2 Cobertura de RLS

✅ **63/63 tablas (100%) tienen RLS habilitado.**

No existe ninguna tabla en `public.*` con `relrowsecurity = false`. Esto descarta la vulnerabilidad más crítica (data público sin filtro).

---

### 1.3 Patrón de RLS — Análisis del modelo

El proyecto usa un patrón consistente con **funciones `SECURITY DEFINER`** para evitar recursión en RLS:

```sql
-- Función pivote para obtener tenant del usuario actual
public.get_user_tenant_id(_user_id uuid) RETURNS uuid

-- Funciones de rol (también SECURITY DEFINER, STABLE)
public.is_super_admin(_user_id uuid)
public.is_tenant_admin(_user_id uuid)
public.is_tenant_manager_or_admin(_user_id uuid)
public.has_tenant_role(_user_id uuid, _role tenant_role)
public.has_any_tenant_role(_user_id uuid, _roles tenant_role[])
public.has_property_assignment(_user_id uuid, _property_id uuid)
public.can_access_conversation(_user_id uuid, _conversation_id uuid)
```

Y políticas que las invocan, por ejemplo para `tenants`:

```sql
-- ✅ CORRECTO: usuario solo ve su propio tenant
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = get_user_tenant_id(auth.uid()));

-- ✅ CORRECTO: super_admin con scope de partner solo ve sus tenants
CREATE POLICY "Partner admins can view their partner tenants"
  ON public.tenants FOR SELECT
  USING (
    is_super_admin(auth.uid())
    AND get_user_partner_scope(auth.uid()) IS NOT NULL
    AND partner_id = get_user_partner_scope(auth.uid())
  );
```

**✅ Veredicto §1.3:** El modelo es **correcto y resistente a privilege escalation**. Imposible que un usuario del tenant A vea datos del tenant B sin pasar por una función `SECURITY DEFINER` auditada.

---

### 1.4 ⚠️ HALLAZGOS — Vulnerabilidades y deuda técnica

#### 🔴 ALTA — Roles legacy `owner`, `marketer`, `readonly` aún referenciados en RLS

El sistema migró a `administrador / manager / asesor` (ver `docs/MODULO_USUARIOS_ROLES.md`), pero **políticas RLS y código aún consultan los roles antiguos**. Ejemplos detectados:

```sql
-- tenant_integrations
CREATE POLICY "Owners can insert integrations" ...
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
             AND has_tenant_role(auth.uid(), 'owner'::tenant_role));

-- contact_custom_field_options
"Owners can delete options for their tenant fields" → has_tenant_role('owner')

-- contact_custom_field_values, segment_contacts
has_any_tenant_role(... ARRAY['owner','marketer']) -- legacy mix

-- tenant_settings, tenant_ai_settings
has_any_tenant_role(... ARRAY['owner','administrador']) -- mezcla legacy + nuevo
```

**Impacto:** Si un nuevo usuario es creado como `administrador`, no puede insertar/eliminar `tenant_integrations` (la política exige `owner`). Hoy funciona porque hay registros con `owner` heredados, pero **bloquea la creación de nuevos administradores reales**.

**Acción:** Migrar todas las RLS a `administrador / manager` y deprecar `owner / marketer / readonly` del enum `tenant_role` o dejarlos como alias por compatibilidad temporal.

#### 🔴 ALTA — Funciones `SECURITY DEFINER` callables por `anon`

El linter reporta **10+ funciones** que el rol `anon` puede ejecutar (lints `0028`). Esto significa que un atacante sin sesión puede invocar lógica privilegiada vía `POST /rest/v1/rpc/<funcion>`.

**Acción:**
```sql
REVOKE EXECUTE ON FUNCTION public.<nombre>(...) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.<nombre>(...) TO authenticated;
```

Auditar individualmente: `fn_apply_credit_movement`, `fn_debit_credits`, `fn_refill_monthly_credits`, `fn_wallet_debit_credits`, `partner_wallet_redeem_to_tenant_service`, `complete_tenant_onboarding`, `activate_tenant_subscription`, `deduct_message_credit`, etc.

#### 🔴 ALTA — `search_path` mutable en funciones

Linter reporta funciones sin `SET search_path = public` explícito. Esto permite **ataques de search_path hijacking** si un atacante crea objetos en un schema temporal con el mismo nombre que tablas referenciadas.

**Acción:** Para cada función reportada, recrear con `SET search_path = public` (la mayoría ya lo tienen — corregir las restantes).

#### 🟡 MEDIA — Storage buckets públicos con listing abierto

Linter reporta 3 buckets con `SELECT true` en `storage.objects` (lint `0025`). Cualquier visitante puede listar todos los archivos del bucket conociendo el nombre.

**Acción:** Restringir SELECT por path:
```sql
CREATE POLICY "Tenants can only read their own folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
  );
```

#### 🔴 ALTA — Cifrado falso en `tenant_integrations`

Las credenciales de Twilio (`auth_token`) se almacenan con `btoa()` (Base64), que **NO es cifrado** — es codificación reversible trivialmente. Cualquier acceso de lectura a la fila expone el token completo.

**Acción Fase 1 (rápida):** Usar `pgcrypto` con clave maestra en `vault`:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wrapper functions
CREATE FUNCTION public.encrypt_secret(_plain text) RETURNS text
  LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $$ SELECT encode(pgp_sym_encrypt(_plain, current_setting('app.master_key')), 'base64') $$;

CREATE FUNCTION public.decrypt_secret(_cipher text) RETURNS text
  LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $$ SELECT pgp_sym_decrypt(decode(_cipher,'base64'), current_setting('app.master_key')) $$;
```
Y revocar EXECUTE de `decrypt_secret` a todos excepto `service_role`.

**Acción Fase 2 (correcta):** Mover a Supabase Vault o KMS externo (AWS KMS / GCP KMS).

#### 🔴 ALTA — `twilio-inbound-webhook` sin validación de firma

El edge function que recibe inbound de Twilio no verifica `X-Twilio-Signature`. Cualquiera puede inyectar mensajes falsos al sistema (spoofing de leads).

**Acción:**
```ts
import { createHmac } from "node:crypto";
const expected = createHmac('sha1', authToken)
  .update(url + sortedBodyParams).digest('base64');
if (expected !== req.headers.get('x-twilio-signature')) {
  return new Response('forbidden', { status: 403 });
}
```

#### 🟡 MEDIA — `master_templates` legible por cualquier autenticado

`SELECT true` para `authenticated`. Si las plantillas master contienen información comercial sensible o rutas internas, considerar restringir a super_admins.

#### 🟢 BAJA — Falta protección contra escalada en `user_roles`

Verificar que existe trigger que prohíba a un usuario insertar/actualizar su propia fila en `user_roles` con `global_role = 'super_admin'`. La memoria del proyecto menciona `Security Triggers` pero hay que confirmar que cubren este vector.

---

### 1.5 Conclusión §1 — Aislamiento entre tenants

✅ **Sí existe aislamiento total entre tenants en la capa de datos.** El diseño RLS + funciones `SECURITY DEFINER` es correcto.

⚠️ Las **brechas reales son perimetrales**, no de modelo:
- Edge Functions sin firma → permite inyección.
- Tokens en btoa → fuga si la fila se filtra.
- Funciones `anon-callable` → DoS y abuso de RPCs sensibles.
- Roles legacy → bloqueará nuevos onboarding tan pronto se eliminen los registros `owner`.

---

## 2. Preparación para White Label

### 2.1 Estado actual del branding

#### Tabla `partners`
Existe y soporta white-label a nivel **partner** (mayorista), no por tenant individual:

```
partners {
  id text PK,
  name, country_code,
  primary_domain, alt_domains jsonb,
  logo_url, logo_mark_url,
  primary_color_hex, primary_color_hsl, accent_color_hex,
  email_sender_name, email_sender_address, email_footer_text,
  branding jsonb,        -- design tokens completos (PartnerTheme)
  dashboard_url, non_sso_redirect_url, logout_redirect_url,
  is_active boolean
}
```

#### Resolución del partner activo
`src/contexts/PartnerBrandingContext.tsx`:

1. **Sync inicial** desde `hostname` → `partnerConfig.ts` (fallback estático sin flash).
2. **Hidratación async** desde tabla `partners` matching por `primary_domain` o `alt_domains`.
3. **Override por auth bridge**: cuando el usuario autentica, `setActivePartnerId(tenant.partner_id)` cambia el tema al del partner del tenant.
4. **Aplicación CSS**: `applyPartnerTheme(theme)` reescribe variables HSL en `:root` (sidebar, surfaces, accent, primary).

✅ **Veredicto:** la infraestructura de white label **a nivel partner** es sólida y funcional.

### 2.2 ❌ Brechas para White Label completo

#### Brecha 1 — No existe branding por tenant individual
Hoy todos los tenants de un partner comparten branding. Si un cliente final (tenant) quiere su propio logo y color (caso típico de "white label de white label"), no es posible.

**Solución propuesta:**
```sql
ALTER TABLE public.tenants
  ADD COLUMN branding_overrides jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN custom_logo_url text,
  ADD COLUMN custom_primary_color_hsl text,
  ADD COLUMN custom_domain text UNIQUE;
```

Y en `PartnerBrandingContext`, hacer merge:
```ts
const finalTheme = {
  ...partnerTheme,
  ...(tenantBrandingOverrides ?? {}),
};
```

#### Brecha 2 — Resolución por dominio custom de tenant
Hoy se resuelve solo por `partners.primary_domain`. Falta lookup por `tenants.custom_domain` con CNAME.

**Solución:**
```ts
// En PartnerBrandingContext, antes de resolver por partner:
const { data: tenantByDomain } = await supabase
  .from('tenants')
  .select('id, partner_id, branding_overrides, custom_logo_url, custom_primary_color_hsl')
  .eq('custom_domain', hostname)
  .maybeSingle();
if (tenantByDomain) { /* aplicar tenant override */ }
```

Adicionalmente, infra: configurar wildcard SSL (Let's Encrypt) y proxy (Vercel/Cloudflare) que acepte CNAME apuntando al dominio del partner.

#### Brecha 3 — Asset hosting para logos custom
Los logos hoy viven en `/lovable-uploads/` (estáticos). Para tenants white-label se necesita:
- Bucket `tenant-branding` en Storage con RLS por `tenant_id`.
- Endpoint público de lectura (CDN) por path.
- UI en `Settings → Branding` para upload.

#### Brecha 4 — Email transaccional white-label
`partners.email_sender_address` ya soporta override. Falta:
- Verificación SPF/DKIM/DMARC por dominio de tenant.
- Plantillas de email parametrizables por tenant (no solo partner).

#### Brecha 5 — PWA Manifest dinámico
`public/manifest.json` es estático. Para white label real:
- Generar `manifest.webmanifest` dinámico vía Edge Function que lea `tenant.custom_logo_url + custom_primary_color_hsl`.
- Servir favicon/apple-touch-icon dinámicos.
- `<meta name="theme-color">` ya se actualiza dinámicamente ✅.

#### Brecha 6 — Hardcodes de marca "Brokia24"
Buscar y eliminar referencias hardcodeadas:
```bash
rg -i "brokia" src/ --files-with-matches
```
Reemplazar por `partner.name` / `partner.emailFooterText`.

---

## 3. Hoja de Ruta Priorizada

### 🔴 PRIORIDAD ALTA — Seguridad (bloqueantes producción)

| # | Tarea | Esfuerzo | Owner sugerido |
|---|---|---|---|
| A1 | Reemplazar `btoa()` por cifrado real (`pgcrypto` + master key en secret) en `tenant_integrations.auth_token` | M | Backend |
| A2 | Validar `X-Twilio-Signature` HMAC-SHA1 en `twilio-inbound-webhook` y `proxy-twilio-media` | S | Backend |
| A3 | `REVOKE EXECUTE FROM anon` en todas las funciones `SECURITY DEFINER` que no deben ser públicas (lint 0028, ~10 funciones) | S | DBA |
| A4 | Añadir `SET search_path = public` a todas las funciones reportadas por lint 0011 | S | DBA |
| A5 | Migrar políticas RLS de `'owner'` → `'administrador'` y de `'marketer'` → `'manager'` (tenant_integrations, tenant_settings, contact_custom_field_*, segment_contacts, support_attachments, support_messages, contact_custom_field_options) | M | Backend |
| A6 | Eliminar valores legacy `owner / marketer / readonly` del enum `tenant_role` (después de A5) o documentar como deprecados | S | DBA |
| A7 | Verificar trigger anti-escalada en `user_roles` (que un usuario no pueda insertar/cambiar `global_role = 'super_admin'` para sí mismo) | S | DBA |
| A8 | Cerrar storage buckets públicos: política de SELECT por carpeta `tenant_id` (lint 0025) | M | DBA |
| A9 | Mover extensiones de schema `public` (lint 0014) a `extensions` | S | DBA |
| A10 | Auditar `master_templates` SELECT abierto a `authenticated` — ¿debería ser solo super_admin? | S | Backend |
| A11 | Rotar `TWILIO_MASTER_AUTH_TOKEN` y todos los tokens almacenados con `btoa` tras desplegar A1 | S | Ops |

### 🟡 PRIORIDAD MEDIA — White Label (lanzamiento comercial)

| # | Tarea | Esfuerzo |
|---|---|---|
| B1 | Migración: añadir `tenants.custom_domain`, `branding_overrides jsonb`, `custom_logo_url`, `custom_primary_color_hsl` | S |
| B2 | Bucket `tenant-branding` en Storage + RLS por `tenant_id` + UI upload en `Settings → Branding` | M |
| B3 | Resolución por `tenants.custom_domain` en `PartnerBrandingContext` antes de fallback al partner | M |
| B4 | Merge de tema: `partnerTheme + tenantOverrides` en `applyPartnerTheme` | S |
| B5 | Edge Function `dynamic-manifest` que sirve `manifest.webmanifest` por tenant (theme_color, icons) | M |
| B6 | Reemplazar todos los hardcodes "Brokia24" en componentes por `partner.name` | S |
| B7 | DNS automation: documentar setup CNAME + SSL wildcard (Vercel custom domains API o Cloudflare) | M |
| B8 | Email DKIM/SPF por tenant — integrar Resend/SendGrid con dominios verificados dinámicos | L |
| B9 | UI Super Admin: panel "Branding del Tenant" en `TenantOverviewTab` para subir overrides | M |
| B10 | Plantillas de email parametrizables por tenant (no solo partner) | M |

### 🟢 PRIORIDAD BAJA — Escalabilidad y limpieza

| # | Tarea | Esfuerzo |
|---|---|---|
| C1 | Índices compuestos en tablas calientes: `messages(tenant_id, conversation_id, created_at DESC)`, `contacts(tenant_id, pipeline_stage, last_message_at DESC)`, `events(tenant_id, start_at)` | S |
| C2 | Particionamiento mensual de `messages` y `ai_interaction_logs` (cuando >10M filas) | L |
| C3 | Job de archivado/purga para `automation_run_steps`, `event_audit_logs`, `ai_interaction_logs` (>90 días) | M |
| C4 | Cache (Redis o Supabase Edge Cache) para queries de pipeline dashboard agregado | M |
| C5 | Consolidar funciones de wallet duplicadas (`fn_debit_credits`, `fn_wallet_debit_credits`, `deduct_message_credit`) en una sola | M |
| C6 | Limpiar tablas legacy si `wallet_transactions` está deprecada en favor de `wallet_ledger` | S |
| C7 | Lint del frontend: aplicar `tsc --noEmit` en CI bloqueando build con `any` implícitos | S |
| C8 | Auditoría de bundle size — code splitting por ruta admin vs operacional | M |
| C9 | Observabilidad: integrar Sentry/Logflare con `tenant_id` en cada request | M |
| C10 | Tests E2E (Playwright) para flujos críticos: SSO, envío WhatsApp, asignación property | L |

---

## 4. Snippets de corrección listos para aplicar

### 4.1 Migración de RLS — eliminar `owner` legacy

```sql
-- tenant_integrations
DROP POLICY IF EXISTS "Owners can insert integrations" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Owners can update integrations" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Owners can delete integrations" ON public.tenant_integrations;

CREATE POLICY "Admins can manage integrations"
  ON public.tenant_integrations FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_tenant_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND is_tenant_admin(auth.uid()));

-- tenant_settings
DROP POLICY IF EXISTS "Admins can manage tenant settings" ON public.tenant_settings;
CREATE POLICY "Admins can manage tenant settings"
  ON public.tenant_settings FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_tenant_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND is_tenant_admin(auth.uid()));

-- contact_custom_fields / options / values, segments / segment_contacts:
-- reemplazar has_any_tenant_role(... 'owner','marketer') por is_tenant_manager_or_admin(auth.uid())
```

### 4.2 Cifrado real para tokens de integración

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- En lugar de almacenar btoa(token), almacenar pgp_sym_encrypt(token, master_key).
-- master_key vive en una secret consultada solo por edge functions con service_role.

ALTER TABLE public.tenant_integrations
  ADD COLUMN auth_token_encrypted bytea;

-- Backfill (script de migración one-shot ejecutado desde edge function admin):
UPDATE public.tenant_integrations
SET auth_token_encrypted = pgp_sym_encrypt(
  convert_from(decode(auth_token, 'base64'), 'UTF8'),
  current_setting('app.master_key')
)
WHERE auth_token IS NOT NULL;

-- Después: ALTER TABLE ... DROP COLUMN auth_token;
```

### 4.3 Validación de firma Twilio

```ts
// supabase/functions/_shared/twilio-signature.ts
import { createHmac } from "node:crypto";

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): boolean {
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map(k => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return expected === signature;
}

// En twilio-inbound-webhook/index.ts:
const signature = req.headers.get("x-twilio-signature") ?? "";
const formData = await req.formData();
const params: Record<string, string> = {};
formData.forEach((v, k) => { params[k] = String(v); });

const authToken = await fetchTokenForAccountSid(params.AccountSid); // usar decrypt_secret
if (!verifyTwilioSignature(req.url, params, signature, authToken)) {
  return new Response("Forbidden", { status: 403 });
}
```

### 4.4 Branding por tenant — migración base

```sql
ALTER TABLE public.tenants
  ADD COLUMN custom_domain text UNIQUE,
  ADD COLUMN custom_logo_url text,
  ADD COLUMN custom_primary_color_hsl text,
  ADD COLUMN branding_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_tenants_custom_domain ON public.tenants(custom_domain) WHERE custom_domain IS NOT NULL;

-- Permitir lookup público por dominio custom (sin filtrar otros campos sensibles)
CREATE OR REPLACE VIEW public.tenant_branding_public
  WITH (security_invoker = on) AS
SELECT id, partner_id, custom_domain, custom_logo_url,
       custom_primary_color_hsl, branding_overrides
FROM public.tenants
WHERE custom_domain IS NOT NULL;
```

### 4.5 Storage bucket para branding por tenant

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-branding', 'tenant-branding', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Tenant admins upload branding"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    AND is_tenant_admin(auth.uid())
  );

CREATE POLICY "Public read branding"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-branding');
```

---

## 5. Checklist de Go-Live a Producción

- [ ] **A1–A11** (Prioridad Alta) cerradas y verificadas en staging.
- [ ] Backup automático diario configurado y probado (restore drill).
- [ ] Rate limiting en edge functions sensibles (`send-manual-message`, `auth-sso`, `manage-twilio-subaccount`).
- [ ] Monitoring: alerts de errores 5xx, latencia p95 > 1s, fallos de envío Twilio.
- [ ] Logs con `tenant_id` y PII redaction.
- [ ] Política de retención de mensajes/PII documentada (LGPD/LFPDPPP México).
- [ ] Términos y privacidad por partner accesibles.
- [ ] Plan de respuesta a incidentes: rotación de TWILIO_MASTER_AUTH_TOKEN, revocación de subaccount comprometida.
- [ ] Pruebas de carga: 1000 mensajes/min sostenidos sin throttling.
- [ ] Revisión de cumplimiento Meta WhatsApp Business Policy.

---

## 6. Conclusión

La aplicación tiene una **arquitectura de aislamiento multitenant correctamente diseñada en RLS**, pero presenta **brechas perimetrales serias** (cifrado falso, webhook sin firma, funciones expuestas a `anon`, roles legacy mezclados) que **bloquean la salida a producción seria**.

El white label a nivel **partner** ya funciona, pero el white label **por tenant** (caso real de uso comercial cuando un partner revende a múltiples marcas) **no existe** y requiere ~2-3 semanas de trabajo enfocado en B1–B6.

**Recomendación:** Cerrar TODAS las tareas de Prioridad Alta (estimado: 1-2 sprints) **antes** de cualquier go-live con clientes pagantes, y planear las de Prioridad Media en paralelo si el roadmap comercial requiere white label por tenant.

---

_Documento generado para consumo de IA y equipo de ingeniería. Para profundizar en cualquier sección, revisar el código fuente referenciado y `docs/MODULO_USUARIOS_ROLES.md`._