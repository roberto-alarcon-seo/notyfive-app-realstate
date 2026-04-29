-- Performance indexes for high-volume tenant-scoped tables
-- Using IF NOT EXISTS to keep this migration idempotent.

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id
  ON public.contacts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created_at
  ON public.contacts (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id
  ON public.messages (tenant_id);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_created_at
  ON public.messages (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id
  ON public.conversations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_updated_at
  ON public.conversations (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_events_tenant_id
  ON public.automation_events (tenant_id);

CREATE INDEX IF NOT EXISTS idx_automation_events_tenant_created_at
  ON public.automation_events (tenant_id, created_at DESC);
