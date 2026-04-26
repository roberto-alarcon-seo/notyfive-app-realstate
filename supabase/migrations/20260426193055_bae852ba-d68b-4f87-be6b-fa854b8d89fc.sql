-- Add a flexible JSONB column to store the partner's full design tokens.
-- Existing single-color columns (primary_color_hex/hsl) are preserved for backwards compatibility.
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.partners.branding IS
  'Design tokens for the partner theme. Keys: app_bg, sidebar_bg, sidebar_text, sidebar_style (solid|gradient|contrast), card_bg, primary_color, theme_preset.';