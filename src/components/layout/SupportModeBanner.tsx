import { useEffect, useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupportMode } from '@/contexts/SupportModeContext';
import { supabase } from '@/integrations/supabase/client';

interface AdminOrigin {
  email?: string | null;
  name?: string | null;
  returnPath?: string | null;
  tenantName?: string | null;
  targetName?: string | null;
  targetEmail?: string | null;
}

/**
 * Global banner shown when super_admin is in support/impersonation mode.
 * Always visible at the top of the app to make it clear they're accessing another tenant.
 */
export function SupportModeBanner() {
  const { isSupportMode, supportTenantName, endSupportMode, isLoading } = useSupportMode();
  const [ssoImpersonation, setSsoImpersonation] = useState(false);
  const [origin, setOrigin] = useState<AdminOrigin | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const active = sessionStorage.getItem('noty5_admin_impersonation') === '1';
      setSsoImpersonation(active);
      if (active) {
        const raw = sessionStorage.getItem('noty5_admin_origin');
        if (raw) setOrigin(JSON.parse(raw) as AdminOrigin);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleReturnToAdmin = async () => {
    setReturning(true);
    try {
      sessionStorage.removeItem('noty5_admin_impersonation');
      sessionStorage.removeItem('noty5_admin_origin');
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      window.location.assign('/rs_admin');
    } finally {
      setReturning(false);
    }
  };

  if (!isSupportMode && !ssoImpersonation) {
    return null;
  }

  // SSO impersonation banner takes precedence (its session replaced the admin's).
  if (ssoImpersonation) {
    const targetLabel = origin?.targetName ?? origin?.targetEmail ?? 'usuario del tenant';
    const tenantLabel = origin?.tenantName ?? 'el tenant';
    return (
      <div className="bg-orange-500 text-white px-6 py-2 shrink-0">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Sesión de soporte activa</p>
              <p className="text-xs opacity-90 truncate">
                Conectado como <strong>{targetLabel}</strong> en <strong>{tenantLabel}</strong>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReturnToAdmin}
            disabled={returning}
            className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0 shrink-0"
          >
            <LogOut className="h-4 w-4" />
            Volver al panel admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-500 text-white px-6 py-2 shrink-0">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Modo Soporte Activo
            </p>
            <p className="text-xs opacity-90">
              Estás accediendo al tenant: <strong>{supportTenantName}</strong>. Todas las acciones quedan registradas.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={endSupportMode}
          disabled={isLoading}
          className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0"
        >
          <LogOut className="h-4 w-4" />
          Salir del modo soporte
        </Button>
      </div>
    </div>
  );
}
