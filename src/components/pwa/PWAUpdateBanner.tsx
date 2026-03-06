import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAUpdateBanner() {
  const { showUpdate, applyUpdate, dismissUpdate } = usePWAUpdate();

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[92vw] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-primary text-primary-foreground rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <RefreshCw className="size-5 shrink-0 animate-spin-slow" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Nueva versión disponible</p>
          <p className="text-xs opacity-80">Actualiza para obtener las últimas mejoras.</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0 text-xs font-semibold"
          onClick={applyUpdate}
        >
          Actualizar
        </Button>
        <button
          onClick={dismissUpdate}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
