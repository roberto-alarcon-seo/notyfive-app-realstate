import { Zap } from "lucide-react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export default function SettingsQuickAutomations() {
  return (
    <SettingsLayout
      title="Automatizaciones Rápidas"
      description="Configura respuestas y acciones automáticas básicas para tu canal."
      icon={Zap}
    >
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Próximamente</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Estamos preparando un nuevo módulo de automatizaciones rápidas integradas
          directamente en tu canal de WhatsApp. Pronto disponible.
        </p>
      </div>
    </SettingsLayout>
  );
}
