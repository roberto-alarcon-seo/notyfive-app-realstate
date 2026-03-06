import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface Followup {
  id: string;
  tenant_id: string;
  conversation_id: string;
  contact_id: string;
  assigned_user_id: string | null;
  status: 'scheduled' | 'completed' | 'canceled';
  due_at: string;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  // Joined data
  contact?: {
    id: string;
    name: string;
    phone: string | null;
  };
  conversation?: {
    id: string;
    customer_whatsapp: string;
    last_message_preview: string | null;
  };
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateFollowupInput {
  conversation_id: string;
  contact_id: string;
  assigned_user_id?: string | null;
  due_at: string;
  note?: string | null;
}

// Fetch all followups for tenant
export function useFollowups() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_followups')
        .select(`
          *,
          contact:contacts(id, name, phone),
          conversation:conversations(id, customer_whatsapp, last_message_preview),
          assigned_user:profiles(id, name, email)
        `)
        .eq('status', 'scheduled')
        .order('due_at', { ascending: true });

      if (error) throw error;
      return data as Followup[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('followups-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_followups',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['followups'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Fetch active followup for a specific conversation
export function useConversationFollowup(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversation-followup', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from('conversation_followups')
        .select(`
          *,
          assigned_user:profiles(id, name, email)
        `)
        .eq('conversation_id', conversationId)
        .eq('status', 'scheduled')
        .order('due_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Followup | null;
    },
    enabled: !!conversationId,
  });

  // Real-time subscription for this conversation's followups
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`followup-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_followups',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-followup', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

// Create a new followup
export function useCreateFollowup() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateFollowupInput) => {
      // Get tenant_id from profile
      if (!profile?.tenant_id) {
        throw new Error('No tenant_id found');
      }

      // 1. Create the followup
      const { data: followup, error: followupError } = await supabase
        .from('conversation_followups')
        .insert({
          tenant_id: profile.tenant_id,
          conversation_id: input.conversation_id,
          contact_id: input.contact_id,
          assigned_user_id: input.assigned_user_id || profile.id,
          due_at: input.due_at,
          note: input.note || null,
          status: 'scheduled',
        })
        .select()
        .single();

      if (followupError) throw followupError;

      // 2. Log activity
      await supabase.from('conversation_activity').insert({
        tenant_id: profile.tenant_id,
        conversation_id: input.conversation_id,
        contact_id: input.contact_id,
        actor_user_id: profile.id,
        actor_type: 'user',
        event_type: 'followup_scheduled',
        payload: {
          followup_id: followup.id,
          due_at: input.due_at,
          note: input.note,
          assigned_user_id: input.assigned_user_id || profile.id,
        },
      });

      // 3. Clear needs_human flag and set ai_state to paused
      await supabase
        .from('conversations')
        .update({
          needs_human: false,
          ai_state: 'paused',
          ai_pause_reason: null,
        })
        .eq('id', input.conversation_id);

      return followup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-followup'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity'] });
    },
  });
}

// Complete a followup
export function useCompleteFollowup() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (followupId: string) => {
      // Get the followup first
      const { data: followup, error: fetchError } = await supabase
        .from('conversation_followups')
        .select('*')
        .eq('id', followupId)
        .single();

      if (fetchError) throw fetchError;

      // Update status
      const { error: updateError } = await supabase
        .from('conversation_followups')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', followupId);

      if (updateError) throw updateError;

      // Re-enable AI and clear needs_human after followup is done
      await supabase
        .from('conversations')
        .update({
          ai_enabled: true,
          ai_state: 'active',
          needs_human: false,
          ai_pause_reason: null,
        })
        .eq('id', followup.conversation_id);

      // Log activity
      if (profile?.tenant_id) {
        await supabase.from('conversation_activity').insert({
          tenant_id: followup.tenant_id,
          conversation_id: followup.conversation_id,
          contact_id: followup.contact_id,
          actor_user_id: profile.id,
          actor_type: 'user',
          event_type: 'followup_completed',
          payload: {
            followup_id: followupId,
          },
        });
      }

      return followup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-followup'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// Cancel a followup
export function useCancelFollowup() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (followupId: string) => {
      // Get the followup first for activity logging
      const { data: followup, error: fetchError } = await supabase
        .from('conversation_followups')
        .select('*')
        .eq('id', followupId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('conversation_followups')
        .update({ 
          status: 'canceled',
          canceled_at: new Date().toISOString(),
        })
        .eq('id', followupId);

      if (error) throw error;

      // Log followup_canceled activity
      if (profile?.tenant_id && followup) {
        await supabase.from('conversation_activity').insert({
          tenant_id: followup.tenant_id,
          conversation_id: followup.conversation_id,
          contact_id: followup.contact_id,
          actor_user_id: profile.id,
          actor_type: 'user',
          event_type: 'followup_canceled',
          payload: {
            followup_id: followupId,
            note: followup.note,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-followup'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity'] });
      queryClient.invalidateQueries({ queryKey: ['contact-activity'] });
    },
  });
}

// Update a followup (edit due_at and/or note)
export function useUpdateFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ followupId, due_at, note }: { followupId: string; due_at: string; note: string | null }) => {
      const { error } = await supabase
        .from('conversation_followups')
        .update({ due_at, note })
        .eq('id', followupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-followup'] });
    },
  });
}

// Delete a followup permanently
export function useDeleteFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (followupId: string) => {
      const { error } = await supabase
        .from('conversation_followups')
        .delete()
        .eq('id', followupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-followup'] });
    },
  });
}

// Reschedule a follow-up
export function useRescheduleFollowup() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      followupId, 
      newDueAt, 
      note 
    }: { 
      followupId: string; 
      newDueAt: string; 
      note?: string | null;
    }) => {
      // Get the current followup to get tenant_id, contact_id, conversation_id
      const { data: followup, error: fetchError } = await supabase
        .from('conversation_followups')
        .select('tenant_id, contact_id, conversation_id, due_at')
        .eq('id', followupId)
        .single();

      if (fetchError) throw fetchError;

      // Update the followup
      const { error: updateError } = await supabase
        .from('conversation_followups')
        .update({ 
          due_at: newDueAt,
          note: note ?? null,
        })
        .eq('id', followupId);

      if (updateError) throw updateError;

      // Log the reschedule activity
      const { error: activityError } = await supabase
        .from('conversation_activity')
        .insert({
          tenant_id: followup.tenant_id,
          conversation_id: followup.conversation_id,
          contact_id: followup.contact_id,
          actor_user_id: profile?.id || null,
          actor_type: 'user',
          event_type: 'followup_rescheduled',
          payload: { 
            followup_id: followupId,
            old_due_at: followup.due_at,
            new_due_at: newDueAt,
            note,
          },
        });

      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-followup'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-activity'] });
      queryClient.invalidateQueries({ queryKey: ['contact-activity'] });
    },
  });
}
