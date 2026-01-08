import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { toast } from 'sonner';


export type AITone = 'cordial' | 'professional' | 'friendly' | 'adaptive';

export interface AISettings {
  id: string;
  tenant_id: string;
  enabled: boolean;
  agent_name: string;
  company_name: string | null;
  timezone: string;
  response_delay_seconds: number;
  tone: AITone;
  use_emojis: boolean;
  max_emojis_per_message: number;
  never_reveal_ai: boolean;
  use_customer_name: boolean;
  escalate_on_frustration: boolean;
  escalate_on_no_answer: boolean;
  escalate_on_human_request: boolean;
  behavior_prompt: string | null;
  fallback_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useAISettings() {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ['ai-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenant_ai_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as AISettings | null;
    },
    enabled: !!tenantId,
  });
}

export function useUpdateAISettings() {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  return useMutation({
    mutationFn: async (settings: Partial<AISettings>) => {
      if (!tenantId) throw new Error('No tenant');

      // Check if settings exist
      const { data: existing } = await supabase
        .from('tenant_ai_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('tenant_ai_settings')
          .update(settings)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('tenant_ai_settings')
        .insert({ ...settings, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success('Configuración de IA guardada');
    },
    onError: (error) => {
      toast.error('Error al guardar configuración', { description: error.message });
    },
  });
}

export function useToggleAI() {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: existing } = await supabase
        .from('tenant_ai_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tenant_ai_settings')
          .update({ enabled })
          .eq('tenant_id', tenantId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_ai_settings')
          .insert({ tenant_id: tenantId, enabled });

        if (error) throw error;
      }

      // When disabling global AI, also disable AI on all tenant conversations
      if (!enabled) {
        const { error: convError } = await supabase
          .from('conversations')
          .update({ ai_enabled: false })
          .eq('tenant_id', tenantId);

        if (convError) {
          console.error('Error disabling AI on conversations:', convError);
        }
      }
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(enabled ? 'IA activada' : 'IA desactivada');
    },
    onError: (error) => {
      toast.error('Error al cambiar estado de IA', { description: error.message });
    },
  });
}
