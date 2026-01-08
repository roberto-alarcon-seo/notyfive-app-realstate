import { Key, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export default function SettingsApi() {
  return (
    <SettingsLayout
      title="API & Webhooks"
      description="Gestiona tus claves de API y configuración de webhooks"
      icon={Key}
    >
      <div className="space-y-6 max-w-2xl">
        {/* API Keys */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Claves de API</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">WhatsApp Cloud API</p>
                  <p className="text-sm text-muted-foreground font-mono">wh_***********************789</p>
                </div>
                <Button variant="outline" size="sm">Actualizar</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Webhooks */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Webhooks</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL del webhook</Label>
              <Input
                id="webhook-url"
                placeholder="https://tu-servidor.com/webhook"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Los webhooks se configuran automáticamente al conectar WhatsApp
              </p>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
