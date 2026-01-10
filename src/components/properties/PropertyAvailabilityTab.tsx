import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Property } from "@/hooks/useProperties";

interface PropertyAvailabilityTabProps {
  formData: Partial<Property>;
  updateField: <K extends keyof Property>(field: K, value: Property[K]) => void;
}

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible", description: "Propiedad lista para mostrar y vender/rentar" },
  { value: "reserved", label: "Apartado", description: "Cliente interesado, pendiente de cierre" },
  { value: "sold", label: "Vendido", description: "Propiedad vendida" },
  { value: "rented", label: "Rentado", description: "Propiedad en renta activa" },
  { value: "inactive", label: "Inactiva", description: "No disponible temporalmente" },
];

export default function PropertyAvailabilityTab({
  formData,
  updateField,
}: PropertyAvailabilityTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estado de disponibilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="status">Estatus de la propiedad</Label>
            <Select
              value={formData.status || "available"}
              onValueChange={(v) => updateField("status", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
            <Switch
              id="is_active"
              checked={formData.is_active ?? true}
              onCheckedChange={(v) => updateField("is_active", v)}
            />
            <div>
              <Label htmlFor="is_active" className="font-medium">
                Propiedad activa
              </Label>
              <p className="text-sm text-muted-foreground">
                Si está desactivada, no aparecerá en búsquedas ni se mostrará a
                clientes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de visita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visit_availability">Disponibilidad para visitas</Label>
            <Textarea
              id="visit_availability"
              value={formData.visit_availability || ""}
              onChange={(e) => updateField("visit_availability", e.target.value)}
              placeholder="Ej: Se requiere agendar con mínimo 48 horas de anticipación. Horarios disponibles: L-V 10:00-18:00, S 10:00-14:00"
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Esta información será utilizada por la IA para agendar visitas
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.internal_notes || ""}
            onChange={(e) => updateField("internal_notes", e.target.value)}
            placeholder="Notas internas sobre disponibilidad, restricciones, etc."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
