
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS provisioned_via text;

-- Backfill: any profile whose auth user has user_metadata.sso_user = true
UPDATE public.profiles p
SET provisioned_via = 'sso'
FROM auth.users u
WHERE u.id = p.id
  AND p.provisioned_via IS NULL
  AND (
    (u.raw_user_meta_data ->> 'sso_user')::boolean IS TRUE
    OR (u.raw_user_meta_data ->> 'provisioned_via') = 'sso'
  );
