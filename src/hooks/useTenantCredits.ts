import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TenantCredits {
  // Total credits (monthly + accumulated + extra)
  message_credits: number;
  // Monthly/accumulated/extra breakdown
  monthly_credits_remaining: number;
  accumulated_credits: number;
  extra_credits: number;
  // Billing info
  billing_state: string;
  initial_credits_granted: boolean;
  plan: string;
  // Refill timestamps
  last_refill_at: string | null;
  next_refill_at: string | null;
  // Stripe fields
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  // Pending plan fields (for scheduled downgrades)
  pending_plan?: string | null;
  pending_stripe_price_id?: string | null;
  pending_plan_effective_at?: string | null;
}

/**
 * Calculate total credits from monthly + accumulated + extra
 */
export function getTotalCredits(credits: TenantCredits | null): number {
  if (!credits) return 0;
  return (credits.monthly_credits_remaining ?? 0) + (credits.accumulated_credits ?? 0) + (credits.extra_credits ?? 0);
}

/**
 * Hook to get the current tenant's credits from tenants table.
 * In support mode, this fetches the impersonated tenant's credits.
 * This is the single source of truth for credit balance.
 */
export function useTenantCredits() {
  const { profile, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Get support mode from sessionStorage (direct access to avoid circular context dependency)
  const supportModeData = useMemo(() => {
    if (!isSuperAdmin) return null;
    try {
      const stored = sessionStorage.getItem('noty5_support_mode');
      if (stored) {
        return JSON.parse(stored) as { tenantId: string; tenantName: string };
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, [isSuperAdmin]);

  // Use support mode tenant ID if available, otherwise use profile tenant ID
  const tenantId = supportModeData?.tenantId ?? profile?.tenant_id;

  const query = useQuery({
    queryKey: ['tenant-credits', tenantId],
    queryFn: async (): Promise<TenantCredits | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select(
          'message_credits, monthly_credits_remaining, accumulated_credits, extra_credits, billing_state, initial_credits_granted, plan, last_refill_at, next_refill_at, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, pending_plan, pending_stripe_price_id, pending_plan_effective_at'
        )
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      return data as TenantCredits;
    },
    enabled: !!tenantId,
  });

  // Realtime: refresh credits immediately when backend updates the tenant row
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`tenant-credits-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[Realtime] Tenant credits updated:', payload.new);
          const next = payload.new as TenantCredits;

          // Update cache instantly (and keep legacy wallet query in sync where still used)
          queryClient.setQueryData(['tenant-credits', tenantId], next);
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return query;
}

/**
 * Hook to get a specific tenant's credits (for admin use)
 */
export function useAdminTenantCredits(tenantId: string) {
  return useQuery({
    queryKey: ['tenant-credits', tenantId],
    queryFn: async (): Promise<TenantCredits | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select(
          'message_credits, monthly_credits_remaining, accumulated_credits, extra_credits, billing_state, initial_credits_granted, plan, last_refill_at, next_refill_at, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, pending_plan, pending_stripe_price_id, pending_plan_effective_at'
        )
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      return data as TenantCredits;
    },
    enabled: !!tenantId,
  });
}

/**
 * Get credit status label based on balance and billing state
 * Priority: credits > 0 means active/low, regardless of billing_state
 */
export function getCreditStatus(credits: number, billingState: string): 'active' | 'low' | 'blocked' {
  // If there are no credits, check billing state for subscription requirements
  if (credits <= 0) {
    return 'blocked';
  }
  // Credits exist - determine if low or active
  if (credits <= 100) {
    return 'low';
  }
  return 'active';
}

/**
 * Get credits for a plan (matches DB function get_plan_monthly_credits)
 */
export function getPlanMonthlyCredits(plan: string): number {
  switch (plan) {
    case 'trial':
      return 100;
    case 'starter':
      return 1000;
    case 'growth':
      return 3000;
    case 'pro':
      return 6000;
    case 'scale':
      return 12000;
    case 'enterprise':
      return 25000;
    default:
      return 0;
  }
}
