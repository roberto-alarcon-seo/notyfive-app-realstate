
-- ============================================
-- FASE 1: Asignación inteligente de leads
-- ============================================

-- 1. assignment_rules (1 por tenant)
CREATE TABLE IF NOT EXISTS public.assignment_rules (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  round_robin_enabled boolean NOT NULL DEFAULT true,
  sticky_agent_enabled boolean NOT NULL DEFAULT true,
  sticky_overrides_property boolean NOT NULL DEFAULT false,
  lead_timeout_minutes integer NOT NULL DEFAULT 30 CHECK (lead_timeout_minutes >= 1 AND lead_timeout_minutes <= 1440),
  timeout_action text NOT NULL DEFAULT 'notify' CHECK (timeout_action IN ('notify','reassign','notify_and_reassign')),
  max_active_leads_per_agent integer NULL CHECK (max_active_leads_per_agent IS NULL OR max_active_leads_per_agent > 0),
  last_assigned_agent_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view assignment rules"
  ON public.assignment_rules FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can insert assignment rules"
  ON public.assignment_rules FOR INSERT
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_admin(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can update assignment rules"
  ON public.assignment_rules FOR UPDATE
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_admin(auth.uid()))
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_admin(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Super admin can delete assignment rules"
  ON public.assignment_rules FOR DELETE
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_assignment_rules_updated_at
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER prevent_assignment_rules_tenant_change
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();

-- 2. assignment_logs (append-only audit)
CREATE TABLE IF NOT EXISTS public.assignment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  previous_agent_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_agent_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  strategy text NOT NULL CHECK (strategy IN ('sticky','property','round_robin','manual','timeout_reassign','fallback','none')),
  reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_logs_tenant_created ON public.assignment_logs(tenant_id, created_at DESC);
CREATE INDEX idx_assignment_logs_conversation ON public.assignment_logs(conversation_id);
CREATE INDEX idx_assignment_logs_contact ON public.assignment_logs(contact_id);

ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view assignment logs"
  ON public.assignment_logs FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.is_tenant_manager_or_admin(auth.uid()))
  );

-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER functions can write.

-- 3. conversations: nuevas columnas
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_assigned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS risk_flagged_at timestamptz NULL;

-- 4. profiles: flag operativo de disponibilidad para round robin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active_for_assignment boolean NOT NULL DEFAULT true;

-- 5. Backfill: crear assignment_rules por defecto para tenants existentes
INSERT INTO public.assignment_rules (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 6. Trigger para auto-crear assignment_rules en nuevos tenants
CREATE OR REPLACE FUNCTION public.create_assignment_rules_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assignment_rules (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_assignment_rules_on_tenant_insert ON public.tenants;
CREATE TRIGGER create_assignment_rules_on_tenant_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_assignment_rules_for_tenant();
