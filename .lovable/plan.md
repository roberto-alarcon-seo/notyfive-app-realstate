## Promover a Super Admin

**Usuario detectado:**
- Email: `roberto@brokia24.com`
- ID: `06895576-fc27-4728-89e9-06788a760577`
- Estado actual: `global_role = user`, sin tenant, sin partner_scope

**Acción a ejecutar:**

Actualizar el registro en `public.user_roles` para asignar:
- `global_role = 'super_admin'`
- `tenant_role = NULL`
- `partner_scope = NULL` (Super Admin global, acceso completo a todos los partners y tenants)

**SQL:**
```sql
UPDATE public.user_roles
SET global_role = 'super_admin',
    tenant_role = NULL,
    partner_scope = NULL,
    updated_at = now()
WHERE user_id = '06895576-fc27-4728-89e9-06788a760577';

INSERT INTO public.security_events (user_id, event_type, metadata)
VALUES (
  '06895576-fc27-4728-89e9-06788a760577',
  'super_admin_created',
  jsonb_build_object('email','roberto@brokia24.com','method','manual_promotion')
);
```

**Resultado esperado:**
Roberto podrá iniciar sesión y acceder al panel `/admin` con permisos completos de Super Admin sobre todos los tenants y partners.

**Nota:** Si Roberto no recuerda su contraseña, puede usar "Olvidé mi contraseña" desde la pantalla de login para restablecerla.
