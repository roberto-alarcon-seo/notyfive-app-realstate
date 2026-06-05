import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useProperties, usePropertyZones, PropertyFilters } from "@/hooks/useProperties";
import PropertyTable from "@/components/properties/PropertyTable";
import type { Property } from "@/hooks/useProperties";
import { CampaignAIPanel } from "@/components/meta-ads/CampaignAIPanel";

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Apartado" },
  { value: "sold", label: "Vendido" },
  { value: "rented", label: "Rentado" },
  { value: "inactive", label: "Inactiva" },
];

const OPERATION_OPTIONS = [
  { value: "sale", label: "Venta" },
  { value: "rent", label: "Renta" },
];

export default function Properties() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [campaignProperty, setCampaignProperty] = useState<Property | null>(null);

  const { data: properties, isLoading } = useProperties(filters);
  const { data: zones } = usePropertyZones();

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ""
  ).length;

  const clearFilter = (key: keyof PropertyFilters) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Propiedades</h1>
            <p className="text-muted-foreground">Gestiona tu inventario de propiedades</p>
          </div>
        </div>
        <Button onClick={() => navigate("/properties/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva propiedad
        </Button>
      </div>

        {/* Search & Filters */}
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, ID o zona..."
                value={filters.search || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="pl-10"
              />
            </div>
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent>
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Zona</label>
                    <Select
                      value={filters.zone || ""}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          zone: v || undefined,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las zonas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas las zonas</SelectItem>
                        {zones?.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estatus</label>
                    <Select
                      value={filters.status || ""}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: v || undefined,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los estatus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos los estatus</SelectItem>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Operación</label>
                    <Select
                      value={filters.operation_type || ""}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          operation_type: v || undefined,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las operaciones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas las operaciones</SelectItem>
                        {OPERATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rango de precio</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Mín"
                        value={filters.price_min || ""}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            price_min: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                      <Input
                        type="number"
                        placeholder="Máx"
                        value={filters.price_max || ""}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            price_max: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      Filtros activos:
                    </span>
                    {filters.zone && (
                      <Badge variant="secondary" className="gap-1">
                        Zona: {filters.zone}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => clearFilter("zone")}
                        />
                      </Badge>
                    )}
                    {filters.status && (
                      <Badge variant="secondary" className="gap-1">
                        Estatus:{" "}
                        {STATUS_OPTIONS.find((o) => o.value === filters.status)
                          ?.label}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => clearFilter("status")}
                        />
                      </Badge>
                    )}
                    {filters.operation_type && (
                      <Badge variant="secondary" className="gap-1">
                        Operación:{" "}
                        {OPERATION_OPTIONS.find(
                          (o) => o.value === filters.operation_type
                        )?.label}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => clearFilter("operation_type")}
                        />
                      </Badge>
                    )}
                    {(filters.price_min || filters.price_max) && (
                      <Badge variant="secondary" className="gap-1">
                        Precio: {filters.price_min || 0} -{" "}
                        {filters.price_max || "∞"}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            clearFilter("price_min");
                            clearFilter("price_max");
                          }}
                        />
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-destructive"
                    >
                      Limpiar todos
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Table */}
        <PropertyTable
          properties={properties || []}
          isLoading={isLoading}
          onCreateCampaign={(p) => setCampaignProperty(p)}
        />
      </div>
      <CampaignAIPanel
        open={!!campaignProperty}
        property={campaignProperty}
        onClose={() => setCampaignProperty(null)}
      />
    </div>
  );
}
