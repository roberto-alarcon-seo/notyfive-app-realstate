import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportMessage } from './useSupportTickets';

interface RealtimeMessageOptions {
  ticketId: string;
  enabled?: boolean;
  onNewMessage?: (message: SupportMessage) => void;
}

export function useSupportRealtimeMessages({
  ticketId,
  enabled = true,
  onNewMessage,
}: RealtimeMessageOptions) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const lastPolledRef = useRef<Date>(new Date());

  // Handle new message from realtime
  const handleRealtimeInsert = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      const newMessage = payload.new as unknown as SupportMessage;
      
      if (import.meta.env.DEV) {
        console.log('[Realtime] Message received:', newMessage.id?.slice(0, 8));
      }

      // Invalidate and refetch to get full message with sender info
      queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      
      onNewMessage?.(newMessage);
    },
    [queryClient, ticketId, onNewMessage]
  );

  // Subscribe to realtime
  useEffect(() => {
    if (!enabled || !ticketId) return;

    const channelName = `support-messages-${ticketId}`;
    
    if (import.meta.env.DEV) {
      console.log('[Realtime] Subscribing to channel:', channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        handleRealtimeInsert
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log('[Realtime] Subscription status:', status);
        }
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (import.meta.env.DEV) {
        console.log('[Realtime] Unsubscribing from channel:', channelName);
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, ticketId, handleRealtimeInsert]);

  // Fallback polling when disconnected
  useEffect(() => {
    if (!enabled || !ticketId || isConnected) return;

    const pollInterval = setInterval(() => {
      const now = new Date();
      const timeSinceLastPoll = now.getTime() - lastPolledRef.current.getTime();
      
      // Only poll if we haven't received realtime updates
      if (timeSinceLastPoll >= 15000) {
        if (import.meta.env.DEV) {
          console.log('[Realtime] Fallback polling triggered');
        }
        queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
        lastPolledRef.current = now;
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [enabled, ticketId, isConnected, queryClient]);

  return { isConnected };
}

// Optimistic message type
export interface OptimisticMessage extends Omit<SupportMessage, 'id'> {
  id: string;
  _pending?: boolean;
  _error?: boolean;
  _tempId?: string;
}

export function useOptimisticMessages(
  messages: SupportMessage[],
  currentUserId?: string
) {
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);

  // Merge real messages with optimistic ones
  const allMessages = [...messages];
  
  // Add optimistic messages that aren't in the real messages yet
  optimisticMessages.forEach((optMsg) => {
    if (optMsg._pending && !messages.find((m) => m.id === optMsg.id)) {
      allMessages.push(optMsg as SupportMessage);
    }
  });

  // Sort by created_at
  allMessages.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const addOptimisticMessage = useCallback(
    (message: Omit<SupportMessage, 'id' | 'created_at'>) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMsg: OptimisticMessage = {
        ...message,
        id: tempId,
        created_at: new Date().toISOString(),
        _pending: true,
        _tempId: tempId,
      };
      
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      return tempId;
    },
    []
  );

  const resolveOptimisticMessage = useCallback((tempId: string, realId?: string) => {
    setOptimisticMessages((prev) =>
      prev.map((msg) =>
        msg._tempId === tempId
          ? { ...msg, id: realId || msg.id, _pending: false }
          : msg
      )
    );
    
    // Remove after a short delay to allow animation
    setTimeout(() => {
      setOptimisticMessages((prev) => prev.filter((msg) => msg._tempId !== tempId));
    }, 500);
  }, []);

  const markOptimisticError = useCallback((tempId: string) => {
    setOptimisticMessages((prev) =>
      prev.map((msg) =>
        msg._tempId === tempId ? { ...msg, _pending: false, _error: true } : msg
      )
    );
  }, []);

  const removeOptimisticMessage = useCallback((tempId: string) => {
    setOptimisticMessages((prev) => prev.filter((msg) => msg._tempId !== tempId));
  }, []);

  const retryOptimisticMessage = useCallback((tempId: string) => {
    setOptimisticMessages((prev) =>
      prev.map((msg) =>
        msg._tempId === tempId ? { ...msg, _pending: true, _error: false } : msg
      )
    );
    return optimisticMessages.find((msg) => msg._tempId === tempId);
  }, [optimisticMessages]);

  return {
    allMessages,
    optimisticMessages,
    addOptimisticMessage,
    resolveOptimisticMessage,
    markOptimisticError,
    removeOptimisticMessage,
    retryOptimisticMessage,
  };
}
