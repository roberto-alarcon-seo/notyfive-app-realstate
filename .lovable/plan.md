## Objetivo

Agregar un campo editable **"Dominio app"** al inicio del tab **Redireccionamiento** en `/admin/partner-settings`. Este campo controla la URL base usada por el endpoint `sso-partner-callback` para construir el `redirectTo` del magic link, eliminando cualquier dependencia hardcodeada por partner.

## Contexto

La columna `partners.primary_domain` ya existe en la base de datos y ya es leída por el edge function `sso-partner-callback` (línea ~210) para construir el `redirectTo` del magic link. Hoy el valor se setea manualmente en la BD; el plan lo expone como campo editable en la UI.

No se requieren migraciones ni cambios en edge functions.

## Cambios

### 1. `src/pages/admin/PartnerSettings.tsx`

**a) Interfaz `PartnerRow`**: agregar `primary_domain: string`.

**b) Query de carga (línea ~82)**: incluir `primary_domain` en el `select`.

**c) Handler `handleSave` (línea ~238)**: incluir `primary_domain: partner.primary_domain?.trim() || null` en el update. Validar que no esté vacío (es `not null` en DB) y que sea una URL válida (http/https) antes de guardar.

**d) Tab "Redireccionamiento" (línea ~703)**: agregar como **primera sección** dentro de la Card un nuevo bloque:

```
Label: "Dominio app"
Input type="url" placeholder="https://app.brokia24.com"
Helper text: "URL base del partner. Se usa para construir el redirectTo 
              del magic link SSO (ej. https://app.brokia24.com/)."
```

Este campo aparece **arriba** de los campos existentes `non_sso_redirect_url` y `logout_redirect_url`, separado por un divider.

**e) Permisos**: editable solo para Super Admin global (`isGlobalAdmin`); read-only para Partner Admin (`disabled` en el input), siguiendo el mismo patrón usado en el tab API keys.

### 2. Edge Function `sso-partner-callback`

**Sin cambios de lógica** — ya consume `partners.primary_domain`. Solo se valida que el comportamiento siga siendo:

```ts
const domain = (partnerRow?.primary_domain ?? "").trim();
if (domain) {
  appOrigin = domain.startsWith("http") ? domain : `https://${domain}`;
}
const redirectUrl = new URL("/", appOrigin).toString();
```

Confirmado: al editar "Dominio app" en la UI, el siguiente magic link generado usará automáticamente el nuevo valor sin redeploy.

### 3. `src/integrations/supabase/types.ts`

Se regenera automáticamente; `primary_domain` ya está presente en el schema.

## Validación posterior

1. Editar "Dominio app" del partner `brokia` a `https://app.brokia24.com` y guardar.
2. Llamar `POST /sso-partner-callback` con `partner_id: "brokia"`.
3. Verificar que el `magic_link` retornado contenga `redirect_to=https://app.brokia24.com/`.
4. Repetir con `mls_latam` y `responde` para confirmar aislamiento por partner.
