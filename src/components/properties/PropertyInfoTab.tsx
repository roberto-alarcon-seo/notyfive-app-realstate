import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";

interface PropertyInfoTabProps {
  formData: Partial<Property>;
  updateField: <K extends keyof Property>(field: K, value: Property[K]) => void;
  propertyId?: string;
}

const OPERATION_TYPES = [
  { value: "sale", label: "Venta" },
  { value: "rent", label: "Renta" },
];

const PROPERTY_TYPES = [
  { value: "house", label: "Casa" },
  { value: "apartment", label: "Departamento" },
  { value: "land", label: "Terreno" },
  { value: "commercial", label: "Comercial" },
  { value: "office", label: "Oficina" },
];

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Apartado" },
  { value: "sold", label: "Vendido" },
  { value: "rented", label: "Rentado" },
  { value: "inactive", label: "Inactiva" },
];

const CURRENCY_OPTIONS = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
];

const CREDIT_OPTIONS = [
  { value: "INFONAVIT", label: "INFONAVIT" },
  { value: "COFINAVIT", label: "COFINAVIT" },
  { value: "FOVISSSTE", label: "FOVISSSTE" },
  { value: "ISFAM", label: "ISFAM" },
  { value: "CFE", label: "CFE" },
  { value: "BANK", label: "Bancario" },
  { value: "CONTADO", label: "Contado" },
];

export default function PropertyInfoTab({
  formData,
  updateField,
  propertyId,
}: PropertyInfoTabProps) {
  const tenantId = useEffectiveTenantId();

  // Fetch only users with 'asesor' role for property assignment
  const { data: asesores } = useQuery({
    queryKey: ["tenant-asesores", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // First get user_roles with asesor role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_role", "asesor");
      
      if (rolesError) throw rolesError;
      
      const asesorUserIds = roles?.map(r => r.user_id) || [];
      
      if (asesorUserIds.length === 0) return [];
      
      // Then get profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("id", asesorUserIds);
      
      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!tenantId,
  });

  const handleCreditToggle = (credit: string) => {
    const current = formData.accepted_credits || [];
    const updated = current.includes(credit)
      ? current.filter((c) => c !== credit)
      : [...current, credit];
    updateField("accepted_credits", updated);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property_code">ID de la Propiedad *</Label>
                <Input
                  id="property_code"
                  value={formData.property_code || ""}
                  onChange={(e) => updateField("property_code", e.target.value)}
                  placeholder="PROP-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_user">Asesor asignado</Label>
                <Select
                  value={formData.assigned_user_id || "none"}
                  onValueChange={(v) =>
                    updateField("assigned_user_id", v === "none" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {asesores?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Nombre de la Propiedad *</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Penthouse en Condesa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zone">Zona *</Label>
                <Input
                  id="zone"
                  value={formData.zone || ""}
                  onChange={(e) => updateField("zone", e.target.value)}
                  placeholder="Condesa, CDMX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Calle, Número"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operation_type">Tipo de operación *</Label>
                <Select
                  value={formData.operation_type || "sale"}
                  onValueChange={(v) => updateField("operation_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="property_type">Tipo de propiedad</Label>
                <Select
                  value={formData.property_type || "none"}
                  onValueChange={(v) =>
                    updateField("property_type", v === "none" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {PROPERTY_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price || 0}
                  onChange={(e) => updateField("price", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={formData.currency || "MXN"}
                  onValueChange={(v) => updateField("currency", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Estatus</Label>
                <Select
                  value={formData.status || "available"}
                  onValueChange={(v) => updateField("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenance_fee">Mantenimiento (MXN)</Label>
                <Input
                  id="maintenance_fee"
                  type="number"
                  value={formData.maintenance_fee || ""}
                  onChange={(e) =>
                    updateField(
                      "maintenance_fee",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active ?? true}
                onCheckedChange={(v) => updateField("is_active", v)}
              />
              <Label htmlFor="is_active">Propiedad activa</Label>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - AI Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>Prompt para IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai_prompt">
                Información completa de la Propiedad *
              </Label>
              <Textarea
                id="ai_prompt"
                value={formData.ai_prompt || ""}
                onChange={(e) => updateField("ai_prompt", e.target.value)}
                placeholder="Incluye características, condiciones, créditos, disponibilidad, objeciones, etc."
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Esta información será utilizada por la IA para responder
                consultas sobre la propiedad.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Créditos aceptados</Label>
              <div className="flex flex-wrap gap-2">
                {CREDIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCreditToggle(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      formData.accepted_credits?.includes(opt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_notes">Notas internas</Label>
              <Textarea
                id="internal_notes"
                value={formData.internal_notes || ""}
                onChange={(e) => updateField("internal_notes", e.target.value)}
                placeholder="Notas visibles solo para el equipo..."
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}