import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { toast } from 'sonner';


export interface Template {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string | null;
  category: string;
  label: string | null;
  header_type: string;
  header_text: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  variables: string[];
  twilio_template_sid: string | null;
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  last_synced_at: string | null;
  used_count: number;
  // Media fields
  media_url: string | null;
  media_filename: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  // Source tracking fields
  created_source: 'manual' | 'ai';
  created_by_module: string | null;
  created_by_user_id: string | null;
  ai_conversation_id: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateButton {
  type: 'quick_reply' | 'url';
  text: string;
  url?: string;
}

export interface TemplateMedia {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface TemplateFormData {
  name: string;
  category: string;
  label?: string;
  header_type: string;
  header_text?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  media?: TemplateMedia | null;
}

// Extract variables from template content
export function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }
  return variables;
}

// Get all variables from all template parts
export function getAllVariables(template: Partial<TemplateFormData>): string[] {
  const allContent = [
    template.header_text || '',
    template.body || '',
    template.footer || '',
    ...(template.buttons?.map(b => b.text) || [])
  ].join(' ');
  
  return extractVariables(allContent);
}

export function useTemplates() {
  const tenantId = useEffectiveTenantId();
  
  return useQuery({
    queryKey: ['templates', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        buttons: (t.buttons as unknown as TemplateButton[]) || [],
        variables: t.variables || [],
        approval_status: t.approval_status as Template['approval_status'],
        created_source: (t.created_source as Template['created_source']) || 'manual',
      })) as Template[];
    },
    enabled: !!tenantId
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();
  
  return useMutation({
    mutationFn: async (formData: TemplateFormData) => {
      if (!tenantId) throw new Error('No tenant');
      
      const variables = getAllVariables(formData);
      
      const { data, error } = await supabase
        .from('templates')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          category: formData.category,
          label: formData.label || null,
          header_type: formData.header_type,
          header_text: formData.header_text || null,
          body: formData.body,
          footer: formData.footer || null,
          buttons: JSON.parse(JSON.stringify(formData.buttons || [])),
          variables,
          media_url: formData.media?.url || null,
          media_filename: formData.media?.filename || null,
          media_mime_type: formData.media?.mimeType || null,
          media_size_bytes: formData.media?.sizeBytes || null,
          // Source tracking - manual creation from UI
          created_source: 'manual',
          created_by_module: 'templates',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Plantilla creada correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al crear plantilla: ' + error.message);
    }
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, confirmInvalidateApproval, ...formData }: TemplateFormData & { id: string; confirmInvalidateApproval?: boolean }) => {
      const variables = getAllVariables(formData);

      // Fetch current row to detect content changes on already-approved templates.
      const { data: current, error: fetchErr } = await supabase
        .from('templates')
        .select('approval_status, body, header_text, footer')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const contentChanged =
        (current?.body || '') !== (formData.body || '') ||
        (current?.header_text || '') !== (formData.header_text || '') ||
        (current?.footer || '') !== (formData.footer || '');

      const isApproved = current?.approval_status === 'approved';

      // SECURITY/INTEGRITY: editing an approved template would diverge it from
      // the version Twilio/WhatsApp validated. Require explicit confirmation
      // and reset the approval state + Twilio SID so it must be re-submitted.
      if (isApproved && contentChanged && !confirmInvalidateApproval) {
        const err = new Error('APPROVED_EDIT_REQUIRES_CONFIRMATION') as Error & { code?: string };
        err.code = 'APPROVED_EDIT_REQUIRES_CONFIRMATION';
        throw err;
      }

      const update: Record<string, unknown> = {
        name: formData.name,
        category: formData.category,
        label: formData.label || null,
        header_type: formData.header_type,
        header_text: formData.header_text || null,
        body: formData.body,
        footer: formData.footer || null,
        buttons: JSON.parse(JSON.stringify(formData.buttons || [])),
        variables,
        media_url: formData.media?.url || null,
        media_filename: formData.media?.filename || null,
        media_mime_type: formData.media?.mimeType || null,
        media_size_bytes: formData.media?.sizeBytes || null,
      };

      if (isApproved && contentChanged && confirmInvalidateApproval) {
        update.approval_status = 'draft';
        update.twilio_template_sid = null;
        update.rejection_reason = null;
        update.variable_index_map = {};
      }

      const { data, error } = await supabase
        .from('templates')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Plantilla actualizada');
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === 'APPROVED_EDIT_REQUIRES_CONFIRMATION') {
        // The form layer is expected to catch this code and show its own dialog.
        return;
      }
      toast.error('Error al actualizar plantilla: ' + error.message);
    }
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Plantilla eliminada');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar plantilla: ' + error.message);
    }
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();
  
  return useMutation({
    mutationFn: async (template: Template) => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data, error } = await supabase
        .from('templates')
        .insert({
          tenant_id: tenantId,
          name: `${template.name} (copia)`,
          category: template.category,
          label: template.label,
          header_type: template.header_type,
          header_text: template.header_text,
          body: template.body,
          footer: template.footer,
          buttons: JSON.parse(JSON.stringify(template.buttons)),
          variables: template.variables,
          approval_status: 'draft', // Reset to draft
          media_url: template.media_url,
          media_filename: template.media_filename,
          media_mime_type: template.media_mime_type,
          media_size_bytes: template.media_size_bytes,
          // Duplicates inherit source but mark as manual operation
          created_source: 'manual',
          created_by_module: 'templates',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Plantilla duplicada');
    },
    onError: (error: Error) => {
      toast.error('Error al duplicar plantilla: ' + error.message);
    }
  });
}

export function useSubmitTemplateForApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Call edge function to create template in Twilio and submit for approval
      const { data, error } = await supabase.functions.invoke('submit-template-for-approval', {
        body: { template_id: id },
      });

      if (error) {
        throw new Error(error.message || 'Error al enviar plantilla');
      }

      if (data.code && data.code !== 'SUCCESS') {
        throw new Error(data.message || 'Error al enviar plantilla');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(data.message || 'Plantilla enviada para aprobación');
    },
    onError: (error: Error) => {
      toast.error('Error al enviar plantilla: ' + error.message);
    }
  });
}

export function useSyncTemplates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Call edge function to sync template statuses from Twilio
      const { data, error } = await supabase.functions.invoke('sync-template-status', {
        body: {},
      });

      if (error) {
        throw new Error(error.message || 'Error al sincronizar');
      }

      if (data.code && data.code !== 'SUCCESS') {
        throw new Error(data.message || 'Error al sincronizar');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(data.message || 'Plantillas sincronizadas');
    },
    onError: (error: Error) => {
      toast.error('Error al sincronizar: ' + error.message);
    }
  });
}

// Hook to check if Twilio is configured for the tenant
export function useTwilioStatus() {
  const tenantId = useEffectiveTenantId();
  
  return useQuery({
    queryKey: ['twilio-status', tenantId],
    queryFn: async () => {
      if (!tenantId) return { connected: false, hasPhone: false };
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('status, phone_number, messaging_service_sid')
        .eq('tenant_id', tenantId)
        .eq('provider', 'twilio')
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching Twilio status:', error);
        return { connected: false, hasPhone: false };
      }
      
      return {
        connected: data?.status === 'connected',
        hasPhone: !!(data?.phone_number || data?.messaging_service_sid),
      };
    },
    enabled: !!tenantId,
    staleTime: 30000, // Cache for 30 seconds
  });
}
