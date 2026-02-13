
-- Add new real-estate specific values to kb_category enum
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'properties';
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'financing';
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'visits';
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'legal';
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'location';
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'construction';
ALTER TYPE public.kb_category ADD VALUE IF NOT EXISTS 'post_sale';
