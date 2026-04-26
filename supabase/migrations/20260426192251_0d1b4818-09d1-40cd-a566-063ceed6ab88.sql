
-- 1. Add Resend columns to partners
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS resend_api_key text,
  ADD COLUMN IF NOT EXISTS resend_from_email text;

-- 2. Allow partner-scoped super admins to UPDATE their own partner row
DROP POLICY IF EXISTS "Partner-scoped admins can update their own partner" ON public.partners;
CREATE POLICY "Partner-scoped admins can update their own partner"
ON public.partners
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) = id
)
WITH CHECK (
  is_super_admin(auth.uid())
  AND get_user_partner_scope(auth.uid()) = id
);

-- 3. Allow partner-scoped admins to read their own (and active) partners — already covered
--    by "Anyone can read active partners", so nothing extra needed.

-- 4. Storage bucket for partner logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for partner-logos bucket
DROP POLICY IF EXISTS "Public read partner logos" ON storage.objects;
CREATE POLICY "Public read partner logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'partner-logos');

DROP POLICY IF EXISTS "Super admins can upload partner logos" ON storage.objects;
CREATE POLICY "Super admins can upload partner logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-logos'
  AND is_super_admin(auth.uid())
  AND (
    get_user_partner_scope(auth.uid()) IS NULL
    OR get_user_partner_scope(auth.uid()) = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Super admins can update partner logos" ON storage.objects;
CREATE POLICY "Super admins can update partner logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'partner-logos'
  AND is_super_admin(auth.uid())
  AND (
    get_user_partner_scope(auth.uid()) IS NULL
    OR get_user_partner_scope(auth.uid()) = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Super admins can delete partner logos" ON storage.objects;
CREATE POLICY "Super admins can delete partner logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'partner-logos'
  AND is_super_admin(auth.uid())
  AND (
    get_user_partner_scope(auth.uid()) IS NULL
    OR get_user_partner_scope(auth.uid()) = (storage.foldername(name))[1]
  )
);
