import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartnerRow {
  id: string;
  name: string;
  primary_domain: string;
  alt_domains: string[];
  country_code: string;
  logo_url: string | null;
  primary_color_hex: string;
  is_active: boolean;
  api_key: string | null;
  external_sync_enabled: boolean;
  dashboard_url: string | null;
  non_sso_redirect_url: string | null;
  logout_redirect_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerMetrics {
  tenants_total: number;
  users_total: number;
  wallet_balance: number;
  credits_consumed_30d: number;
}

export function usePartner(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["partner", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("id", partnerId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PartnerRow | null;
    },
  });
}

export function usePartnerMetrics(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["partner-metrics", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_metrics" as never, {
        _partner_id: partnerId!,
      } as never);
      if (error) throw error;
      return data as unknown as PartnerMetrics;
    },
  });
}

export function usePartnerTenants(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["partner-tenants", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, plan, status, billing_state, message_credits, created_at")
        .eq("partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      partnerId,
      patch,
    }: {
      partnerId: string;
      patch: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.rpc("partner_update_settings" as never, {
        _partner_id: partnerId,
        _patch: patch,
      } as never);
      if (error) throw error;
      return data as unknown as PartnerRow;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["partner", vars.partnerId] });
      qc.invalidateQueries({ queryKey: ["partner-metrics", vars.partnerId] });
      qc.invalidateQueries({ queryKey: ["partner-wallet", vars.partnerId] });
    },
  });
}

export function useRegeneratePartnerKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partnerId: string) => {
      const { data, error } = await supabase.rpc(
        "partner_regenerate_api_key" as never,
        { _partner_id: partnerId } as never,
      );
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_d, partnerId) => {
      qc.invalidateQueries({ queryKey: ["partner", partnerId] });
    },
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      partnerId,
      confirmId,
    }: {
      partnerId: string;
      confirmId: string;
    }) => {
      const { error } = await supabase.rpc("partner_delete_cascade" as never, {
        _partner_id: partnerId,
        _confirm_id: confirmId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-wallets-all"] });
    },
  });
}