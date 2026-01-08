import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay } from "date-fns";

interface InboxActivity {
  pendingConversations: number;
  avgFirstResponseTime: number; // in minutes
  attendedToday: number;
  aiPercentage: number;
  humanPercentage: number;
}

export function useInboxActivity() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ["inbox-activity", tenantId],
    queryFn: async (): Promise<InboxActivity> => {
      if (!tenantId) throw new Error("No tenant ID");

      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      // Get pending conversations (open with unread messages)
      const { count: pendingConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .gt("unread_count", 0);

      // Get conversations attended today
      const { count: attendedToday } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("last_agent_message_at", todayStart.toISOString())
        .lte("last_agent_message_at", todayEnd.toISOString());

      // Get AI vs Human messages today
      const { count: aiMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .eq("ai_generated", true)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      const { count: humanMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .eq("ai_generated", false)
        .eq("source", "manual")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      const totalOutbound = (aiMessages || 0) + (humanMessages || 0);
      const aiPercentage = totalOutbound > 0 ? ((aiMessages || 0) / totalOutbound) * 100 : 0;
      const humanPercentage = totalOutbound > 0 ? ((humanMessages || 0) / totalOutbound) * 100 : 0;

      // Calculate average first response time
      // Get conversations with both customer and agent messages
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, last_customer_message_at, last_agent_message_at")
        .eq("tenant_id", tenantId)
        .not("last_customer_message_at", "is", null)
        .not("last_agent_message_at", "is", null)
        .gte("created_at", todayStart.toISOString())
        .limit(100);

      let avgResponseTime = 0;
      if (conversations && conversations.length > 0) {
        const responseTimes = conversations
          .filter((c) => c.last_customer_message_at && c.last_agent_message_at)
          .map((c) => {
            const customerTime = new Date(c.last_customer_message_at!).getTime();
            const agentTime = new Date(c.last_agent_message_at!).getTime();
            return agentTime > customerTime ? (agentTime - customerTime) / 60000 : 0;
          })
          .filter((t) => t > 0);

        if (responseTimes.length > 0) {
          avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        }
      }

      return {
        pendingConversations: pendingConversations || 0,
        avgFirstResponseTime: Math.round(avgResponseTime),
        attendedToday: attendedToday || 0,
        aiPercentage: Math.round(aiPercentage),
        humanPercentage: Math.round(humanPercentage),
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
