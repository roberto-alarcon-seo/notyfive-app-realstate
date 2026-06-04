# Plan: Toggle de tema dark/light/partner por usuario

## Objetivo

Permitir que cada usuario elija entre tres modos de tema (Claro, Partner, Oscuro) desde el menú contextual, persistido en `profiles.theme_preference`. El tema del usuario y el branding del partner deben coexistir sin que los inline styles del partner pisen las superficies del tema elegido.

## Cambios

### 1. Migración DB

Nueva migración que agrega `theme_preference text` a `public.profiles` con CHECK `('dark','light','partner')` default `'dark'`, más `GRANT SELECT, UPDATE (theme_preference) ON public.profiles TO authenticated`. Sin tocar RLS existente.

### 2. `src/lib/partnerTheme.ts` — separar marca vs superficie

Agregar segundo parámetro `options?: { userTheme?: "dark" | "light" }` a `applyPartnerTheme()`. Reorganizar (sin cambiar lógica de cálculo):

- **Siempre** se aplican: `--primary`, `--ring`, `--message-outgoing`, `--gradient-primary`, `--shadow-elegant`, `--shadow-glow`, y todos los `--sidebar-*` (background, foreground, primary, accent, border, ring, gradient).
- **Solo si `!options.userTheme`** (modo partner): `--background`, `--card`, `--popover`, `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--border`, `--input`, `--message-incoming`.

Cuando `userTheme` está presente, esos tokens los provee la clase `.dark`/`.light` de `index.css`. `setLiveTheme` y la firma pública existente se conservan.

### 3. `src/contexts/ThemeContext.tsx` (nuevo)

`ThemeProvider` + `useTheme()` expone `{ theme, setTheme, isLoading }` con `Theme = "dark"|"light"|"partner"`.

- Estado inicial síncrono: `localStorage.getItem('brokia-theme')` o `'dark'`.
- En mount, si hay `user.id` (consume `useAuth()`), hace `select theme_preference from profiles` y reconcilia. `isLoading=true` hasta resolver.
- `applyTheme(theme)` interno:
  - Quita `dark light blue` de `<html>` y `<body>`.
  - `"dark"` → agrega `dark`; llama `applyPartnerTheme(partner.theme, { userTheme: 'dark' })`.
  - `"light"` → agrega `light`; llama `applyPartnerTheme(partner.theme, { userTheme: 'light' })`.
  - `"partner"` → agrega `dark` o `light` según `partner.theme.mode`; llama `applyPartnerTheme(partner.theme)` sin opciones.
- Re-aplica cuando cambia `partner.theme` (para que el branding hidratado de DB respete el modo del usuario).
- `setTheme(next)`: aplica, escribe `localStorage`, y si hay user persiste `update profiles set theme_preference=next where id=user.id`.

### 4. `src/main.tsx`

Mantener el pre-render anti-flash; normalizar `"partner"` → `"dark"` para la clase inicial (el provider lo refina post-render):

```ts
const saved = localStorage.getItem('brokia-theme') ?? 'dark'
const cls = saved === 'partner' ? 'dark' : saved
document.documentElement.classList.add(cls)
document.body.classList.add(cls)
```

### 5. Orden de providers (`src/App.tsx`)

`PartnerBrandingProvider` → `AuthProvider` (mantener actual) → `ThemeProvider` dentro del árbol donde ya están disponibles ambos. `ThemeProvider` debe poder leer `useAuth()` y `usePartnerBranding()`, así que se monta debajo de ambos.

### 6. `src/components/layout/MobileLayout.tsx`

Eliminar el `useState` local `currentTheme`, la lectura/escritura directa de `localStorage` y la mutación de `classList`. Usar `const { theme, setTheme } = useTheme()`. El botón sol/luna alterna entre `'dark'` y `'light'` (el modo `'partner'` queda solo en el menú desktop por ahora).

### 7. `src/components/layout/UserMenu.tsx`

Insertar el toggle entre el badge de rol y el ítem "Configuración", con separadores arriba/abajo.

- Segmented control de 3 botones tipo pill: `[Sun Claro] [Palette Partner] [Moon Oscuro]`.
- Activo: `bg-primary/20 text-primary`. Inactivo: ghost/muted.
- Lee `usePartnerBranding()`; oculta el botón "Partner" si `!partner.theme` o branding vacío (sólo Claro/Oscuro).
- `onClick` → `setTheme(...)`. El menú **no** se cierra (`onSelect={e => e.preventDefault()}` o equivalente fuera del `DropdownMenuItem`).
- Spinner pequeño junto al label "Modo" mientras `isLoading`.

## Notas técnicas

- Compat: clave `localStorage` sigue siendo `"brokia-theme"`. Usuarios existentes mantienen su preferencia.
- Anónimos (Auth, ResetPassword): el provider no consulta DB, solo localStorage.
- El sidebar dark permanente sigue gobernado por los tokens `--sidebar-*` del partner — no cambia.
- `setLiveTheme()` se conserva intacto (lo usa la pestaña Apariencia del partner para preview).
- No se modifica RLS ni el sistema de branding del super admin.

## Verificación

1. **Oscuro + partner con branding**: `<html class="dark">`, marca del partner visible (botones, sidebar), superficies del `.dark` de `index.css` sin pisar.
2. **Claro + partner con branding**: `<html class="light">`, marca del partner intacta, superficies light legibles.
3. **Partner**: clase según `mode` del branding, todos los tokens inline aplicados (idéntico al comportamiento actual).
4. Cambio en menú sin cerrar dropdown, persistido en DB y reflejado tras logout/login en otro dispositivo.
