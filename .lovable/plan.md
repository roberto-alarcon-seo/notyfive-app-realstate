
## Objetivo

Generar un documento `.docx` editable, **únicamente blanco y negro** (sin colores), con la documentación técnica REAL del endpoint `sync-external-core` para MLS Latam, basada en una inspección línea por línea del código fuente (`supabase/functions/sync-external-core/index.ts`).

## Hallazgos clave de la inspección del código (correcciones vs. PDF anterior)

1. **El endpoint SÍ acepta el envoltorio `data`** (líneas 257–270): tanto `{ "action": "...", "data": { ... } }` como el formato plano funcionan. El código hace merge dando prioridad a las claves dentro de `data`. Por lo tanto los ejemplos del usuario con `data: { ... }` son válidos. El manual usará el formato `data: { ... }` como recomendado, ya que es el que envía el Core.
2. **Header de autenticación**: `x-api-key: <API_KEY>` (NO `Authorization: Bearer`). Esto es un error que tenía el manual previo.
3. **Método HTTP**: solo `POST`. Cualquier otro devuelve `405 Method not allowed`.
4. **Campos universalmente obligatorios**: `action` y `partner_id` en cada solicitud.

## Estructura del documento .docx

**Configuración global**: US Letter, márgenes 1", fuente Arial 11pt, tablas con bordes negros 1pt, sombreado de cabeceras `F2F2F2` (gris claro permitido en B/N), texto siempre negro, sin colores de marca.

### Secciones

1. **Portada** — Título "Manual de Integración Técnica · Motor de Gestión Inmobiliaria MLS Latam", subtítulo "Endpoint sync-external-core · v1.2", fecha de generación.

2. **1. Información general**
   - Descripción del motor.
   - Endpoint base: `https://ozsgtszxvojvqszpphmj.supabase.co/functions/v1/sync-external-core`
   - Método único: `POST`
   - Content-Type: `application/json`

3. **2. Autenticación**
   - Header obligatorio: `x-api-key: <EXTERNAL_CORE_API_KEY_MLS_LATAM>`
   - Aclaración: el sistema asocia la API key con `partner_id = mls_latam`. Cualquier intento de operar con otro `partner_id` retorna `403 partner_mismatch`.
   - Ejemplo de cabeceras completas.

4. **3. Estructura general de las solicitudes**
   - Formato recomendado (envoltorio `data`):
     ```json
     {
       "action": "<nombre_de_acción>",
       "data": {
         "partner_id": "mls_latam",
         "...": "..."
       }
     }
     ```
   - Nota: el campo `partner_id` es obligatorio en TODAS las acciones.

