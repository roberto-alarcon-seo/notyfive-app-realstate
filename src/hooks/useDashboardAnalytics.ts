import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  subDays, 
  format, 
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  differenceInDays
} from "date-fns";

export interface DailyMetric {
  date: string;
  label: string;
  conversations: number;
  messagesSent: number;
  responses: number;
  delivered: number;
}

export interface DashboardAnalytics {
  // Current period stats
  conversationsGenerated: number;
  conversationsPreviousMonth: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalResponses: number;
  responseRate: number;
  responseRatePreviousMonth: number;
  creditsRemaining: number;
  creditsUsedThisMonth: number;
  estimatedDaysLeft: number;
  
  // Campaign stats
  activeCampaigns: number;
  completedCampaigns: number;
  draftCampaigns: number;
  totalOptOuts: number;
  optOutRate: number;
  
  // Contact stats
  totalContacts: number;
  activeContacts: number;
  newContactsThisMonth: number;
  
  // Inbox stats
  openConversations: number;
  unreadMessages: number;
  avgResponseTimeMinutes: number;
  aiResponsesCount: number;
  humanResponsesCount: number;
  
  // Template stats
  approvedTemplates: number;
  pendingTemplates: number;
  rejectedTemplates: number;
  
  // Time series data for charts
  dailyMetrics: DailyMetric[];
  
  // Top performing
  topCampaignName: string | null;
  topCampaignResponseRate: number;
  worstCampaignName: string | null;
  worstCampaignResponseRate: number;
  
  // Date range info
  periodDays: number;
  periodStart: Date;
  periodEnd: Date;
}

interface DateRangeInput {
  from?: Date;
  to?: Date;
}

