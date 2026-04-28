import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";

export interface TenantContext {
  id: string;
  name: string | null;
  managed_externally: boolean;
  country_code: string;
  external_id: string | null;
  enabled_features: string[];
}

/**
 * Returns lightweight tenant metadata used across the app for UI gating
 * (e.g. read-only mode for externally-managed tenants, regional credit
 * options based on country_code).
 */
export function useTenantContext() {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ["tenant-context", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TenantContext | null> => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, managed_externally, country_code, external_id, enabled_features")
        .eq("id", tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        managed_externally: !!data.managed_externally,
        country_code: (data.country_code ?? "MX").toUpperCase(),
        external_id: data.external_id ?? null,
        enabled_features: Array.isArray((data as any).enabled_features)
          ? ((data as any).enabled_features as string[])
          : [],
      };
    },
  });
}