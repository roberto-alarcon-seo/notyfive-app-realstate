ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text
  DEFAULT 'dark';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_theme_preference_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_preference_check
      CHECK (theme_preference IN ('dark','light','partner'));
  END IF;
END $$;

GRANT SELECT, UPDATE (theme_preference) ON public.profiles TO authenticated;