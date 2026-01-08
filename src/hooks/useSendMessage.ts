import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MediaParams {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  filename: string;
  sizeBytes: number;
}

interface SendMessageParams {
  conversationId: string;
  text?: string;
  media?: MediaParams;
}

interface SendMessageResponse {
  message_id: string;
  provider_message_id: string;
  status: string;
  wallet_balance: number;
}

interface SendMessageError {
  code: string;
  message: string;
  details?: string;
  wallet_balance?: number;
  hours_since?: number;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, text, media }: SendMessageParams): Promise<SendMessageResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw { code: 'UNAUTHORIZED', message: 'No hay sesión activa' };
      }

      const response = await supabase.functions.invoke('send-manual-message', {
        body: {
          conversation_id: conversationId,
          text: text || '',
          media: media || null,
        },
      });

      if (response.error) {
        // Parse the error from the edge function
        const errorData = response.error as unknown as { message?: string };
        let parsedError: SendMessageError;
        
        try {
          parsedError = JSON.parse(errorData.message || '{}');
        } catch {
          parsedError = { code: 'UNKNOWN', message: errorData.message || 'Error desconocido' };
        }
        
        throw parsedError;
      }

      return response.data as SendMessageResponse;
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      // New credits source-of-truth (tenants) used by header + plans modal
      queryClient.invalidateQueries({ queryKey: ['tenant-credits'] });
    },
  });
}

export function isOutOfWindow(lastCustomerMessageAt: string | null): boolean {
  if (!lastCustomerMessageAt) return true;
  
  const hoursSince = (Date.now() - new Date(lastCustomerMessageAt).getTime()) / (1000 * 60 * 60);
  return hoursSince > 24;
}

export function getHoursUntilWindowClose(lastCustomerMessageAt: string | null): number {
  if (!lastCustomerMessageAt) return 0;
  
  const hoursSince = (Date.now() - new Date(lastCustomerMessageAt).getTime()) / (1000 * 60 * 60);
  const hoursRemaining = 24 - hoursSince;
  return Math.max(0, Math.round(hoursRemaining * 10) / 10);
}
