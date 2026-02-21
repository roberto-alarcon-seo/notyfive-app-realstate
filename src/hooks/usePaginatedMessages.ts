import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from './useConversations';

const PAGE_SIZE = 20;

interface UsePaginatedMessagesResult {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  resetPagination: () => void;
}

export function usePaginatedMessages(conversationId: string | null): UsePaginatedMessagesResult {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestMessageRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Fetch initial messages (last 20)
  const fetchInitialMessages = useCallback(async (convId: string) => {
    setIsLoading(true);
    setHasMore(true);
    oldestMessageRef.current = null;

    try {
      // Get the most recent messages first, then reverse for display
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          campaign:campaigns(id, name),
          template:templates(id, buttons)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      // Reverse to get chronological order (oldest first for display)
      const chronologicalMessages = (data as Message[]).reverse();
      
      setMessages(chronologicalMessages);
      
      if (chronologicalMessages.length > 0) {
        oldestMessageRef.current = chronologicalMessages[0].created_at;
      }
      
      // If we got less than PAGE_SIZE, there are no more messages
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching initial messages:', err);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMore || !oldestMessageRef.current) return;

    setIsLoadingMore(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          campaign:campaigns(id, name),
          template:templates(id, buttons)
        `)
        .eq('conversation_id', conversationId)
        .lt('created_at', oldestMessageRef.current)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      if (data.length > 0) {
        // Reverse to get chronological order
        const olderMessages = (data as Message[]).reverse();
        
        // Update oldest message reference
        oldestMessageRef.current = olderMessages[0].created_at;
        
        // Prepend older messages
        setMessages(prev => [...olderMessages, ...prev]);
      }
      
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, isLoadingMore, hasMore]);

  // Reset pagination when conversation changes
  const resetPagination = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setIsLoading(false);
    setIsLoadingMore(false);
    oldestMessageRef.current = null;
  }, []);

  // Handle conversation change
  useEffect(() => {
    if (conversationId !== conversationIdRef.current) {
      conversationIdRef.current = conversationId;
      
      if (conversationId) {
        fetchInitialMessages(conversationId);
      } else {
        resetPagination();
      }
    }
  }, [conversationId, fetchInitialMessages, resetPagination]);

  // Subscribe to new messages + status updates (realtime)
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-paginated-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the complete message with relations
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
              campaign:campaigns(id, name),
              template:templates(id, buttons)
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            setMessages((prev) => {
              // Check if message already exists to avoid duplicates
              if (prev.some((m) => m.id === data.id)) {
                return prev;
              }
              return [...prev, data as Message];
            });

            // Refresh credits on any new message (inbound/outbound)
            queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Update message status (queued -> sent/delivered/read/failed) without refresh
          const updated = payload.new as Message;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === updated.id);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], ...updated };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    resetPagination,
  };
}
