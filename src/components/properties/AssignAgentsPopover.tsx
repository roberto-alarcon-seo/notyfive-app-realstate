import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Users } from "lucide-react";

interface AssignAgentsPopoverProps {
  propertyId: string;
  tenantId: string;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Asesor {
  id: string;
  name: string | null;
  email: string | null;
}

export function AssignAgentsPopover({
  propertyId,
  tenantId,
  trigger,
  open,
  onOpenChange,
}: AssignAgentsPopoverProps) {
  const qc = useQueryClient();

  const { data: asesores = [] } = useQuery({
    queryKey: ["inventory-assignments-asesores", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
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
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("id", ids)
        .order("name");
      return (profiles ?? []) as Asesor[];
    },
  });

  const { data: assigned } = useQuery({
    queryKey: ["property-assignments", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_assignments")
        .select("user_id")
        .eq("property_id", propertyId);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.user_id as string));
    },
  });

  const toggle = async (userId: string) => {
    const isAssigned = assigned?.has(userId);
    if (isAssigned) {
      const { error } = await supabase
        .from("property_assignments")
        .delete()
        .eq("property_id", propertyId)
        .eq("user_id", userId);
      if (error) {
        toast.error("No se pudo desasignar");
        return;
      }
    } else {
      const { error } = await supabase
        .from("property_assignments")
        .insert({ property_id: propertyId, user_id: userId, tenant_id: tenantId } as any);
      if (error && !String(error.message).includes("duplicate")) {
        toast.error("No se pudo asignar");
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["property-assignments", propertyId] });
    qc.invalidateQueries({ queryKey: ["inventory-assignments-all"] });
  };

  const count = assigned?.size ?? 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2.5 border-b">
          <div className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Asesores asignados
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecciona quién recibe leads de esta propiedad
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {asesores.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No hay asesores activos en el tenant
            </div>
          ) : (
            asesores.map((a) => {
              const isChecked = assigned?.has(a.id) ?? false;
              const initial =
                (a.name?.charAt(0) || a.email?.charAt(0) || "?").toUpperCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{a.name ?? a.email}</div>
                    {a.name && a.email && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.email}
                      </div>
                    )}
                  </div>
                  {isChecked && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="px-3 py-2 border-t text-[11px] text-muted-foreground">
          {count} asesor{count !== 1 ? "es" : ""} asignado{count !== 1 ? "s" : ""}
        </div>
      </PopoverContent>
    </Popover>
  );
}