export function useDashboardAnalytics(dateRange?: DateRangeInput) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  // Calculate dates based on input or default to last 30 days
  const now = new Date();
  const startDate = dateRange?.from || subDays(now, 30);
  const endDate = dateRange?.to || now;
  const days = differenceInDays(endDate, startDate) || 30;

  return useQuery({
    queryKey: ["dashboard-analytics", tenantId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<DashboardAnalytics> => {
      if (!tenantId) throw new Error("No tenant ID");

      // For comparison, use the same length period before
      const previousPeriodEnd = subDays(startDate, 1);
      const previousPeriodStart = subDays(previousPeriodEnd, days);
      
      // Also get current month for credits calculation
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);

      // Parallel queries for better performance
      const [
        conversationsCurrentPeriod,
        conversationsPrevPeriod,
        messagesCurrentPeriod,
        messagesPrevPeriod,
        wallet,
        walletTransactions,
        campaigns,
        contacts,
        conversations,
        templates,
        allMessages,
      ] = await Promise.all([
        // Current period conversations
        supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        
        // Previous period conversations (for comparison)
        supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", previousPeriodStart.toISOString())
          .lte("created_at", previousPeriodEnd.toISOString()),
        
        // Current period messages
        supabase
          .from("messages")
          .select("id, direction, status, ai_generated, source, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        
        // Previous period messages for comparison
        supabase
          .from("messages")
          .select("id, direction, status")
          .eq("tenant_id", tenantId)
          .gte("created_at", previousPeriodStart.toISOString())
          .lte("created_at", previousPeriodEnd.toISOString()),
        
        // Wallet
        supabase
          .from("wallets")
          .select("balance_messages")
          .eq("tenant_id", tenantId)
          .single(),
        
        // Wallet transactions this month
        supabase
          .from("wallet_transactions")
          .select("messages, type")
          .eq("tenant_id", tenantId)
          .eq("type", "debit")
          .gte("created_at", currentMonthStart.toISOString()),
        
        // All campaigns
        supabase
          .from("campaigns")
          .select("id, name, status, delivered_count, sent_count")
          .eq("tenant_id", tenantId),
        
        // All contacts
        supabase
          .from("contacts")
          .select("id, status, created_at")
          .eq("tenant_id", tenantId),
        
        // Open conversations
        supabase
          .from("conversations")
          .select("id, status, unread_count")
          .eq("tenant_id", tenantId)
          .eq("status", "open"),
        
        // Templates
        supabase
          .from("templates")
          .select("id, approval_status")
          .eq("tenant_id", tenantId),
        
        // All messages for the selected period (for charts)
        supabase
          .from("messages")
          .select("id, direction, status, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: true }),
      ]);

      // Process messages
      const currentMessages = messagesCurrentPeriod.data || [];
      const prevMessages = messagesPrevPeriod.data || [];
      
      const outboundCurrent = currentMessages.filter(m => m.direction === "outbound");
      const inboundCurrent = currentMessages.filter(m => m.direction === "inbound");
      const deliveredCurrent = outboundCurrent.filter(m => ["delivered", "read"].includes(m.status));
      
      const outboundPrev = prevMessages.filter(m => m.direction === "outbound");
      const inboundPrev = prevMessages.filter(m => m.direction === "inbound");
      const deliveredPrev = outboundPrev.filter(m => ["delivered", "read"].includes(m.status));
      
      const responseRate = deliveredCurrent.length > 0 
        ? (inboundCurrent.length / deliveredCurrent.length) * 100 
        : 0;
      
      const prevResponseRate = deliveredPrev.length > 0 
        ? (inboundPrev.length / deliveredPrev.length) * 100 
        : 0;

      // AI vs Human responses
      const aiResponses = outboundCurrent.filter(m => m.ai_generated);
      const humanResponses = outboundCurrent.filter(m => !m.ai_generated && m.source === "manual");

      // Process campaigns
      const campaignsList = campaigns.data || [];
      const activeCampaigns = campaignsList.filter(c => c.status === "sending").length;
      const completedCampaigns = campaignsList.filter(c => c.status === "completed").length;
      const draftCampaigns = campaignsList.filter(c => c.status === "draft").length;

      // Get campaign stats for opt-outs
      const { data: campaignStats } = await supabase
        .from("campaign_stats")
        .select("opt_outs, responses, messages_delivered, campaign_id")
        .eq("tenant_id", tenantId);

      const totalOptOuts = campaignStats?.reduce((sum, s) => sum + (s.opt_outs || 0), 0) || 0;
      const totalDeliveredForOptOut = campaignStats?.reduce((sum, s) => sum + (s.messages_delivered || 0), 0) || 0;
      const optOutRate = totalDeliveredForOptOut > 0 ? (totalOptOuts / totalDeliveredForOptOut) * 100 : 0;

      // Find top and worst campaigns
      let topCampaign = { name: null as string | null, rate: 0 };
      let worstCampaign = { name: null as string | null, rate: 100 };
      
      if (campaignStats && campaignStats.length > 0) {
        campaignStats.forEach(stat => {
          if (stat.messages_delivered > 0) {
            const rate = (stat.responses / stat.messages_delivered) * 100;
            const campaign = campaignsList.find(c => c.id === stat.campaign_id);
            if (campaign) {
              if (rate > topCampaign.rate) {
                topCampaign = { name: campaign.name, rate };
              }
              if (rate < worstCampaign.rate) {
                worstCampaign = { name: campaign.name, rate };
              }
            }
          }
        });
      }

      // Process contacts
      const contactsList = contacts.data || [];
      const activeContacts = contactsList.filter(c => c.status === "active").length;
      const newContactsThisPeriod = contactsList.filter(c => 
        new Date(c.created_at) >= startDate && new Date(c.created_at) <= endDate
      ).length;

      // Process conversations
      const openConvs = conversations.data || [];
      const unreadMessages = openConvs.reduce((sum, c) => sum + (c.unread_count || 0), 0);

      // Process templates
      const templatesList = templates.data || [];
      const approvedTemplates = templatesList.filter(t => t.approval_status === "approved").length;
      const pendingTemplates = templatesList.filter(t => t.approval_status === "pending").length;
      const rejectedTemplates = templatesList.filter(t => t.approval_status === "rejected").length;

      // Process wallet
      const creditsUsedThisMonth = walletTransactions.data?.reduce((sum, t) => sum + t.messages, 0) || 0;
      const avgDailyUsage = creditsUsedThisMonth / Math.max(now.getDate(), 1);
      const estimatedDaysLeft = avgDailyUsage > 0 
        ? Math.floor((wallet.data?.balance_messages || 0) / avgDailyUsage)
        : 999;

      // Build daily metrics for charts
      const chartDateRange = eachDayOfInterval({ start: startDate, end: endDate });
      const messagesForChart = allMessages.data || [];
      
      const dailyMetrics: DailyMetric[] = chartDateRange.map(date => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const dayMessages = messagesForChart.filter(m => {
          const msgDate = new Date(m.created_at);
          return msgDate >= dayStart && msgDate <= dayEnd;
        });
        
        const outbound = dayMessages.filter(m => m.direction === "outbound");
        const inbound = dayMessages.filter(m => m.direction === "inbound");
        const delivered = outbound.filter(m => ["delivered", "read"].includes(m.status));
        
        return {
          date: format(date, "yyyy-MM-dd"),
          label: format(date, "dd MMM"),
          conversations: inbound.length > 0 ? 1 : 0, // Simplified - count days with activity
          messagesSent: outbound.length,
          responses: inbound.length,
          delivered: delivered.length,
        };
      });

      // Aggregate daily conversations properly
      const { data: dailyConversations } = await supabase
        .from("conversations")
        .select("id, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", startDate.toISOString());

      dailyMetrics.forEach(metric => {
        const dayConvs = dailyConversations?.filter(c => {
          const convDate = format(new Date(c.created_at), "yyyy-MM-dd");
          return convDate === metric.date;
        });
        metric.conversations = dayConvs?.length || 0;
      });

      return {
        conversationsGenerated: conversationsCurrentPeriod.count || 0,
        conversationsPreviousMonth: conversationsPrevPeriod.count || 0,
        totalMessagesSent: outboundCurrent.length,
        totalMessagesDelivered: deliveredCurrent.length,
        totalResponses: inboundCurrent.length,
        responseRate: Math.round(responseRate * 10) / 10,
        responseRatePreviousMonth: Math.round(prevResponseRate * 10) / 10,
        creditsRemaining: wallet.data?.balance_messages || 0,
        creditsUsedThisMonth,
        estimatedDaysLeft: Math.min(estimatedDaysLeft, 999),
        
        activeCampaigns,
        completedCampaigns,
        draftCampaigns,
        totalOptOuts,
        optOutRate: Math.round(optOutRate * 100) / 100,
        
        totalContacts: contactsList.length,
        activeContacts,
        newContactsThisMonth: newContactsThisPeriod,
        
        openConversations: openConvs.length,
        unreadMessages,
        avgResponseTimeMinutes: 0, // TODO: Calculate properly
        aiResponsesCount: aiResponses.length,
        humanResponsesCount: humanResponses.length,
        
        approvedTemplates,
        pendingTemplates,
        rejectedTemplates,
        
        dailyMetrics,
        
        topCampaignName: topCampaign.name,
        topCampaignResponseRate: Math.round(topCampaign.rate * 10) / 10,
        worstCampaignName: worstCampaign.name,
        worstCampaignResponseRate: Math.round(worstCampaign.rate * 10) / 10,
        
        // Date range info
        periodDays: days,
        periodStart: startDate,
        periodEnd: endDate,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}
