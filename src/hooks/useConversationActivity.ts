import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ConversationActivityEvent {
  id: string;
  tenant_id: string;
  conversation_id: string;
  contact_id: string;
  actor_user_id: string | null;
  actor_type: 'system' | 'user' | 'ai';
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor_user?: {
    id: string;
    name: string;
  };
}

export function useConversationActivity(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversation-activity', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('conversation_activity')
        .select(`
          *,
          actor_user:profiles(id, name)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ConversationActivityEvent[];
    },
    enabled: !!conversationId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`activity-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_activity',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-activity', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}
