
-- Create contact_notes table
CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  note_type text NOT NULL DEFAULT 'manual',
  source_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contact_notes_contact_id ON public.contact_notes(contact_id);
CREATE INDEX idx_contact_notes_tenant_id ON public.contact_notes(tenant_id);
CREATE INDEX idx_contact_notes_pinned ON public.contact_notes(contact_id, is_pinned) WHERE is_pinned = true;

-- Enable RLS
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view notes in their tenant"
ON public.contact_notes FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert notes in their tenant"
ON public.contact_notes FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can update notes in their tenant"
ON public.contact_notes FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete own notes"
ON public.contact_notes FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_tenant_manager_or_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_notes;
