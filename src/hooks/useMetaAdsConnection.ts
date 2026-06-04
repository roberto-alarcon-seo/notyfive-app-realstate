import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetaAdsConnection {
  id: string;
  tenant_id: string;
  ad_account_id: string | null;
  ad_account_name: string | null;
  pixel_id: string | null;
  pixel_name: string | null;
  status: "pending" | "connected" | "error" | "disconnected";
  error_message: string | null;
  meta_user_id: string | null;
  meta_user_name: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
}

export function useMetaAdsConnection() {
  return useQuery({
    queryKey: ["meta-ads-connection"],
    queryFn: async (): Promise<MetaAdsConnection | null> => {
      const { data, error } = await supabase
        .from("meta_ads_connections")
        .select("*")
        .neq("status", "disconnected")
        .maybeSingle();
      if (error) throw error;
      return (data as MetaAdsConnection | null) ?? null;
    },
  });
}