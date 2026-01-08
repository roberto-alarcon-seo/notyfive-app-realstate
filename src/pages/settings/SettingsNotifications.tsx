import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

const notificationSettings = [
  { 
    id: "campaign-complete", 
    label: "Campaña completada", 
    description: "Recibe una notificación cuando una campaña termine",
    defaultChecked: true,
  },
  { 
    id: "new-message", 
    label: "Nuevos mensajes", 
    description: "Notificaciones de mensajes entrantes en el inbox",
    defaultChecked: true,
  },
  { 
    id: "weekly-report", 
    label: "Reporte semanal", 
    description: "Resumen semanal de tus campañas por email",
    defaultChecked: false,
  },
  { 
    id: "errors", 
    label: "Errores críticos", 
    description: "Alertas cuando hay errores en el envío de mensajes",
    defaultChecked: true,
  },
];

export default function SettingsNotifications() {
  return (
    <SettingsLayout
      title="Notificaciones"
      description="Configura tus preferencias de alertas y notificaciones"
      icon={Bell}
    >
      <div className="space-y-6 max-w-2xl">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-semibold text-foreground">Preferencias de notificaciones</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Elige qué notificaciones deseas recibir
            </p>
          </div>

          <div className="divide-y divide-border">
            {notificationSettings.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
