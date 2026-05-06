import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface Props {
  propertyId: string;
}

export default function PropertyAuthorizedAgents({ propertyId }: Props) {
  const tenantId = useEffectiveTenantId();
  const qc = useQueryClient();

  const { data: asesores } = useQuery({
    queryKey: ["tenant-asesores-list", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_role", "asesor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, is_active_for_assignment")
        .eq("tenant_id", tenantId!)
        .eq("status", "active")
        .in("id", ids)
        .order("name");
      return profiles ?? [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["property-assignments", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_assignments")
        .select("user_id")
        .eq("property_id", propertyId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.user_id as string);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, checked }: { userId: string; checked: boolean }) => {
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
      qc.invalidateQueries({ queryKey: ["property-assignments", propertyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar"),
  });

  const selected = new Set(assignments ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Asesores autorizados
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Estos asesores recibirán leads de esta propiedad por la regla de asignación
          inteligente. Puedes seleccionar varios.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {(!asesores || asesores.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No hay asesores activos en este tenant.
          </p>
        )}
        {asesores?.map((a: any) => {
          const isChecked = selected.has(a.id);
          return (
            <label
              key={a.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(v) =>
                  toggle.mutate({ userId: a.id, checked: !!v })
                }
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.email}</div>
              </div>
              {!a.is_active_for_assignment && (
                <span className="text-[10px] uppercase text-muted-foreground">
                  Inactivo
                </span>
              )}
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}