5. **4. Acciones disponibles**

   **4.1 `upsert_tenant` — Alta/actualización de inmobiliaria**
   - Descripción: crea o actualiza una inmobiliaria por clave compuesta `(partner_id, external_id)`.
   - Tabla de campos:
     | Campo | Tipo | Obligatorio | Validación |
     |---|---|---|---|
     | `external_id` | string | Sí | No vacío, ID único de MLS |
     | `name` | string | Sí | Mínimo 2 caracteres |
     | `partner_id` | string | Sí | Fijo: `mls_latam` |
     | `plan` | string | No | ≤64 chars, regex `[A-Za-z0-9 _.\-]+`. Default: `trial` |
     | `max_users` | integer | No | Entre 1 y 1000 |
     | `country_code` | string | No | ISO 3166-1 alpha-2 (`CO`, `MX`, `AR`...) |
     | `owner_email` | string | No | Email válido. Si se envía, provisiona al dueño |
     | `owner_name` | string | No | Nombre del dueño |
   - Ejemplo JSON cURL completo (basado en imagen 213).
   - Códigos de respuesta: `201` creado · `200` actualizado.
   - Errores específicos: `MAX_SEATS_REACHED` si `owner_email` excede asientos.

   **4.2 `sync_user` — Gestión de agentes**
   - Descripción: crea/actualiza un usuario dentro del tenant. Aislamiento por tenant: si el email ya existe en otra inmobiliaria → `EMAIL_IN_OTHER_TENANT` (409).
   - Tabla de campos:
     | Campo | Tipo | Obligatorio | Validación |
     |---|---|---|---|
     | `tenant_external_id` | string | Sí | Debe existir en MLS |
     | `email` | string | Sí | Email válido |
     | `partner_id` | string | Sí | `mls_latam` |
     | `name` | string | No | Default: parte local del email |
     | `tenant_role` | string | No | `owner` \| `administrador` \| `manager` \| `marketer` \| `asesor`. Default: `asesor` |
     | `status` | string | No | `active` \| `inactive` \| `suspended`. Default: `active` |
   - Ejemplo cURL (basado en imagen 214).
   - Errores: `TENANT_NOT_FOUND` (404), `EMAIL_IN_OTHER_TENANT` (409), `MAX_SEATS_REACHED` (403).

   **4.3 `update_billing` — Facturación y créditos**
   - Descripción: actualiza estado de suscripción, plan o saldo total de créditos. Sincroniza `wallets` y registra movimiento en `wallet_ledger`.
   - Reglas: debe enviarse al menos uno de `billing_state`, `plan` o `message_credits`.
   - Tabla de campos:
     | Campo | Tipo | Obligatorio | Validación |
     |---|---|---|---|
     | `tenant_external_id` | string | Sí | — |
     | `partner_id` | string | Sí | `mls_latam` |
     | `billing_state` | string | Condicional | `ONBOARDING_PAID` \| `ACTIVE_WITH_CREDITS` \| `CREDITS_EXHAUSTED` \| `SUBSCRIPTION_REQUIRED` \| `SUBSCRIBED_ACTIVE` \| `SUSPENDED` |
     | `plan` | string | Condicional | Mismas reglas que en `upsert_tenant` |
     | `message_credits` | integer | Condicional | Entero ≥ 0 (saldo TOTAL, no incremento) |
     | `external_id` | string | No | ID del movimiento en Core (para reconciliación) |
     | `description` | string | No | Descripción del movimiento en el ledger |
     | `reason` | string | No | Motivo (auditoría) |
   - Ejemplo cURL (basado en imagen 215). Nota explícita de que `message_credits` SUSTITUYE el saldo, no lo incrementa.

   **4.4 `sync_property` — Inventario inmobiliario**
   - Descripción: crea/actualiza una propiedad por `(tenant_id, property_code)`. Multimedia y FAQs gestionadas por Core: al enviarlas se reemplazan SOLO las entradas con `source='core'`; las creadas manualmente en la plataforma se conservan.
   - Tabla de campos raíz:
     | Campo | Tipo | Obligatorio | Validación |
     |---|---|---|---|
     | `tenant_external_id` | string | Sí | — |
     | `property_code` | string | Sí | Único dentro del tenant |
     | `partner_id` | string | Sí | `mls_latam` |
     | `title` | string | No (sí en INSERT) | Default: `property_code` |
     | `zone` | string | No (sí en INSERT) | Default: `""` |
     | `address` | string\|null | No | — |
     | `operation_type` | string | No | `sale` \| `rent`. Default: `sale` |
     | `property_type` | string | No | Texto libre (`Apartamento`, `Departamento`, etc.) |
     | `price` | number | No | Default: 0 |
     | `currency` | string | No | Default: `MXN` |
     | `status` | string | No | `available` \| `reserved` \| `sold` \| `rented` \| `inactive` |
     | `is_active` | boolean | No | Default: `true` |
     | `ai_description_template` | string\|null | No | — |
     | `youtube_url` | string\|null | No | Puede ir en raíz o en `metadata` |
     | `images` | string[] | No | URLs; primera = portada |
     | `documents` | object[] | No | `{url, name?, type?}` |
     | `faqs` | object[] | No | `{question, answer}` |
   - Tabla de campos `metadata` (técnicos): `bedrooms` (int), `bathrooms` (number), `parking_spots` (int), `sq_meters` (number), `maintenance_fee` (number), `accepted_credits` (string[]), `visit_availability` (string), `youtube_url`, `images`, `documents`, `faqs` (alternativos a la raíz).
   - Nota: multimedia/FAQs a nivel raíz tienen prioridad sobre los de `metadata`.
   - Ejemplo cURL (basado en imagen 216).

