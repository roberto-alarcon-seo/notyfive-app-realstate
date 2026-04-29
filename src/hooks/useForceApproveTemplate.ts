import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useForceApproveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // SECURITY: Only super_admin may force-approve a template, bypassing
      // the normal Twilio review pipeline. Regular tenant roles are blocked here
      // even if a UI bug surfaced the action.
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('global_role')
        .maybeSingle();
      if (roleRow?.global_role !== 'super_admin') {
        throw new Error('Solo un Super Admin puede forzar la aprobación');
      }

      const { error } = await supabase
        .from('templates')
        .update({ approval_status: 'approved', rejection_reason: null })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Plantilla marcada como aprobada');
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al actualizar el estado');
    },
  });
}
