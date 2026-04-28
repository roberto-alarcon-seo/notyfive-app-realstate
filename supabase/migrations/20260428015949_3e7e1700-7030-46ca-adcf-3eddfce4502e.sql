
CREATE TABLE public.partner_sso_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  partner_id text,
  tenant_external_id text,
  tenant_id uuid,
  success boolean NOT NULL DEFAULT false,
  error_reason text,
  ip text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_sso_logs_created_at ON public.partner_sso_logs (created_at DESC);
CREATE INDEX idx_partner_sso_logs_email ON public.partner_sso_logs (email);
CREATE INDEX idx_partner_sso_logs_partner ON public.partner_sso_logs (partner_id);

ALTER TABLE public.partner_sso_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view partner SSO logs"
ON public.partner_sso_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
