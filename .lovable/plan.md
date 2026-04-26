## Objetivo
Remover la capa completa de Web Push / VAPID para simplificar el setup. Tras esta acción, el sistema arrancará sin necesidad de configurar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ni `VAPID_SUBJECT`.

> ⚠️ Se mantiene el resto del PWA (manifest + service worker para caché/instalación) **opcionalmente**, pero por simplicidad recomiendo **eliminar también el Service Worker** ya que su único uso real era recibir push + manejar badges. La instalación "Add to Home Screen" sigue funcionando solo con `manifest.json`.

---

## 1. Frontend — Hooks y Componentes

### Eliminar archivos
- `src/hooks/usePushNotifications.ts`
- `src/components/pwa/PushNotificationPrompt.tsx`
- `src/lib/registerSW.ts`
- `public/sw.js` (Service Worker — ya no se necesita sin push)

### Editar archivos
- **`src/main.tsx`**: eliminar `import { registerServiceWorker }` y la llamada `registerServiceWorker()`. Añadir un pequeño guard que des-registre cualquier SW previamente instalado en navegadores de usuarios existentes (evita caché fantasma).
- **`src/pages/Dashboard.tsx`**: eliminar `import { PushNotificationPrompt }` y el render `<PushNotificationPrompt />` (línea 44).
- **`src/pages/Inbox.tsx`**: eliminar `import { usePushNotifications }` y el `useEffect` que llama `clearBadge()`.

### Mantener
- `public/manifest.json` y los iconos `pwa-icon-*.png` → permiten instalación PWA básica (Add to Home Screen) sin requerir VAPID.
- `src/hooks/usePWAUpdate.ts` y `src/components/pwa/PWAUpdateBanner.tsx` → **se eliminan también**, ya que dependían del Service Worker.

> Si prefieres conservar `usePWAUpdate` / `PWAUpdateBanner` para futuro, indícamelo; sin SW dejarían de funcionar y conviene quitarlos.

---

## 2. Backend — Edge Functions

### Eliminar
- `supabase/functions/send-push-notification/index.ts`
- `supabase/functions/push-vapid-key/index.ts`

Ambas serán removidas también del deployment vía `supabase--delete_edge_functions`.

### Editar
- **`supabase/functions/twilio-inbound-webhook/index.ts`** (líneas 397-417): eliminar el bloque `SEND PUSH NOTIFICATION (fire-and-forget)` que llama a `send-push-notification`. El resto del webhook (lead scoring, AI reply, ledger, etc.) queda intacto.

---

## 3. Base de Datos

Eliminar la tabla `push_subscriptions` mediante migración:
```sql
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
```
Esto remueve la tabla, sus políticas RLS y cualquier índice asociado. Los tipos generados en `src/integrations/supabase/types.ts` se regenerarán automáticamente.

---

## 4. Secrets

Los secretos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` quedarán huérfanos pero **no necesitan eliminarse** (son ignorados si nada los lee). Si quieres limpiarlos, lo hacemos vía `delete_secret` después de la migración.

---

## 5. Memoria del Proyecto

Actualizar memorias para reflejar que la PWA ya no incluye push notifications:
- `mem://infrastructure/pwa-push-notifications` → marcar como **deprecated/eliminado**
- `mem://infrastructure/pwa-lifecycle-updates` → eliminar (dependía del SW)
- `mem://index.md` → quitar referencias a PWA Notifications y PWA Lifecycle, actualizar Core con: "Sin push notifications. Setup mínimo: Supabase URL/keys + SSO_SECRET."

---

## Resultado esperado
- Setup mínimo para arrancar la app: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SSO_SECRET` (+ `EXTERNAL_CORE_API_KEY`, `RESEND_*`, `APP_BASE_URL` para integraciones funcionales).
- Sin Service Worker activo en el navegador (se des-registra el existente al cargar).
- Sin alertas push, sin banner de "Activar notificaciones", sin tabla `push_subscriptions`.
- El audio in-app de nuevos mensajes (`useNewLeadSound`) sigue funcionando — eso es independiente de Web Push.

¿Procedo con la implementación?