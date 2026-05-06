import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Building2, Search, Users, ChevronDown } from "lucide-react";

interface PropertyRow {
  id: string;
  property_code: string;
  title: string;
  zone: string | null;
  status: string;
  is_active: boolean;
}

interface Asesor {
  id: string;
  name: string;
  email: string;
}

export default function InventoryAssignments() {
  const tenantId = useEffectiveTenantId();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["inventory-assignments-properties", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<PropertyRow[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, property_code, title, zone, status, is_active")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: asesores = [] } = useQuery({
    queryKey: ["inventory-assignments-asesores", tenantId],
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<Asesor[]> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_role", "asesor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("tenant_id", tenantId!)
        .eq("status", "active")
        .in("id", ids)
        .order("name");
      return (profiles ?? []) as Asesor[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["inventory-assignments-all", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_assignments")
        .select("property_id, user_id")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignmentMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    assignments.forEach((a: any) => {
      if (!m.has(a.property_id)) m.set(a.property_id, new Set());
      m.get(a.property_id)!.add(a.user_id);
    });
    return m;
  }, [assignments]);

  const toggle = useMutation({
    mutationFn: async ({
      propertyId,
      userId,
      checked,
    }: {
      propertyId: string;
      userId: string;
      checked: boolean;
    }) => {
      if (!tenantId) throw new Error("No tenant");
      if (checked) {
        const { error } = await supabase
          .from("property_assignments")
          .insert({ tenant_id: tenantId, property_id: propertyId, user_id: userId } as any);
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("property_assignments")
          .delete()
          .eq("property_id", propertyId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-assignments-all", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.property_code?.toLowerCase().includes(q) ||
        p.zone?.toLowerCase().includes(q),
    );
  }, [properties, search]);

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Asesores por propiedad
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define qué asesores reciben los leads de cada propiedad. Funciona
            con inventario sincronizado por API o capturado manualmente.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Inventario activo
              <span className="text-muted-foreground font-normal text-sm">
                ({filtered.length})
              </span>
            </CardTitle>
            <div className="relative w-72">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código, título o zona…"
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Cargando inventario…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay propiedades en este tenant.
            </div>
          ) : asesores.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay asesores activos en el tenant. Invita asesores desde
              Configuración → Usuarios.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p) => {
                const assigned = assignmentMap.get(p.id) ?? new Set<string>();
                const assignedList = asesores.filter((a) => assigned.has(a.id));
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/30"
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 items-center">
                        <span className="font-mono">{p.property_code}</span>
                        {p.zone && <span>· {p.zone}</span>}
                        {!p.is_active && (
                          <Badge variant="outline" className="text-[10px]">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="col-span-5 min-w-0">
                      {assignedList.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">
                          Sin asesores asignados
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedList.map((a) => (
                            <Badge
                              key={a.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {a.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            Asignar
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-72 p-2 max-h-80 overflow-y-auto"
                          align="end"
                        >
                          <div className="text-xs text-muted-foreground px-2 py-1">
                            Selecciona uno o más asesores
                          </div>
                          {asesores.map((a) => {
                            const isChecked = assigned.has(a.id);
                            return (
                              <label
                                key={a.id}
                                className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(v) =>
                                    toggle.mutate({
                                      propertyId: p.id,
                                      userId: a.id,
                                      checked: !!v,
                                    })
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {a.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {a.email}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}