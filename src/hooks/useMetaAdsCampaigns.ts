import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MetaAdsCampaign {
  id: string;
  tenant_id: string;
  property_id: string | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_ad_id: string | null;
  meta_form_id: string | null;
  name: string;
  objective: string;
  campaign_objective: "LEAD_GENERATION" | "MESSAGES";
  whatsapp_phone_number: string | null;
  facebook_page_id: string | null;
  headline: string;
  primary_text: string;
  description: string | null;
  cta_type: string | null;
  age_min: number | null;
  age_max: number | null;
  genders: string[] | null;
  geo_locations: any;
  interests: any;
  daily_budget_cents: number | null;
  image_url: string | null;
  lead_form_fields: any;
  status: "draft" | "review" | "publishing" | "active" | "paused" | "error";
  publish_error: string | null;
  ai_generated_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  properties?: {
    title: string;
    zone: string;
    property_images: Array<{ file_url: string; is_cover: boolean }>;
  } | null;
}

export function useMetaAdsCampaigns() {
  return useQuery({
    queryKey: ["meta-ads-campaigns"],
    queryFn: async (): Promise<MetaAdsCampaign[]> => {
      const { data, error } = await supabase
        .from("meta_ads_campaigns")
        .select(
          "*, properties(title, zone, property_images(file_url, is_cover))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as MetaAdsCampaign[]) ?? [];
    },
  });
}