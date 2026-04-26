
-- Add 'source' column to property multimedia/FAQ tables to distinguish
-- entries synchronized from the external Core ('core') vs entries created
-- manually inside the CRM ('manual'). This enables read-only gating in the UI
-- without removing the user's ability to add complementary local content.

ALTER TABLE public.property_images
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.property_documents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.property_faq
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_property_images_source
  ON public.property_images(property_id, source);

CREATE INDEX IF NOT EXISTS idx_property_documents_source
  ON public.property_documents(property_id, source);

CREATE INDEX IF NOT EXISTS idx_property_faq_source
  ON public.property_faq(property_id, source);
