-- ============================================================
-- WHITE LABEL MULTIMARCA: Tabla partners + vínculos
-- ============================================================

-- PASO 1: Agregar partner_scope a user_roles ANTES de crear políticas que lo referencien
ALTER TABLE public.user_roles
  ADD COLUMN partner_scope text;

COMMENT ON COLUMN public.user_roles.partner_scope IS
  'Scope opcional para super_admin. NULL = super admin global (ve todos los partners). Valor = restringido a tenants de ese partner.';

CREATE INDEX idx_user_roles_partner_scope ON public.user_roles(partner_scope) WHERE partner_scope IS NOT NULL;

-- PASO 2: Helper SQL para leer scope (usado en policies)
CREATE OR REPLACE FUNCTION public.get_user_partner_scope(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_scope FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- PASO 3: Tabla partners
CREATE TABLE public.partners (
  id text PRIMARY KEY,
  name text NOT NULL,
  primary_domain text NOT NULL UNIQUE,
  alt_domains text[] NOT NULL DEFAULT '{}',
  country_code text NOT NULL DEFAULT 'MX',
  logo_url text NOT NULL,
  logo_mark_url text,
  primary_color_hex text NOT NULL,
  primary_color_hsl text NOT NULL,
  accent_color_hex text,
  email_sender_name text NOT NULL,
  email_sender_address text NOT NULL,
  email_branding_logo text,
  email_footer_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partners_primary_domain ON public.partners(primary_domain);
CREATE INDEX idx_partners_is_active ON public.partners(is_active);

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- PASO 4: Seed inicial (antes de crear FK desde tenants)
INSERT INTO public.partners (
  id, name, primary_domain, alt_domains, country_code,
  logo_url, primary_color_hex, primary_color_hsl,
  email_sender_name, email_sender_address, email_footer_text
) VALUES
  ('brokia', 'Brokia24', 'app.brokia24.com',
   ARRAY['linkasa.brokia24.com', 'notyfive-app-realstate.lovable.app', 'id-preview--d1cabd58-4d71-4307-9859-d54faa575f1e.lovable.app'],
   'MX', 'https://notyfive-app-realstate.lovable.app/lovable-uploads/brokia-logo.png',
   '#942CCC', '279 65% 49%', 'Brokia24', 'no-reply@notifications.brokia24.com',
   '© Brokia24. Todos los derechos reservados.'),
  ('mls_latam', 'MLS Latam', 'app.mlslatam.com', '{}',
   'CO', 'https://notyfive-app-realstate.lovable.app/lovable-uploads/6d226a31-0e10-48e0-a7d1-e6301384077d.png',
   '#00A884', '162 100% 33%', 'MLS Latam', 'no-reply@notifications.mlslatam.com',
   '© MLS Latam. Todos los derechos reservados.'),
  ('responde', 'Responde', 'app.responde.mx', '{}',
   'MX', 'https://notyfive-app-realstate.lovable.app/lovable-uploads/270634a4-1594-477d-817e-976a47e63473.png',
   '#7C3AED', '262 83% 58%', 'Responde', 'no-reply@notifications.responde.mx',
   '© Responde. Todos los derechos reservados.');

-- PASO 5: RLS sobre partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active partners"
  ON public.partners FOR SELECT
  USING (is_active = true);

CREATE POLICY "Global super admins can read all partners"
  ON public.partners FOR SELECT
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL);

CREATE POLICY "Global super admins can insert partners"
  ON public.partners FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL);

CREATE POLICY "Global super admins can update partners"
  ON public.partners FOR UPDATE
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL);

CREATE POLICY "Global super admins can delete partners"
  ON public.partners FOR DELETE
  USING (is_super_admin(auth.uid()) AND get_user_partner_scope(auth.uid()) IS NULL);

-- PASO 6: FK de user_roles.partner_scope -> partners.id (despues del seed)
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_partner_scope_fkey
  FOREIGN KEY (partner_scope) REFERENCES public.partners(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- PASO 7: Vincular tenants a partner
ALTER TABLE public.tenants
  ADD COLUMN partner_id text NOT NULL DEFAULT 'brokia'
  REFERENCES public.partners(id) ON UPDATE CASCADE;

CREATE INDEX idx_tenants_partner_id ON public.tenants(partner_id);

-- PASO 8: Helper para resolver partner desde un tenant
CREATE OR REPLACE FUNCTION public.get_tenant_partner_id(_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.tenants WHERE id = _tenant_id LIMIT 1;
$$;