6. **5. Acceso transparente vía SSO (JWT HS256)**
   - URL destino: `https://app.mlslatam.com/auth/sso?token=<JWT>`
   - Algoritmo: `HS256` con secreto compartido `SSO_SECRET`.
   - Payload requerido: `email`, `name`, `tenant_external_id`, `partner_id` (`mls_latam`), `tenant_role`, `exp` (Unix seconds).
   - Comportamiento: usuarios SSO acceden directo al Dashboard sin pasar por `/auth/complete-signup`.
   - Ejemplo de generación de JWT en Node.js.

7. **6. Gestión de errores**
   - Tabla EXHAUSTIVA basada en el código real:
     | HTTP | code/error | Causa | Acción del Core |
     |---|---|---|---|
     | 400 | `Invalid JSON body` | Body no parseable | Validar JSON |
     | 400 | `Missing action` | Falta `action` | Incluir campo |
     | 400 | `Unknown action: X` | Acción no soportada | Revisar nombre |
     | 400 | `partner_id_required` | Falta `partner_id` | Incluir en payload |
     | 400 | `partner_id_invalid` | Partner inexistente o inactivo | Revisar valor |
     | 400 | Validación de campos | Tipos/longitudes/regex | Ver `error` en respuesta |
     | 401 | `Unauthorized` | `x-api-key` faltante o inválido | Revisar credencial |
     | 403 | `partner_mismatch` | API key de otro partner | Usar key correcta |
     | 403 | `MAX_SEATS_REACHED` | Asientos del tenant agotados | Aumentar `max_users` |
     | 404 | `TENANT_NOT_FOUND` | `tenant_external_id` no existe | Crear tenant primero |
     | 405 | `Method not allowed` | Método ≠ POST | Usar POST |
     | 409 | `EMAIL_IN_OTHER_TENANT` | Email ya pertenece a otro tenant | Usar otro email |
     | 500 | `Database error` / `Internal server error` | Error interno | Reintentar / notificar |
   - Recomendaciones: idempotencia (todas las acciones son upsert seguros), reintentos con backoff exponencial en 5xx, NO reintentar en 4xx.

8. **7. Apéndice — Checklist de integración**
   - Lista numerada (sin colores): credenciales obtenidas, dominio app.mlslatam.com configurado, primer `upsert_tenant` exitoso, owner provisionado, primer `sync_user` correcto, recarga inicial de créditos vía `update_billing`, sincronización de propiedades, prueba de SSO, manejo de errores 4xx/5xx implementado.

## Pasos de ejecución (modo default)

1. Crear script Python `/tmp/gen_manual.py` usando `docx-js` no — usaremos **`python-docx`** (más simple para B/N puro y disponible en sandbox).
2. Definir estilos: Arial 11pt cuerpo, Arial Bold para títulos. Niveles de heading 1/2/3. Tablas con borde negro 1pt y cabecera con sombreado `F2F2F2`.
3. Generar todas las secciones según la estructura de arriba; usar bloques de código monoespaciados (Courier New 9pt) con borde sutil, sin coloreado de sintaxis.
4. Guardar en `/mnt/documents/MLS_Latam_Manual_Integracion_Tecnica.docx` (versión nueva, sin sobrescribir el PDF anterior).
5. **QA**: convertir el `.docx` a PDF con LibreOffice (`run_libreoffice.py`) y luego a imágenes (`pdftoppm`) para inspeccionar visualmente cada página: verificar tablas no se desborden, código no se corte, todo realmente sea blanco/negro/gris claro, jerarquía clara.
6. Emitir tag `<lov-artifact path="MLS_Latam_Manual_Integracion_Tecnica.docx" mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"></lov-artifact>`.

## Archivos modificados

- **Generado**: `/mnt/documents/MLS_Latam_Manual_Integracion_Tecnica.docx` (~10–12 páginas).
- **No se tocan archivos del proyecto** (es una tarea de generación de artefacto, no cambio de código).

## Resultado esperado

Un documento Word editable, completamente en blanco y negro, técnicamente exacto al código del endpoint, con: cabecera correcta (`x-api-key`), envoltorio `data: {}` en todos los ejemplos, todos los campos obligatorios y opcionales con validaciones reales, catálogo completo de errores HTTP/códigos, y los 4 ejemplos cURL alineados con las capturas que el usuario compartió.
