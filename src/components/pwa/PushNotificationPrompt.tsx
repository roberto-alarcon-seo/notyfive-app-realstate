import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationPrompt() {
  const { permission, isSubscribed, loading, subscribe } = usePushNotifications();

  if (permission === 'unsupported' || isSubscribed) return null;

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        {permission === 'denied' ? (
          <BellOff className="h-5 w-5 text-destructive" />
        ) : (
          <Bell className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Activa las notificaciones
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Recibe alertas instantáneas cuando llegue un nuevo lead interesado en una propiedad.
        </p>
        {permission === 'denied' ? (
          <p className="text-xs text-destructive mt-2">
            Las notificaciones están bloqueadas. Habilítalas desde la configuración de tu navegador.
          </p>
        ) : (
          <Button
            size="sm"
            className="mt-3"
            onClick={subscribe}
            disabled={loading}
          >
            {loading ? 'Activando…' : 'Activar notificaciones'}
          </Button>
        )}
      </div>
    </div>
  );
}
