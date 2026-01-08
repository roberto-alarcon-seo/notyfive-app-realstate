import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * @deprecated Use useTenantCredits from '@/hooks/useTenantCredits' instead.
 * The wallet table is being phased out in favor of tenants.message_credits.
 */
export interface Wallet {
  id: string;
  tenant_id: string;
  balance_messages: number;
  status: 'active' | 'low' | 'blocked';
  low_threshold: number;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Legacy transaction interface. Use wallet_ledger instead.
 */
export interface WalletTransaction {
  id: string;
  tenant_id: string;
  wallet_id: string;
  type: 'topup' | 'debit';
  messages: number;
  reason: 'inbound_message' | 'outbound_message' | 'campaign_message' | 'template_message' | 'manual_adjustment';
  meta: Record<string, unknown> | null;
  created_at: string;
}

/**
 * @deprecated Use useTenantCredits from '@/hooks/useTenantCredits' instead.
 * Hook to get wallet for current user's tenant
 */
export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as Wallet | null;
    },
  });
}

/**
 * @deprecated Use useAdminTenantCredits from '@/hooks/useTenantCredits' instead.
 * Hook to get wallet for a specific tenant (admin use)
 */
export function useTenantWallet(tenantId: string) {
  return useQuery({
    queryKey: ['wallet', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as Wallet | null;
    },
    enabled: !!tenantId,
  });
}

/**
 * @deprecated Use wallet_ledger queries instead for transaction history.
 * Hook to get wallet transactions for a specific tenant (admin use)
 */
export function useTenantWalletTransactions(tenantId: string, limit = 20) {
  return useQuery({
    queryKey: ['wallet-transactions', tenantId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as WalletTransaction[];
    },
    enabled: !!tenantId,
  });
}

// Mutation to add messages to wallet (admin only)
// This adds credits to the accumulated_credits (rollover bucket)
export function useAddMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      walletId, 
      messages, 
      reason = 'manual_adjustment',
      meta = {} 
    }: { 
      tenantId: string; 
      walletId: string; 
      messages: number;
      reason?: 'manual_adjustment';
      meta?: Record<string, unknown>;
    }) => {
      // First, create the transaction in wallet_transactions (legacy)
      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          tenant_id: tenantId,
          wallet_id: walletId,
          type: 'topup',
          messages,
          reason,
          meta,
        } as never);

      if (txError) throw txError;

      // Get current tenant credits
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('monthly_credits_remaining, accumulated_credits, message_credits')
        .eq('id', tenantId)
        .single();

      if (tenantError) throw tenantError;

      // Add to accumulated credits (manual adjustments go to rollover bucket)
      const newAccumulated = (tenant.accumulated_credits || 0) + messages;
      const newTotal = (tenant.monthly_credits_remaining || 0) + newAccumulated;

      // Update tenants with new credit structure and set billing_state to ACTIVE_WITH_CREDITS
      const { error: tenantUpdateError } = await supabase
        .from('tenants')
        .update({ 
          accumulated_credits: newAccumulated,
          message_credits: newTotal,
          billing_state: 'ACTIVE_WITH_CREDITS',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (tenantUpdateError) throw tenantUpdateError;

      // Also update wallet for legacy compatibility
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance_messages: newTotal })
        .eq('id', walletId);

      if (updateError) throw updateError;

      return { newBalance: newTotal };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-credits', variables.tenantId] });
      toast.success(`Se agregaron ${variables.messages} créditos`);
    },
    onError: (error) => {
      console.error('Error adding messages:', error);
      toast.error('Error al agregar créditos');
    },
  });
}

// Function to check if wallet has sufficient balance
export async function checkWalletBalance(tenantId: string): Promise<boolean> {
  const { data: wallet, error } = await supabase
    .from('wallets')
    .select('balance_messages, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !wallet) return false;
  return wallet.balance_messages > 0 && wallet.status !== 'blocked';
}

// Function to debit a message from wallet
export async function debitMessage(
  tenantId: string,
  reason: 'inbound_message' | 'outbound_message' | 'campaign_message' | 'template_message',
  meta?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (walletError || !wallet) {
      return { success: false, error: 'Wallet no encontrado' };
    }

    if (wallet.balance_messages <= 0) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    // Create debit transaction
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        tenant_id: tenantId,
        wallet_id: wallet.id,
        type: 'debit',
        messages: 1,
        reason,
        meta,
      } as never);

    if (txError) {
      return { success: false, error: 'Error al registrar transacción' };
    }

    // Update balance
    const newBalance = wallet.balance_messages - 1;
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance_messages: newBalance })
      .eq('id', wallet.id);

    if (updateError) {
      return { success: false, error: 'Error al actualizar saldo' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error debiting message:', error);
    return { success: false, error: 'Error interno' };
  }
}
