import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ContactActivityEvent {
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

export function useContactActivity(contactId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['contact-activity', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('conversation_activity')
        .select(`
          *,
          actor_user:profiles(id, name)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ContactActivityEvent[];
    },
    enabled: !!contactId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`contact-activity-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_activity',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['contact-activity', contactId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, queryClient]);

  return query;
}
