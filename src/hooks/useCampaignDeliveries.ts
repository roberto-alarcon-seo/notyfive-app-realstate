import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignDelivery {
  id: string;
  tenant_id: string;
  campaign_id: string;
  contact_id: string;
  conversation_id: string | null;
  message_id: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped';
  skipped_reason: string | null;
  provider_message_sid: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  campaign?: {
    id: string;
    name: string;
  };
}

export function useCampaignDeliveriesForContact(contactId: string | null) {
  return useQuery({
    queryKey: ['campaign-deliveries', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(`
          *,
          campaign:campaigns(id, name)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as CampaignDelivery[];
    },
    enabled: !!contactId,
  });
}

export function useCampaignDeliveriesForCampaign(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-deliveries-campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(`
          *,
          contact:contacts(id, name, phone)
        `)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}
