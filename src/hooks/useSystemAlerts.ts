import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SystemAlert {
  id: string;
  tenant_id: string;
  type: "warning" | "error" | "success" | "info";
  code: string;
  title: string;
  message: string;
  entity_type: "campaign" | "account" | "template" | "credits" | "inbox" | null;
  entity_id: string | null;
  severity: number;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export function useSystemAlerts() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["system-alerts", tenantId],
    queryFn: async (): Promise<SystemAlert[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("system_alerts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("resolved", false)
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as SystemAlert[];
    },
    enabled: !!tenantId,
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("system_alerts")
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString() 
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-alerts", tenantId] });
    },
  });

  return {
    alerts: query.data || [],
    isLoading: query.isLoading,
    resolveAlert: resolveAlert.mutate,
  };
}
