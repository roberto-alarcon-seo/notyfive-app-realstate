import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type TimeoutAction = "notify" | "reassign" | "notify_and_reassign";

export interface AssignmentRules {
  tenant_id: string;
  round_robin_enabled: boolean;
  sticky_agent_enabled: boolean;
  sticky_overrides_property: boolean;
  lead_timeout_minutes: number;
  timeout_action: TimeoutAction;
  max_active_leads_per_agent: number | null;
  last_assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAssignmentRules() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["assignment-rules", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<AssignmentRules | null> => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("assignment_rules" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AssignmentRules) ?? null;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Omit<AssignmentRules, "tenant_id" | "created_at" | "updated_at">>) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase
        .from("assignment_rules" as any)
        .upsert({ tenant_id: tenantId, ...patch } as any, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-rules", tenantId] });
      toast.success("Reglas de asignación actualizadas");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudieron guardar las reglas"),
  });

  return { ...query, update };
}

export interface AssignableAgent {
  id: string;
  name: string;
  email: string;
  status: string;
  is_active_for_assignment: boolean;
  tenant_role: string | null;
}

export function useAssignableAgents() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["assignable-agents", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<AssignableAgent[]> => {
      if (!tenantId) return [];
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, email, status, is_active_for_assignment")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });
      if (error) throw error;
      const ids = (profiles ?? []).map((p: any) => p.id);
      if (ids.length === 0) return [];
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, tenant_role")
        .in("user_id", ids);
      if (rolesError) throw rolesError;
      const roleMap = new Map<string, string | null>(
        (roles ?? []).map((r: any) => [r.user_id, r.tenant_role]),
      );
      return (profiles ?? [])
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          status: p.status,
          is_active_for_assignment: (p as any).is_active_for_assignment ?? true,
          tenant_role: roleMap.get(p.id) ?? null,
        }))
        .filter((p) => p.tenant_role === "asesor");
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active_for_assignment: active } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignable-agents", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar"),
  });

  return { ...query, setActive };
}

// Like useAssignableAgents but includes managers and administradores (used in
// reassignment pickers where any team member can take ownership).
export function useAllAssignableMembers() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;

  return useQuery({
    queryKey: ["assignable-members", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<AssignableAgent[]> => {
      if (!tenantId) return [];
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, email, status, is_active_for_assignment")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      const ids = (profiles ?? []).map((p: any) => p.id);
      if (ids.length === 0) return [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, tenant_role")
        .in("user_id", ids);
      const roleMap = new Map<string, string | null>(
        (roles ?? []).map((r: any) => [r.user_id, r.tenant_role]),
      );
      return (profiles ?? [])
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          status: p.status,
          is_active_for_assignment: (p as any).is_active_for_assignment ?? true,
          tenant_role: roleMap.get(p.id) ?? null,
        }))
        .filter((p) =>
          ["asesor", "manager", "administrador"].includes(p.tenant_role || ""),
        );
    },
  });
}
