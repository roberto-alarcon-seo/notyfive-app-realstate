import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RewriteTextParams {
  originalText: string;
  contactName?: string;
  companyName?: string;
}

interface RewriteTextResponse {
  improved_text: string;
}

export function useRewriteText() {
  return useMutation({
    mutationFn: async ({ originalText, contactName, companyName }: RewriteTextParams): Promise<RewriteTextResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-rewrite-text', {
        body: { originalText, contactName, companyName },
      });

      if (error) {
        console.error('Error calling ai-rewrite-text:', error);
        throw new Error(error.message || 'Error al mejorar el texto');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as RewriteTextResponse;
    },
  });
}
