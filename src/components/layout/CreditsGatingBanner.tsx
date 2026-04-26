import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOperationStatus } from '@/hooks/useOperationStatus';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Global banner shown when the tenant has no credits and cannot operate.
 * Allows full configuration but blocks credit-consuming actions.
 */
export function CreditsGatingBanner() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { canOperate, isLoading, status } = useOperationStatus();

  // Don't show for super admins or if still loading
  if (isSuperAdmin || isLoading) {
    return null;
  }

  // Don't show if can operate
  if (canOperate) {
    return null;
  }

  const isSuspended = status === 'SUSPENDED';

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-6 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {isSuspended
                ? 'Cuenta suspendida'
                : 'Tu cuenta está lista para configurarse'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isSuspended
                ? 'El envío de mensajes y la IA están bloqueados. Contacta a tu administrador para reactivar el servicio.'
                : 'Para enviar mensajes necesitas activar un plan o recargar créditos.'}
            </p>
          </div>
        </div>
        {!isSuspended && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => navigate('/settings/billing')}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" />
            Activar plan
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        )}
      </div>
    </div>
  );
}
