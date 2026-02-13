import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MarkAttendedParams {
  conversationId: string;
  contactId: string;
  note?: string | null;
}

export function useMarkAttended() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, contactId, note }: MarkAttendedParams) => {
      // Get tenant_id from the conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('tenant_id')
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      // 1) Update conversation: clear needs_human and re-enable AI
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          needs_human: false,
          ai_state: 'active',
          ai_enabled: true,
          ai_pause_reason: null,
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // 2) Insert activity record
      const { error: activityError } = await supabase
        .from('conversation_activity')
        .insert({
          tenant_id: conversation.tenant_id,
          conversation_id: conversationId,
          contact_id: contactId,
          actor_user_id: profile?.id || null,
          actor_type: 'user',
          event_type: 'human_marked_attended',
          payload: note ? { note } : null,
        });

      if (activityError) throw activityError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity'] });
      queryClient.invalidateQueries({ queryKey: ['contact-activity'] });
    },
  });
}
