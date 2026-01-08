import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  template_id: string | null;
  segment_id: string | null;
  audience_type: string;
  audience_filters: Record<string, unknown>;
  variable_mapping: Record<string, string>;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  pause_reason: string | null;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  template?: {
    id: string;
    name: string;
    category: string;
    body: string;
  } | null;
  segment?: {
    id: string;
    name: string;
  } | null;
}

export interface CampaignFormData {
  name: string;
  description?: string;
  campaign_type: string;
  template_id: string;
  segment_id?: string;
  audience_type: string;
  audience_filters?: Record<string, unknown>;
  variable_mapping: Record<string, string>;
  scheduled_at?: string;
}

export function useCampaigns(statusFilter?: string) {
  const queryClient = useQueryClient();

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('campaigns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
        },
        (payload) => {
          console.log('[Realtime] Campaign update:', payload);
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['campaigns', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          template:templates(id, name, category, body),
          segment:segments(id, name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Campaign[];
    },
  });
}

export function useCampaign(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          template:templates(id, name, category, body, variables),
          segment:segments(id, name)
        `)
        .eq('id', campaignId)
        .single();

      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CampaignFormData) => {
      // First get the user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.tenant_id) throw new Error('No tenant ID found');

      const { data: result, error } = await supabase
        .from('campaigns')
        .insert({
          tenant_id: profile.tenant_id,
          name: data.name,
          description: data.description || null,
          campaign_type: data.campaign_type,
          template_id: data.template_id,
          segment_id: data.segment_id || null,
          audience_type: data.audience_type,
          audience_filters: data.audience_filters || {},
          variable_mapping: data.variable_mapping,
          scheduled_at: data.scheduled_at || null,
          status: data.scheduled_at ? 'scheduled' : 'draft',
        } as never)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaña creada exitosamente');
    },
    onError: (error) => {
      console.error('Error creating campaign:', error);
      toast.error('Error al crear la campaña');
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CampaignFormData> }) => {
      const { error } = await supabase
        .from('campaigns')
        .update(data as never)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      toast.success('Campaña actualizada');
    },
    onError: (error) => {
      console.error('Error updating campaign:', error);
      toast.error('Error al actualizar la campaña');
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaña eliminada');
    },
    onError: (error) => {
      console.error('Error deleting campaign:', error);
      toast.error('Error al eliminar la campaña');
    },
  });
}

export function useDuplicateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Campaign) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: `${campaign.name} (copia)`,
          description: campaign.description,
          campaign_type: campaign.campaign_type,
          template_id: campaign.template_id,
          segment_id: campaign.segment_id,
          audience_type: campaign.audience_type,
          audience_filters: campaign.audience_filters,
          variable_mapping: campaign.variable_mapping,
          status: 'draft',
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaña duplicada');
    },
    onError: (error) => {
      console.error('Error duplicating campaign:', error);
      toast.error('Error al duplicar la campaña');
    },
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('execute-campaign', {
        body: { campaignId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      toast.success('Campaña iniciada');
    },
    onError: (error: Error) => {
      console.error('Error starting campaign:', error);
      toast.error(error.message || 'Error al iniciar la campaña');
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ 
          status: 'paused',
          paused_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      if (error) throw error;
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Campaña pausada');
    },
    onError: (error) => {
      console.error('Error pausing campaign:', error);
      toast.error('Error al pausar la campaña');
    },
  });
}

export function useResumeCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('execute-campaign', {
        body: { campaignId, resume: true },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Campaña reanudada');
    },
    onError: (error: Error) => {
      console.error('Error resuming campaign:', error);
      toast.error(error.message || 'Error al reanudar la campaña');
    },
  });
}

// Calculate audience count
export async function calculateAudienceCount(
  audienceType: string,
  segmentId?: string,
  filters?: Record<string, unknown>
): Promise<number> {
  if (audienceType === 'segment' && segmentId) {
    // First, get the segment to determine its type
    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('id, type, rules_json')
      .eq('id', segmentId)
      .maybeSingle();

    if (segmentError) throw segmentError;
    if (!segment) return 0;

    if (segment.type === 'static') {
      // For static segments, count from segment_contacts
      const { count, error } = await supabase
        .from('segment_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('segment_id', segmentId);

      if (error) throw error;
      return count || 0;
    } else {
      // For dynamic segments, evaluate rules against contacts
      const rules = segment.rules_json as { conditions?: Array<{ field: string; operator: string; value: unknown; fieldType?: string }> } | null;
      
      if (!rules || !rules.conditions || rules.conditions.length === 0) {
        // No rules, return all active contacts with phone
        const { count, error } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .not('phone', 'is', null);

        if (error) throw error;
        return count || 0;
      }

      // Apply dynamic rules
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('phone', 'is', null);

      const baseConditions = rules.conditions.filter((c) => c.fieldType === 'base');

      for (const condition of baseConditions) {
        query = applyDynamicCondition(query, condition);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  }

  // For 'all', count all contacts with phone
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .not('phone', 'is', null);

  if (filters) {
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags as string[]);
    }
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

// Helper function to apply dynamic segment conditions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDynamicCondition(
  query: any,
  condition: { field: string; operator: string; value: unknown }
) {
  const { field, operator, value } = condition;

  switch (operator) {
    case 'equals':
      return query.eq(field, value);
    case 'not_equals':
      return query.neq(field, value);
    case 'contains':
      return query.ilike(field, `%${value}%`);
    case 'not_contains':
      return query.not(field, 'ilike', `%${value}%`);
    case 'starts_with':
      return query.ilike(field, `${value}%`);
    case 'ends_with':
      return query.ilike(field, `%${value}`);
    case 'is_empty':
      return query.is(field, null);
    case 'is_not_empty':
      return query.not(field, 'is', null);
    case 'greater_than':
      return query.gt(field, value);
    case 'greater_or_equal':
      return query.gte(field, value);
    case 'less_than':
      return query.lt(field, value);
    case 'less_or_equal':
      return query.lte(field, value);
    case 'before':
      return query.lt(field, value);
    case 'after':
      return query.gt(field, value);
    case 'contains_tag':
      return query.contains(field, [value]);
    case 'not_contains_tag':
      return query.not(field, 'cs', `{${value}}`);
    default:
      return query;
  }
}
