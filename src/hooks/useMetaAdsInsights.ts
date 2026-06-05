import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DateRange {
  preset?: "today" | "last_7d" | "last_30d";
  start?: string;
  end?: string;
}

export interface CampaignInsights {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpm: number;
  cpc: number;
  ctr: number;
  leads: number;
  messages_started: number;
  cost_per_result: number | null;
  date_start: string | null;
  date_stop: string | null;
  currency: string;
}

export interface CampaignInsightsResponse {
  campaign_id: string;
  meta_campaign_id: string;
  objective: "LEAD_GENERATION" | "MESSAGES";
  insights: CampaignInsights | null;
  error?: string;
}

export interface SummaryInsightsResponse {
  campaigns: Array<{
    campaign_id: string;
    name: string;
    objective: "LEAD_GENERATION" | "MESSAGES";
    status: string;
    insights: CampaignInsights | null;
  }>;
  totals: {
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
    messages_started: number;
  };
}

export function useCampaignInsights(
  campaignId: string | null,
  dateRange: DateRange,
) {
  return useQuery({
    queryKey: ["meta-ads-insights", "campaign", campaignId, dateRange],
    queryFn: async (): Promise<CampaignInsightsResponse | null> => {
      if (!campaignId) return null;
      const { data, error } = await supabase.functions.invoke(
        "meta-ads-insights",
        {
          body: {
            scope: "campaign",
            campaign_id: campaignId,
            date_preset: dateRange.preset,
            date_start: dateRange.start,
            date_end: dateRange.end,
          },
        },
      );
      if (error) throw error;
      return data as CampaignInsightsResponse;
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSummaryInsights(
  dateRange: DateRange,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["meta-ads-insights", "summary", dateRange],
    queryFn: async (): Promise<SummaryInsightsResponse> => {
      const { data, error } = await supabase.functions.invoke(
        "meta-ads-insights",
        {
          body: {
            scope: "summary",
            date_preset: dateRange.preset,
            date_start: dateRange.start,
            date_end: dateRange.end,
          },
        },
      );
      if (error) {
        return {
          campaigns: [],
          totals: {
            impressions: 0,
            clicks: 0,
            spend: 0,
            leads: 0,
            messages_started: 0,
          },
        };
      }
      return data as SummaryInsightsResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}