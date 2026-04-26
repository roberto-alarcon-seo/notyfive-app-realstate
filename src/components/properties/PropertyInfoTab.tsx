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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { Property } from "@/hooks/useProperties";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { useTenantContext } from "@/hooks/useTenantContext";

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
  { value: "COP", label: "COP" },
  { value: "ARS", label: "ARS" },
  { value: "CLP", label: "CLP" },
  { value: "PEN", label: "PEN" },
  { value: "EUR", label: "EUR" },
];

// Region-specific credit / financing options.
// Always includes universal options (CONTADO, BANK).
const CREDIT_OPTIONS_BY_COUNTRY: Record<string, { value: string; label: string }[]> = {
  MX: [
    { value: "INFONAVIT", label: "INFONAVIT" },
    { value: "COFINAVIT", label: "COFINAVIT" },
    { value: "FOVISSSTE", label: "FOVISSSTE" },
    { value: "ISFAM", label: "ISFAM" },
    { value: "CFE", label: "CFE" },
    { value: "BANK", label: "Bancario" },
    { value: "CONTADO", label: "Contado" },
  ],
  CO: [
    { value: "FNA", label: "FNA" },
    { value: "SUBSIDIO_MIVIVIENDA", label: "Subsidio Mi Casa Ya" },
    { value: "LEASING", label: "Leasing habitacional" },
    { value: "BANK", label: "Bancario" },
    { value: "CONTADO", label: "Contado" },
  ],
  AR: [
    { value: "PROCREAR", label: "Procrear" },
    { value: "BANK", label: "Bancario" },
    { value: "CONTADO", label: "Contado" },
  ],
  CL: [
    { value: "SUBSIDIO_DS1", label: "Subsidio DS1" },
    { value: "BANK", label: "Bancario" },
    { value: "CONTADO", label: "Contado" },
  ],
  PE: [
    { value: "MIVIVIENDA", label: "MiVivienda" },
    { value: "TECHO_PROPIO", label: "Techo Propio" },
    { value: "BANK", label: "Bancario" },
    { value: "CONTADO", label: "Contado" },
  ],
  ES: [
    { value: "HIPOTECA", label: "Hipoteca" },
    { value: "BANK", label: "Bancario" },
    { value: "CONTADO", label: "Contado" },
  ],
};

const DEFAULT_CREDIT_OPTIONS = [
  { value: "BANK", label: "Bancario" },
  { value: "CONTADO", label: "Contado" },
];

export default function PropertyInfoTab({
  formData,
  updateField,
  propertyId,
}: PropertyInfoTabProps) {
  const tenantId = useEffectiveTenantId();
  const { data: tenantCtx } = useTenantContext();
  const isExternallyManaged = !!tenantCtx?.managed_externally;
  const countryCode = tenantCtx?.country_code ?? "MX";
  const creditOptionsForCountry =
    CREDIT_OPTIONS_BY_COUNTRY[countryCode] ?? DEFAULT_CREDIT_OPTIONS;

  // When managed externally, show every credit currently set on the property even
  // if it is not in the local catalog (e.g. Core sent a code we don't know yet).
  const knownValues = new Set(creditOptionsForCountry.map((c) => c.value));
  const extraSelectedCredits = (formData.accepted_credits ?? [])
    .filter((c) => !knownValues.has(c))
    .map((value) => ({ value, label: value }));
  const renderedCreditOptions = [...creditOptionsForCountry, ...extraSelectedCredits];

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
    if (isExternallyManaged) return;
    const current = formData.accepted_credits || [];
    const updated = current.includes(credit)
      ? current.filter((c) => c !== credit)
      : [...current, credit];
    updateField("accepted_credits", updated);
  };

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {isExternallyManaged && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>
            Esta propiedad es gestionada por el <strong>Sistema Core</strong>.
            Los campos técnicos y créditos son de solo lectura.
          </span>
        </div>
      )}
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
                  disabled={isExternallyManaged}
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
                disabled={isExternallyManaged}
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
                  disabled={isExternallyManaged}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Calle, Número"
                  disabled={isExternallyManaged}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operation_type">Tipo de operación *</Label>
                <Select
                  value={formData.operation_type || "sale"}
                  onValueChange={(v) => updateField("operation_type", v)}
                  disabled={isExternallyManaged}
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
                  disabled={isExternallyManaged}
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
                  disabled={isExternallyManaged}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={formData.currency || "MXN"}
                  onValueChange={(v) => updateField("currency", v)}
                  disabled={isExternallyManaged}
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
                  disabled={isExternallyManaged}
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
                <Label htmlFor="maintenance_fee">
                  Mantenimiento ({formData.currency || "MXN"})
                </Label>
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
                  disabled={isExternallyManaged}
                />
              </div>
            </div>

            {/* Technical specs */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Características técnicas</Label>
                {isExternallyManaged && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" /> Solo lectura
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Estos valores son controlados por el Sistema Core
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Recámaras</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min={0}
                    value={formData.bedrooms ?? ""}
                    onChange={(e) =>
                      updateField(
                        "bedrooms",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="0"
                    disabled={isExternallyManaged}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Baños</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    min={0}
                    step="0.5"
                    value={formData.bathrooms ?? ""}
                    onChange={(e) =>
                      updateField(
                        "bathrooms",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="0"
                    disabled={isExternallyManaged}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parking_spots">Estacionamientos</Label>
                  <Input
                    id="parking_spots"
                    type="number"
                    min={0}
                    value={formData.parking_spots ?? ""}
                    onChange={(e) =>
                      updateField(
                        "parking_spots",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="0"
                    disabled={isExternallyManaged}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sq_meters">Metros cuadrados</Label>
                  <Input
                    id="sq_meters"
                    type="number"
                    min={0}
                    value={formData.sq_meters ?? ""}
                    onChange={(e) =>
                      updateField(
                        "sq_meters",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="0"
                    disabled={isExternallyManaged}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active ?? true}
                onCheckedChange={(v) => updateField("is_active", v)}
                disabled={isExternallyManaged}
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
                value={formData.ai_description_template || formData.ai_prompt || ""}
                onChange={(e) => updateField("ai_prompt", e.target.value)}
                placeholder="Incluye características, condiciones, créditos, disponibilidad, objeciones, etc."
                className="min-h-[200px]"
                disabled={isExternallyManaged}
              />
              <p className="text-xs text-muted-foreground">
                {isExternallyManaged && formData.ai_description_template
                  ? "Plantilla enviada por el Sistema Core. Usada por la IA para responder consultas."
                  : "Esta información será utilizada por la IA para responder consultas sobre la propiedad."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Créditos aceptados</Label>
                <span className="text-xs text-muted-foreground">
                  Región: {countryCode}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {renderedCreditOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCreditToggle(opt.value)}
                    disabled={isExternallyManaged}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      formData.accepted_credits?.includes(opt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:border-primary/50"
                    } ${isExternallyManaged ? "opacity-70 cursor-not-allowed hover:border-border" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
                {renderedCreditOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay opciones de crédito configuradas para la región {countryCode}.
                  </p>
                )}
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
                disabled={isExternallyManaged}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
}