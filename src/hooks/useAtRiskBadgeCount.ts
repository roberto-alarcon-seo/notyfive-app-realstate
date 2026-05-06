import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts conversations currently flagged as "at risk" within the user's
 * scope (RLS handles visibility: agents see own, managers/admin see tenant).
 */
export function useAtRiskBadgeCount() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const qc = useQueryClient();

  const { data = 0 } = useQuery({
    queryKey: ["at-risk-count", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .not("risk_flagged_at", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("at-risk-conversations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => qc.invalidateQueries({ queryKey: ["at-risk-count", tenantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, qc]);

  return data;
}
