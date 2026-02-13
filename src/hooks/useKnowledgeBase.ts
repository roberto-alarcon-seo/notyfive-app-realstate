import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { toast } from 'sonner';


export type KBCategory = 
  | 'general_info'
  | 'financing'
  | 'purchase_process'
  | 'payments'
  | 'legal'
  | 'schedules'
  | 'post_sale'
  | 'objections'
  | 'other';

export interface KnowledgeBaseEntry {
  id: string;
  tenant_id: string;
  category: KBCategory;
  question: string;
  answer: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const KB_CATEGORY_LABELS: Record<KBCategory, string> = {
  general_info: 'Empresa y Marca',
  financing: 'Créditos y Financiamiento',
  purchase_process: 'Proceso de Compra',
  payments: 'Formas de Pago',
  legal: 'Legal y Documentación',
  schedules: 'Horarios de Atención',
  post_sale: 'Postventa y Entrega',
  objections: 'Objeciones Frecuentes',
  other: 'Otros',
};

export function useKnowledgeBase() {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ['knowledge-base', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('category')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KnowledgeBaseEntry[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateKBEntry() {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  return useMutation({
    mutationFn: async (entry: Omit<KnowledgeBaseEntry, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .insert({ ...entry, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Entrada creada');
    },
    onError: (error) => {
      toast.error('Error al crear entrada', { description: error.message });
    },
  });
}

export function useUpdateKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KnowledgeBaseEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Entrada actualizada');
    },
    onError: (error) => {
      toast.error('Error al actualizar', { description: error.message });
    },
  });
}

export function useDeleteKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_knowledge_base')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Entrada eliminada');
    },
    onError: (error) => {
      toast.error('Error al eliminar', { description: error.message });
    },
  });
}

export function useToggleKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ai_knowledge_base')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success(is_active ? 'Entrada activada' : 'Entrada desactivada');
    },
    onError: (error) => {
      toast.error('Error al cambiar estado', { description: error.message });
    },
  });
}
