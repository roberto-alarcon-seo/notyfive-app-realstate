import { Sparkles, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MetaAds() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Meta Ads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestión de campañas publicitarias
        </p>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-10">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Megaphone className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Conecta tu cuenta de Meta Ads
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Configura tu cuenta de Meta Ads para comenzar a crear campañas
            asistidas por IA.
          </p>
          <Button
            onClick={() =>
              toast.info("Próximamente disponible", {
                description:
                  "La conexión con Meta Ads estará habilitada en breve.",
              })
            }
          >
            Conectar cuenta
          </Button>
        </div>
      </div>
    </div>
  );
}