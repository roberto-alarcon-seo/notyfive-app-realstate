ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS non_sso_redirect_url text,
  ADD COLUMN IF NOT EXISTS logout_redirect_url text;