-- Table to store AI pipeline stage suggestions
CREATE TABLE public.pipeline_stage_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL,
  suggested_stage TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0,
  reasoning TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, dismissed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.pipeline_stage_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant users can view suggestions"
ON public.pipeline_stage_suggestions
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can update suggestions"
ON public.pipeline_stage_suggestions
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Service can insert suggestions"
ON public.pipeline_stage_suggestions
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Super admins full access"
ON public.pipeline_stage_suggestions
FOR ALL TO authenticated
USING (is_super_admin(auth.uid()));

-- Index for quick lookup of pending suggestions per conversation
CREATE INDEX idx_pipeline_suggestions_pending 
ON public.pipeline_stage_suggestions(conversation_id, status) 
WHERE status = 'pending';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stage_suggestions;