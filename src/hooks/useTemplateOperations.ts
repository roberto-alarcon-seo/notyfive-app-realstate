import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateNamingContext {
  category?: string;
  objective?: string;
  segment_name?: string;
  time_context?: string;
}

export interface TemplateUpsertParams {
  id?: string;
  name?: string; // Optional - will be generated if not provided
  display_name?: string;
  category: 'marketing' | 'utility' | 'authentication';
  body: string;
  header?: {
    type: 'none' | 'text' | 'image' | 'video';
    text?: string;
    media_url?: string;
  };
  footer?: string;
  variables: string[];
  // Source tracking
  source?: 'manual' | 'ai';
  source_module?: string;
  ai_conversation_id?: string;
  // Naming context for auto-generated names
  naming_context?: TemplateNamingContext;
  // Idempotency key for deduplication
  idempotency_key?: string;
}

export interface TemplateUpsertResponse {
  success: boolean;
  template_id: string;
  provider_template_sid: string | null;
  approval_status: string;
  twilio_error?: string;
  template?: {
    id: string;
    name: string;
    body: string;
    category: string;
    header_type: string;
    media_url: string | null;
    approval_status: string;
    twilio_template_sid: string | null;
    variables: string[];
  };
  message: string;
}

export interface SubmitApprovalResponse {
  success: boolean;
  content_sid?: string;
  approval_status: string;
  message: string;
}

export interface SyncTemplatesResponse {
  success: boolean;
  synced_count: number;
  updated_count: number;
  updates: Array<{
    id: string;
    name: string;
    old_status: string;
    new_status: string;
    rejection_reason?: string;
  }>;
  message: string;
}

// Extract variables from template body
export function extractTemplateVariables(body: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }
  return variables;
}

// Generate auto variable mapping
export function generateAutoVariableMapping(
  variables: string[],
  customFields: Array<{ key: string; name: string }>
): Record<string, { source: 'base' | 'custom'; field: string; field_key?: string }> {
  const baseFields = ['name', 'email', 'phone', 'country'];
  const mapping: Record<string, { source: 'base' | 'custom'; field: string; field_key?: string }> = {};

  for (const variable of variables) {
    const varLower = variable.toLowerCase();
    
    // Check base fields
    if (baseFields.includes(varLower)) {
      mapping[variable] = { source: 'base', field: varLower };
      continue;
    }

    // Check common aliases
    if (varLower === 'nombre') {
      mapping[variable] = { source: 'base', field: 'name' };
      continue;
    }
    if (varLower === 'correo' || varLower === 'mail') {
      mapping[variable] = { source: 'base', field: 'email' };
      continue;
    }
    if (varLower === 'telefono' || varLower === 'tel') {
      mapping[variable] = { source: 'base', field: 'phone' };
      continue;
    }
    if (varLower === 'pais') {
      mapping[variable] = { source: 'base', field: 'country' };
      continue;
    }

    // Check custom fields
    const customField = customFields.find(
      cf => cf.key.toLowerCase() === varLower || cf.name.toLowerCase() === varLower
    );
    if (customField) {
      mapping[variable] = { source: 'custom', field: customField.name, field_key: customField.key };
    }
  }

  return mapping;
}

// Generate idempotency key for template upsert
function generateUpsertIdempotencyKey(tenantId: string, body: string, category: string): string {
  const hash = body.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `upsert:${tenantId}:${Math.abs(hash).toString(36)}:${category}`;
}

// Upsert template (create/update in DB + Twilio)
export function useTemplateUpsert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TemplateUpsertParams): Promise<TemplateUpsertResponse> => {
      const { source, source_module, ai_conversation_id, naming_context, idempotency_key, ...templateParams } = params;
      
      // Generate idempotency key if not provided
      const finalIdempotencyKey = idempotency_key || generateUpsertIdempotencyKey(
        'tenant', // Will be resolved in backend
        templateParams.body,
        templateParams.category
      );
      
      const { data, error } = await supabase.functions.invoke('twilio-template-upsert', {
        body: { 
          template: templateParams,
          source,
          source_module,
          ai_conversation_id,
          naming_context,
          idempotency_key: finalIdempotencyKey,
        },
      });

      if (error) {
        throw { code: 'NETWORK_ERROR', message: error.message };
      }

      if (data?.code && data.code !== 'SUCCESS' && !data.success) {
        throw { code: data.code, message: data.message };
      }

      return data as TemplateUpsertResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      if (data.twilio_error) {
        toast.warning('Plantilla guardada', { 
          description: `Twilio: ${data.twilio_error}` 
        });
      } else {
        toast.success('Plantilla guardada', { 
          description: data.message 
        });
      }
    },
    onError: (error: { code?: string; message: string }) => {
      toast.error('Error al guardar plantilla', { description: error.message });
    },
  });
}

// Submit template for approval
export function useSubmitForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string): Promise<SubmitApprovalResponse> => {
      // Generate idempotency key for submit
      const idempotencyKey = `submit:${templateId}:${Date.now()}`;
      
      const { data, error } = await supabase.functions.invoke('submit-template-for-approval', {
        body: { 
          template_id: templateId,
          idempotency_key: idempotencyKey,
        },
      });

      if (error) {
        throw { code: 'NETWORK_ERROR', message: error.message };
      }

      if (data?.code && data.code !== 'SUCCESS' && !data.success) {
        throw { code: data.code, message: data.message };
      }

      return data as SubmitApprovalResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Enviado a aprobación', { 
        description: 'La plantilla está pendiente de revisión por WhatsApp' 
      });
    },
    onError: (error: { code?: string; message: string }) => {
      toast.error('Error al enviar a aprobación', { description: error.message });
    },
  });
}

// Sync template statuses from Twilio
export function useSyncTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncTemplatesResponse> => {
      const { data, error } = await supabase.functions.invoke('sync-template-status', {});

      if (error) {
        throw { code: 'NETWORK_ERROR', message: error.message };
      }

      if (data?.code && data.code !== 'SUCCESS' && !data.success) {
        throw { code: data.code, message: data.message };
      }

      return data as SyncTemplatesResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      if (data.updated_count > 0) {
        toast.success('Plantillas sincronizadas', { 
          description: `${data.updated_count} plantilla(s) actualizada(s)` 
        });
      } else {
        toast.info('Sincronización completa', { 
          description: 'Todas las plantillas están al día' 
        });
      }
    },
    onError: (error: { code?: string; message: string }) => {
      toast.error('Error al sincronizar', { description: error.message });
    },
  });
}

// Fetch single template by ID
export function useTemplateById(templateId: string | undefined) {
  return {
    refetch: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw error;
      return data;
    }
  };
}
