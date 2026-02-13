import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { usePipelineStageChange } from '@/hooks/usePipelineStageChange';

export interface PipelineSuggestion {
  id: string;
  tenant_id: string;
  conversation_id: string;
  contact_id: string;
  current_stage: string;
  suggested_stage: string;
  confidence: number;
  reasoning: string;
  status: string;
  created_at: string;
}

export function usePipelineSuggestion(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pipeline-suggestion', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('pipeline_stage_suggestions')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PipelineSuggestion | null;
    },
    enabled: !!conversationId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`pipeline-suggestion-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_stage_suggestions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pipeline-suggestion', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useAcceptPipelineSuggestion() {
  const queryClient = useQueryClient();
  const { handlePipelineStageChange } = usePipelineStageChange();

  return useMutation({
    mutationFn: async ({ suggestion }: { suggestion: PipelineSuggestion }) => {
      // 1. Update contact's pipeline stage
      const { error: contactError } = await supabase
        .from('contacts')
        .update({ pipeline_stage: suggestion.suggested_stage })
        .eq('id', suggestion.contact_id);

      if (contactError) throw contactError;

      // 2. Mark suggestion as accepted
      const { error: suggestionError } = await supabase
        .from('pipeline_stage_suggestions')
        .update({ 
          status: 'accepted', 
          resolved_at: new Date().toISOString(),
        })
        .eq('id', suggestion.id);

      if (suggestionError) throw suggestionError;

      // 3. Trigger conversion tracking
      await handlePipelineStageChange(
        suggestion.contact_id,
        suggestion.current_stage,
        suggestion.suggested_stage
      );
    },
    onSuccess: (_, { suggestion }) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-suggestion', suggestion.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['contact-pipeline', suggestion.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', suggestion.conversation_id] });
    },
  });
}

export function useDismissPipelineSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ suggestionId }: { suggestionId: string }) => {
      const { error } = await supabase
        .from('pipeline_stage_suggestions')
        .update({ 
          status: 'dismissed', 
          resolved_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-suggestion'] });
    },
  });
}

// Trigger AI analysis (called after each inbound message)
export function useTriggerPipelineAnalysis() {
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      conversationId, 
      contactId 
    }: { 
      tenantId: string; 
      conversationId: string; 
      contactId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-suggest-pipeline-stage', {
        body: {
          tenant_id: tenantId,
          conversation_id: conversationId,
          contact_id: contactId,
        },
      });

      if (error) {
        console.warn('Pipeline analysis error:', error);
        return null;
      }
      return data;
    },
  });
}
