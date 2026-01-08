import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TenantMetrics {
  tenantId: string;
  tenantName: string;
  plan: string;
  status: string;
  // Messages
  messagesInbound24h: number;
  messagesOutbound24h: number;
  messagesTotal: number;
  // AI
  aiInteractions24h: number;
  aiEscalations24h: number;
  aiResponseTimeAvg: number;
  // Conversations
  activeConversations: number;
  needsHumanCount: number;
  // Wallet
  walletBalance: number;
  walletStatus: 'active' | 'low' | 'blocked';
  walletConsumed24h: number;
  // Activity
  lastActivityAt: string | null;
  // Campaigns
  activeCampaigns: number;
  campaignsExecuted24h: number;
}

export interface AllTenantsMetrics {
  tenants: TenantMetrics[];
  totals: {
    totalTenants: number;
    activeTenants: number;
    totalMessages24h: number;
    totalAIInteractions24h: number;
    totalWalletBalance: number;
    tenantsWithLowWallet: number;
    tenantsNeedingAttention: number;
  };
  lastUpdated: string;
}

export function useTenantMetrics() {
  return useQuery({
    queryKey: ['admin-tenant-metrics'],
    queryFn: async (): Promise<AllTenantsMetrics> => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Get all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, plan, status')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      // 2. Get wallets for all tenants
      const { data: wallets } = await supabase
        .from('wallets')
        .select('tenant_id, balance_messages, status');

      const walletsMap = new Map(wallets?.map(w => [w.tenant_id, w]) || []);

      // 3. Get message counts per tenant (last 24h)
      const { data: messagesInbound } = await supabase
        .from('messages')
        .select('tenant_id')
        .eq('direction', 'inbound')
        .gte('created_at', last24h);

      const { data: messagesOutbound } = await supabase
        .from('messages')
        .select('tenant_id')
        .eq('direction', 'outbound')
        .gte('created_at', last24h);

      // Count by tenant
      const inboundByTenant = new Map<string, number>();
      const outboundByTenant = new Map<string, number>();
      
      messagesInbound?.forEach(m => {
        inboundByTenant.set(m.tenant_id, (inboundByTenant.get(m.tenant_id) || 0) + 1);
      });
      messagesOutbound?.forEach(m => {
        outboundByTenant.set(m.tenant_id, (outboundByTenant.get(m.tenant_id) || 0) + 1);
      });

      // 4. Get AI interactions per tenant (last 24h)
      const { data: aiLogs } = await supabase
        .from('ai_interaction_logs')
        .select('tenant_id, was_escalated, response_time_ms')
        .gte('created_at', last24h);

      const aiByTenant = new Map<string, { count: number; escalations: number; totalTime: number }>();
      aiLogs?.forEach(log => {
        const current = aiByTenant.get(log.tenant_id) || { count: 0, escalations: 0, totalTime: 0 };
        current.count++;
        if (log.was_escalated) current.escalations++;
        if (log.response_time_ms) current.totalTime += log.response_time_ms;
        aiByTenant.set(log.tenant_id, current);
      });

      // 5. Get conversations needing attention
      const { data: conversations } = await supabase
        .from('conversations')
        .select('tenant_id, status, needs_human, updated_at')
        .eq('status', 'open');

      const convByTenant = new Map<string, { active: number; needsHuman: number; lastActivity: string | null }>();
      conversations?.forEach(c => {
        const current = convByTenant.get(c.tenant_id) || { active: 0, needsHuman: 0, lastActivity: null };
        current.active++;
        if (c.needs_human) current.needsHuman++;
        if (!current.lastActivity || c.updated_at > current.lastActivity) {
          current.lastActivity = c.updated_at;
        }
        convByTenant.set(c.tenant_id, current);
      });

      // 6. Get wallet transactions (last 24h)
      const { data: transactions } = await supabase
        .from('wallet_transactions')
        .select('tenant_id, messages, type')
        .eq('type', 'debit')
        .gte('created_at', last24h);

      const txByTenant = new Map<string, number>();
      transactions?.forEach(tx => {
        txByTenant.set(tx.tenant_id, (txByTenant.get(tx.tenant_id) || 0) + tx.messages);
      });

      // 7. Get active campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('tenant_id, status, started_at')
        .in('status', ['sending', 'scheduled', 'paused']);

      const campaignsByTenant = new Map<string, { active: number; executed24h: number }>();
      campaigns?.forEach(c => {
        const current = campaignsByTenant.get(c.tenant_id) || { active: 0, executed24h: 0 };
        if (['sending', 'scheduled', 'paused'].includes(c.status)) current.active++;
        if (c.started_at && c.started_at >= last24h) current.executed24h++;
        campaignsByTenant.set(c.tenant_id, current);
      });

      // 8. Get total messages per tenant (for ranking)
      const { data: totalMessages } = await supabase
        .from('messages')
        .select('tenant_id');

      const totalMsgByTenant = new Map<string, number>();
      totalMessages?.forEach(m => {
        totalMsgByTenant.set(m.tenant_id, (totalMsgByTenant.get(m.tenant_id) || 0) + 1);
      });

      // Build tenant metrics
      const tenantMetrics: TenantMetrics[] = (tenants || []).map(t => {
        const wallet = walletsMap.get(t.id);
        const aiStats = aiByTenant.get(t.id) || { count: 0, escalations: 0, totalTime: 0 };
        const convStats = convByTenant.get(t.id) || { active: 0, needsHuman: 0, lastActivity: null };
        const campaignStats = campaignsByTenant.get(t.id) || { active: 0, executed24h: 0 };

        return {
          tenantId: t.id,
          tenantName: t.name,
          plan: t.plan,
          status: t.status,
          messagesInbound24h: inboundByTenant.get(t.id) || 0,
          messagesOutbound24h: outboundByTenant.get(t.id) || 0,
          messagesTotal: totalMsgByTenant.get(t.id) || 0,
          aiInteractions24h: aiStats.count,
          aiEscalations24h: aiStats.escalations,
          aiResponseTimeAvg: aiStats.count > 0 ? Math.round(aiStats.totalTime / aiStats.count) : 0,
          activeConversations: convStats.active,
          needsHumanCount: convStats.needsHuman,
          walletBalance: wallet?.balance_messages || 0,
          walletStatus: (wallet?.status as 'active' | 'low' | 'blocked') || 'blocked',
          walletConsumed24h: txByTenant.get(t.id) || 0,
          lastActivityAt: convStats.lastActivity,
          activeCampaigns: campaignStats.active,
          campaignsExecuted24h: campaignStats.executed24h,
        };
      });

      // Sort by activity (messages in last 24h)
      tenantMetrics.sort((a, b) => 
        (b.messagesInbound24h + b.messagesOutbound24h) - (a.messagesInbound24h + a.messagesOutbound24h)
      );

      // Calculate totals
      const totals = {
        totalTenants: tenantMetrics.length,
        activeTenants: tenantMetrics.filter(t => t.status === 'active').length,
        totalMessages24h: tenantMetrics.reduce((sum, t) => sum + t.messagesInbound24h + t.messagesOutbound24h, 0),
        totalAIInteractions24h: tenantMetrics.reduce((sum, t) => sum + t.aiInteractions24h, 0),
        totalWalletBalance: tenantMetrics.reduce((sum, t) => sum + t.walletBalance, 0),
        tenantsWithLowWallet: tenantMetrics.filter(t => t.walletStatus === 'low' || t.walletStatus === 'blocked').length,
        tenantsNeedingAttention: tenantMetrics.filter(t => t.needsHumanCount > 0 || t.walletStatus === 'blocked').length,
      };

      return {
        tenants: tenantMetrics,
        totals,
        lastUpdated: new Date().toISOString(),
      };
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  });
}
