
ALTER TABLE public.tenant_ai_settings
  ADD COLUMN IF NOT EXISTS region_code text NOT NULL DEFAULT 'MX',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS formality text NOT NULL DEFAULT 'tu',
  ADD COLUMN IF NOT EXISTS max_message_length integer NOT NULL DEFAULT 320,
  ADD COLUMN IF NOT EXISTS max_ai_turns_before_handoff integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{"enabled": false, "timezone": "America/Mexico_City", "days": {"mon": {"open": "09:00", "close": "19:00"}, "tue": {"open": "09:00", "close": "19:00"}, "wed": {"open": "09:00", "close": "19:00"}, "thu": {"open": "09:00", "close": "19:00"}, "fri": {"open": "09:00", "close": "19:00"}, "sat": {"open": "10:00", "close": "14:00"}, "sun": null}}'::jsonb,
  ADD COLUMN IF NOT EXISTS out_of_hours_message text DEFAULT 'Gracias por escribirnos. Nuestro horario de atención es de lunes a viernes de 9am a 7pm. Te responderemos en cuanto abramos.',
  ADD COLUMN IF NOT EXISTS handoff_triggers jsonb NOT NULL DEFAULT '{"on_price_negotiation": true, "on_legal_question": true, "on_schedule_visit": false, "on_after_hours": true, "on_max_turns": true}'::jsonb;

ALTER TABLE public.tenant_ai_settings
  ADD CONSTRAINT tenant_ai_settings_max_message_length_check CHECK (max_message_length BETWEEN 80 AND 1500),
  ADD CONSTRAINT tenant_ai_settings_max_ai_turns_check CHECK (max_ai_turns_before_handoff BETWEEN 1 AND 50),
  ADD CONSTRAINT tenant_ai_settings_language_check CHECK (language IN ('es','en','pt')),
  ADD CONSTRAINT tenant_ai_settings_formality_check CHECK (formality IN ('tu','usted','vos'));

CREATE TABLE IF NOT EXISTS public.ai_prompt_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  region_code text NOT NULL,
  language text NOT NULL DEFAULT 'es',
  name text NOT NULL,
  description text,
  prompt text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_presets_region ON public.ai_prompt_presets(region_code);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_presets_tenant ON public.ai_prompt_presets(tenant_id);

ALTER TABLE public.ai_prompt_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read global presets"
  ON public.ai_prompt_presets FOR SELECT
  TO authenticated
  USING (is_global = true OR tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage presets"
  ON public.ai_prompt_presets FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_ai_prompt_presets_updated_at
  BEFORE UPDATE ON public.ai_prompt_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
