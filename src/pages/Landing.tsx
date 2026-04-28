import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePartnerBranding } from '@/contexts/PartnerBrandingContext';

/**
 * Public landing page shown when an unauthenticated user lands on `/`.
 * Tenant users are expected to enter the CRM exclusively via SSO from
 * the master Core platform. Manual login is reserved for global super admins
 * at `/rs_admin`.
 */
const Landing = () => {
  const [params, setParams] = useSearchParams();
  const { partner } = usePartnerBranding();
  // Dynamic redirect URL based on the partner resolved from the hostname.
  // Priority: explicit non_sso_redirect_url (white-label) > dashboardUrl >
  // primary domain. Ensures the landing button always sends the user to
  // the partner's branded entry point.
  const coreUrl =
    partner.nonSsoRedirectUrl?.trim() ||
    partner.dashboardUrl ||
    `https://${partner.primaryDomain}`;
  const ssoError = params.get('error') === 'sso_denied'
    ? params.get('reason') ?? 'unknown'
    : null;

  useEffect(() => {
    if (!ssoError) return;
    const reasonMap: Record<string, string> = {
      invalid_token: 'El enlace de acceso es inválido.',
      missing_token: 'Falta el token de acceso.',
      invalid_claims: 'El token no contiene la información necesaria.',
      tenant_not_found: 'La cuenta no existe en este sistema.',
      user_not_found: 'No se encontró tu usuario en este tenant.',
      user_inactive: 'Tu usuario está inactivo. Contacta al administrador.',
      link_generation_failed: 'No se pudo generar la sesión. Intenta de nuevo.',
      server_misconfigured: 'El servidor SSO no está configurado correctamente.',
      max_users_reached:
        'Se ha alcanzado el límite de usuarios permitidos para esta cuenta. Por favor, solicita más asientos en tu panel principal.',
    };
    const detail = reasonMap[ssoError] ?? 'Acceso denegado o sesión expirada.';
    toast.error('Acceso denegado o sesión expirada', { description: detail });
    const next = new URLSearchParams(params);
    next.delete('error');
    next.delete('reason');
    setParams(next, { replace: true });
  }, [ssoError, params, setParams]);

  // White-label redirect: if the partner has configured a non-SSO entry
  // URL, send unauthenticated users straight there instead of showing
  // the internal landing. Skipped when an SSO error is being displayed.
  useEffect(() => {
    if (ssoError) return;
    const target = partner.nonSsoRedirectUrl?.trim();
    if (target) {
      window.location.replace(target);
    }
  }, [ssoError, partner.nonSsoRedirectUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center space-y-8 animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <img
            src={partner.logoUrl}
            alt={partner.name}
            className="h-16 w-16 object-contain"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {partner.name} CRM
          </h1>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-medium text-foreground">
            Inicie sesión desde su panel de control principal
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            El acceso a esta plataforma se realiza exclusivamente desde su
            aplicación maestra {partner.name}. Allí podrá entrar al CRM con un
            solo clic, sin necesidad de credenciales adicionales.
          </p>
        </div>

        {ssoError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">
              No se pudo iniciar tu sesión. Vuelve a intentarlo desde tu panel
              principal.
            </p>
          </div>
        )}

        <Button
          onClick={() => {
            window.location.href = coreUrl || window.location.origin;
          }}
          className="w-full h-12 rounded-xl gradient-primary hover:opacity-90 transition-all font-semibold"
        >
          Ir al panel principal
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <p className="absolute bottom-6 text-xs text-muted-foreground text-center px-6">
        {partner.emailFooterText
          ? partner.emailFooterText
          : `© ${new Date().getFullYear()} ${partner.name}. Todos los derechos reservados.`}
      </p>
    </div>
  );
};

export default Landing;