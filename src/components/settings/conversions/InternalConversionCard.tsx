import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TenantSettings } from "@/hooks/useConversionSettings";
import { Target, Loader2 } from "lucide-react";

const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'Nuevo Lead' },
  { value: 'interest_confirmed', label: 'Interés Confirmado' },
  { value: 'financial_validation', label: 'Validación Financiera' },
  { value: 'searching', label: 'En Búsqueda' },
  { value: 'visit_scheduled', label: 'Visita Agendada' },
  { value: 'visit_done', label: 'Visita Realizada' },
  { value: 'follow_up', label: 'Seguimiento' },
  { value: 'negotiation', label: 'Negociación' },
  { value: 'closed_won', label: 'Cerrado Ganado' },
  { value: 'closed_lost', label: 'Cerrado Perdido' },
];

interface InternalConversionCardProps {
  settings: TenantSettings;
  onSave: (settings: Partial<TenantSettings>) => Promise<unknown>;
}

export function InternalConversionCard({ settings, onSave }: InternalConversionCardProps) {
  const [localSettings, setLocalSettings] = useState({
    internal_conversion_stage: settings.internal_conversion_stage,
    internal_conversion_first_time_only: settings.internal_conversion_first_time_only,
    internal_conversion_allow_reversal: settings.internal_conversion_allow_reversal,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localSettings);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Conversión interna (NotyFive)</CardTitle>
            <CardDescription>
              Selecciona la etapa del pipeline que cuenta como conversión para tus reportes internos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stage select */}
        <div className="space-y-2">
          <Label htmlFor="conversion-stage">Etapa de conversión</Label>
          <Select
            value={localSettings.internal_conversion_stage}
            onValueChange={(value) => setLocalSettings(prev => ({ ...prev, internal_conversion_stage: value }))}
          >
            <SelectTrigger id="conversion-stage" className="w-full max-w-md">
              <SelectValue placeholder="Selecciona una etapa" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Cuando un lead llega a esta etapa por primera vez, cuenta como conversión.
          </p>
        </div>

        {/* First time only toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="first-time-only">Contar solo la primera vez</Label>
            <p className="text-sm text-muted-foreground">
              Evita duplicar conversiones si el lead se mueve de ida y vuelta.
            </p>
          </div>
          <Switch
            id="first-time-only"
            checked={localSettings.internal_conversion_first_time_only}
            onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, internal_conversion_first_time_only: checked }))}
          />
        </div>

        {/* Allow reversal toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="allow-reversal">Revertir conversión si vuelve atrás</Label>
            <p className="text-sm text-muted-foreground">
              Si está activado, si el lead retrocede antes de la etapa, se descuenta la conversión.
            </p>
          </div>
          <Switch
            id="allow-reversal"
            checked={localSettings.internal_conversion_allow_reversal}
            onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, internal_conversion_allow_reversal: checked }))}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
