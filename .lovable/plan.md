## Objetivo

Actualizar la contraseña del Super Admin existente `roberto@responde.mx` al nuevo valor `P4dr1n0s`, sin tocar el resto del usuario ni sus permisos.

## Estado actual confirmado

Consulté la base de datos y el usuario existe:
- **Email**: `roberto@responde.mx`
- **Nombre**: Roberto (Super Admin)
- **ID**: `b42a5fe1-6f05-4385-bf74-76fce7454324`
- **Rol global**: `super_admin` ✅

No hay que crear nada nuevo, solo cambiar el password.

## Plan de ejecución

1. **Actualizar la edge function `seed-super-admin`**  
   Cambiar el password hardcodeado de `C0c02024` → `P4dr1n0s` en `supabase/functions/seed-super-admin/index.ts` (líneas 36 y 59). La función ya tiene la lógica de "si el usuario existe, actualiza el password", así que es el único cambio necesario.

2. **Invocar la edge function una vez**  
   Ejecutar la función vía `curl` para que aplique el cambio de password al usuario existente. Esto usa `supabaseAdmin.auth.admin.updateUserById()` con el service role key, que es la forma segura de cambiar contraseñas server-side sin necesidad de saber la contraseña anterior.

3. **Verificar el cambio**  
   Confirmar en logs que la respuesta sea `{ success: true, message: "Super admin password updated" }`.

## Consideraciones de seguridad

⚠️ **Importante**: Tener el password hardcodeado en una edge function pública del repo no es ideal a largo plazo. Una vez aplicado el cambio, te recomiendo:
- Cambiar el password manualmente desde la app (ir a Settings → Seguridad e introducir uno nuevo).
- O bien, mover el password a un secreto (`SUPER_ADMIN_SEED_PASSWORD`) para no dejarlo visible en el código.

Pero para este pedido puntual, el camino más rápido es el descrito arriba.

## Archivos afectados

- `supabase/functions/seed-super-admin/index.ts` (1 archivo, 2 líneas)

## Resultado esperado

Podrás iniciar sesión en `/auth` con:
- **Email**: `roberto@responde.mx`
- **Password**: `P4dr1n0s`

Y serás redirigido automáticamente a `/admin` (panel de Super Admin).
