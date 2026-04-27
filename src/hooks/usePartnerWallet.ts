import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerWallet {
  id: string;
  partner_id: string;
  balance_credits: number;
  low_balance_threshold: number;
  updated_at: string;
}

export interface PartnerLedgerEntry {
  id: string;
  partner_id: string;
  movement_type: 'TOPUP' | 'REDEEM' | 'ADJUSTMENT';
  amount: number;
  balance_before: number;
  balance_after: number;
  tenant_id: string | null;
  actor_user_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  tenant?: { name: string } | null;
}

export interface LedgerFilters {
  partnerId?: string;
  tenantQuery?: string;
  movementType?: 'ALL' | 'TOPUP' | 'REDEEM' | 'ADJUSTMENT';
  from?: string;
  to?: string;
}

export function usePartnerWallet(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: ['partner-wallet', partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_super_wallets' as never)
        .select('id, partner_id, balance_credits, low_balance_threshold, updated_at')
        .eq('partner_id', partnerId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PartnerWallet | null) ?? {
        id: '',
        partner_id: partnerId!,
        balance_credits: 0,
        low_balance_threshold: 1000,
        updated_at: new Date().toISOString(),
      };
    },
  });
}

export function useAllPartnerWallets() {
  return useQuery({
    queryKey: ['partner-wallets-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_super_wallets' as never)
        .select('id, partner_id, balance_credits, low_balance_threshold, updated_at')
        .order('partner_id');
      if (error) throw error;
      return (data ?? []) as unknown as PartnerWallet[];
    },
  });
}

export function usePartnerLedger(filters: LedgerFilters) {
  return useQuery({
    queryKey: ['partner-ledger', filters],
    queryFn: async () => {
      let q = supabase
        .from('partner_wallet_ledger' as never)
        .select(
          'id, partner_id, movement_type, amount, balance_before, balance_after, tenant_id, actor_user_id, description, metadata, created_at, tenant:tenants(name)'
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters.partnerId) q = q.eq('partner_id', filters.partnerId);
      if (filters.movementType && filters.movementType !== 'ALL')
        q = q.eq('movement_type', filters.movementType);
      if (filters.from) q = q.gte('created_at', filters.from);
      if (filters.to) q = q.lte('created_at', filters.to);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as PartnerLedgerEntry[];
      if (filters.tenantQuery && filters.tenantQuery.trim()) {
        const needle = filters.tenantQuery.toLowerCase();
        rows = rows.filter((r) => (r.tenant?.name ?? '').toLowerCase().includes(needle));
      }
      return rows;
    },
  });
}

export function useTopupPartnerWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      partnerId,
      amount,
      description,
    }: {
      partnerId: string;
      amount: number;
      description?: string;
    }) => {
      const { data, error } = await supabase.rpc('partner_wallet_topup' as never, {
        _partner_id: partnerId,
        _amount: amount,
        _description: description ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as PartnerWallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-wallet'] });
      qc.invalidateQueries({ queryKey: ['partner-wallets-all'] });
      qc.invalidateQueries({ queryKey: ['partner-ledger'] });
    },
  });
}

export function useRedeemPartnerWalletToTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      partnerId,
      tenantId,
      amount,
      description,
    }: {
      partnerId: string;
      tenantId: string;
      amount: number;
      description?: string;
    }) => {
      const { data, error } = await supabase.rpc(
        'partner_wallet_redeem_to_tenant' as never,
        {
          _partner_id: partnerId,
          _tenant_id: tenantId,
          _amount: amount,
          _description: description ?? null,
        } as never,
      );
      if (error) throw error;
      return data as unknown as PartnerWallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-wallet'] });
      qc.invalidateQueries({ queryKey: ['partner-wallets-all'] });
      qc.invalidateQueries({ queryKey: ['partner-ledger'] });
      qc.invalidateQueries({ queryKey: ['admin-tenant-credits'] });
      qc.invalidateQueries({ queryKey: ['tenant-wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-ledger'] });
    },
  });
}

export function useAdjustPartnerWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      partnerId,
      amount,
      description,
    }: {
      partnerId: string;
      amount: number;
      description: string;
    }) => {
      const { data, error } = await supabase.rpc('partner_wallet_adjust' as never, {
        _partner_id: partnerId,
        _amount: amount,
        _description: description,
      } as never);
      if (error) throw error;
      return data as unknown as PartnerWallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-wallet'] });
      qc.invalidateQueries({ queryKey: ['partner-wallets-all'] });
      qc.invalidateQueries({ queryKey: ['partner-ledger'] });
    },
  });
}