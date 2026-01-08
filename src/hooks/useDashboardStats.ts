import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

interface DashboardStats {
  conversationsGenerated: number;
  conversationsPreviousMonth: number;
  responseRate: number;
  responseRatePreviousMonth: number;
  costPerConversation: number;
  costPerConversationPreviousMonth: number;
  creditsRemaining: number;
  estimatedDaysLeft: number;
}

export function useDashboardStats() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ["dashboard-stats", tenantId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!tenantId) throw new Error("No tenant ID");

      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      // Get conversations for current month
      const { count: currentConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", currentMonthStart.toISOString())
        .lte("created_at", currentMonthEnd.toISOString());

      // Get conversations for previous month
      const { count: previousConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", previousMonthStart.toISOString())
        .lte("created_at", previousMonthEnd.toISOString());

      // Get messages delivered this month
      const { count: messagesDelivered } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .in("status", ["delivered", "read"])
        .gte("created_at", currentMonthStart.toISOString())
        .lte("created_at", currentMonthEnd.toISOString());

      // Get inbound messages (responses) this month
      const { count: responses } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "inbound")
        .gte("created_at", currentMonthStart.toISOString())
        .lte("created_at", currentMonthEnd.toISOString());

      // Previous month messages
      const { count: prevMessagesDelivered } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .in("status", ["delivered", "read"])
        .gte("created_at", previousMonthStart.toISOString())
        .lte("created_at", previousMonthEnd.toISOString());

      const { count: prevResponses } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "inbound")
        .gte("created_at", previousMonthStart.toISOString())
        .lte("created_at", previousMonthEnd.toISOString());

      // Get tenant credits (single source of truth)
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("message_credits")
        .eq("id", tenantId)
        .single();

      // Get campaign stats for cost calculation
      const { data: campaignStats } = await supabase
        .from("campaign_stats")
        .select("cost_estimated, responses")
        .eq("tenant_id", tenantId);

      const totalCost = campaignStats?.reduce((sum, s) => sum + Number(s.cost_estimated || 0), 0) || 0;
      const totalResponses = campaignStats?.reduce((sum, s) => sum + (s.responses || 0), 0) || 0;

      // Calculate response rates
      const responseRate = messagesDelivered && messagesDelivered > 0 
        ? ((responses || 0) / messagesDelivered) * 100 
        : 0;
      
      const prevResponseRate = prevMessagesDelivered && prevMessagesDelivered > 0 
        ? ((prevResponses || 0) / prevMessagesDelivered) * 100 
        : 0;

      // Calculate cost per conversation
      const costPerConversation = currentConversations && currentConversations > 0 
        ? totalCost / currentConversations 
        : 0;

      // Calculate estimated days left based on daily usage
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const avgDailyUsage = (messagesDelivered || 0) / dayOfMonth;
      const estimatedDaysLeft = avgDailyUsage > 0 
        ? Math.floor((tenantData?.message_credits || 0) / avgDailyUsage)
        : 999;

      return {
        conversationsGenerated: currentConversations || 0,
        conversationsPreviousMonth: previousConversations || 0,
        responseRate: Math.round(responseRate * 10) / 10,
        responseRatePreviousMonth: Math.round(prevResponseRate * 10) / 10,
        costPerConversation: Math.round(costPerConversation * 100) / 100,
        costPerConversationPreviousMonth: 0,
        creditsRemaining: tenantData?.message_credits || 0,
        estimatedDaysLeft: Math.min(estimatedDaysLeft, 999),
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });
}
