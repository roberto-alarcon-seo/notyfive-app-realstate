import { Plus, Upload, Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    icon: Plus,
    label: "Nueva campaña",
    description: "Crear una campaña de WhatsApp",
    variant: "default" as const,
  },
  {
    icon: Upload,
    label: "Importar contactos",
    description: "Subir archivo CSV",
    variant: "secondary" as const,
  },
  {
    icon: Bot,
    label: "Asistente IA",
    description: "Generar contenido con IA",
    variant: "secondary" as const,
  },
  {
    icon: Send,
    label: "Envío rápido",
    description: "Mensaje a un segmento",
    variant: "secondary" as const,
  },
];

export function QuickActions() {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Acciones rápidas</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="h-auto flex-col items-start p-4 gap-2"
          >
            <action.icon className="w-5 h-5" />
            <div className="text-left">
              <p className="font-medium text-sm">{action.label}</p>
              <p className="text-xs opacity-70">{action.description}</p>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
