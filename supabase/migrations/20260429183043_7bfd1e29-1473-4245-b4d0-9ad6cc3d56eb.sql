-- 1) master_templates: global catalog of system-provided templates
CREATE TABLE public.master_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  category TEXT NOT NULL DEFAULT 'utility',
  header_type TEXT DEFAULT 'none',
  header_text TEXT,
  body TEXT NOT NULL,
  footer TEXT,
  buttons JSONB DEFAULT '[]'::jsonb,
  variables TEXT[] DEFAULT '{}'::text[],
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.master_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_templates readable by authenticated"
  ON public.master_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "master_templates manageable by super admins"
  ON public.master_templates FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_master_templates_updated_at
  BEFORE UPDATE ON public.master_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Add is_system flag to tenant templates
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_templates_tenant_system
  ON public.templates (tenant_id, is_system) WHERE is_system = true;

-- 3) Seed 3 initial real estate templates
INSERT INTO public.master_templates (name, display_name, category, body, variables, description, sort_order) VALUES
  (
    'system_bienvenida_lead',
    'Bienvenida Lead',
    'utility',
    'Hola {{nombre}}, gracias por interesarte en {{propiedad}}. ¿Te gustaría agendar una visita?',
    ARRAY['nombre','propiedad'],
    'Mensaje inicial enviado al recibir un nuevo lead interesado en una propiedad.',
    10
  ),
  (
    'system_seguimiento',
    'Seguimiento',
    'marketing',
    'Hola {{nombre}}, soy {{agente}} de {{empresa}}. Te contacto para saber si sigues interesado en las opciones que vimos.',
    ARRAY['nombre','agente','empresa'],
    'Reactivación de un lead que vio opciones pero no respondió.',
    20
  ),
  (
    'system_confirmacion_cita',
    'Confirmación de Cita',
    'utility',
    'Cita confirmada: Te esperamos el {{fecha}} a las {{hora}} en {{direccion}}. ¡Nos vemos!',
    ARRAY['fecha','hora','direccion'],
    'Confirmación enviada después de agendar una visita.',
    30
  );

-- 4) Trigger on tenant_integrations: when status becomes 'connected', invoke seed function asynchronously via pg_net
CREATE OR REPLACE FUNCTION public.invoke_seed_tenant_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Fire only when status transitions TO 'connected'
  IF NEW.status::text = 'connected'
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM 'connected') THEN

    BEGIN
      v_url := current_setting('app.settings.supabase_url', true);
      v_service_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_url := NULL;
    END;

    -- Fallback to hardcoded project URL if GUCs not present
    IF v_url IS NULL OR v_url = '' THEN
      v_url := 'https://ozsgtszxvojvqszpphmj.supabase.co';
    END IF;

    -- Fire-and-forget HTTP call via pg_net (best-effort; do NOT block integration update on failure)
    BEGIN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/seed-tenant-templates',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-trigger', 'tenant_integrations_connected'
        ),
        body := jsonb_build_object('tenant_id', NEW.tenant_id)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Swallow errors so the integration update is never rolled back
      RAISE WARNING 'seed-tenant-templates trigger failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tenant_templates ON public.tenant_integrations;
CREATE TRIGGER trg_seed_tenant_templates
  AFTER INSERT OR UPDATE OF status ON public.tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_seed_tenant_templates();