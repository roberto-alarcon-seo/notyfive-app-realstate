import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupportMode } from '@/contexts/SupportModeContext';

/**
 * Global banner shown when super_admin is in support/impersonation mode.
 * Always visible at the top of the app to make it clear they're accessing another tenant.
 */
export function SupportModeBanner() {
  const { isSupportMode, supportTenantName, endSupportMode, isLoading } = useSupportMode();

  if (!isSupportMode) {
    return null;
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
