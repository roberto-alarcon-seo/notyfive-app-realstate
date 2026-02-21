import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export type AiState = 'active' | 'paused' | 'escalated';
export type AiPauseReason = 'human_request' | 'frustration' | 'no_answer' | 'no_balance' | 'error' | null;

export interface Conversation {
  id: string;
  tenant_id: string;
  contact_id: string;
  twilio_subaccount_sid: string | null;
  twilio_whatsapp_number: string | null;
  customer_whatsapp: string;
  status: string;
  ai_enabled: boolean;
  // AI state fields for handoff/escalation
  ai_state: AiState;
  needs_human: boolean;
  ai_pause_reason: AiPauseReason;
  ai_paused_at: string | null;
  ai_paused_by: string | null;
  last_customer_message_at: string | null;
  last_agent_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: string | null;
  last_message_source: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    country: string | null;
  };
}

export interface Message {
  id: string;
  tenant_id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  source: 'manual' | 'campaign' | 'template' | 'ai';
  channel: string;
  provider: string;
  twilio_message_sid: string | null;
  campaign_id: string | null;
  template_id: string | null;
  contact_id: string | null;
  from_number: string;
  to_number: string;
  body: string | null;
  media_urls: string[];
  // New media fields
  media_type: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_size_bytes: number | null;
  media_duration_sec: number | null;
  location_lat: number | null;
  location_lng: number | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  ai_generated: boolean;
  campaign?: {
    id: string;
    name: string;
  };
  template?: {
    id: string;
    buttons: unknown;
  } | null;
}

export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(id, name, phone, email, country)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
  });

  // Subscribe to real-time updates for conversations AND new messages (for list preview)
  useEffect(() => {
    const channel = supabase
      .channel('conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // When a new message arrives on ANY conversation, refresh the list
          // so unread counts and previews update in real-time
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Retry subscription after a short delay
          setTimeout(() => {
            supabase.removeChannel(channel);
          }, 3000);
        }
      });

    // Fallback: poll every 30s in case realtime misses events
    const pollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }, 30000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          campaign:campaigns(id, name)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  // Subscribe to real-time updates for messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          // Refresh credits on any new message (inbound/outbound)
          queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      // First delete all messages in the conversation
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      // Then delete the conversation
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useArchiveContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'archived' })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Hook to resolve "needs human" status and optionally reactivate AI
export function useResolveNeedsHuman() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      reactivateAi = false 
    }: { 
      conversationId: string; 
      reactivateAi?: boolean;
    }) => {
      const updateData: Record<string, unknown> = {
        needs_human: false,
        ai_state: reactivateAi ? 'active' : 'paused',
        ai_pause_reason: null,
      };
      
      if (reactivateAi) {
        updateData.ai_enabled = true;
      }

      const { error } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
