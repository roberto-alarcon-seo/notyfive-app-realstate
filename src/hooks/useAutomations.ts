import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { useEffect } from 'react';
import type { Json } from '@/integrations/supabase/types';


export type AutomationStatus = 'draft' | 'active' | 'paused';
export type AutomationTriggerType = 
  | 'inbound_message'
  | 'window_expiring'
  | 'window_expired'
  | 'campaign_touched'
  | 'campaign_replied'
  | 'field_changed'
  | 'tag_changed'
  | 'scheduled'
  | 'event.created'
  | 'event.upcoming'
  | 'event.canceled'
  | 'event.completed'
  | 'event.no_show'
  | 'event.confirmed';

export type AutomationActionType =
  | 'send_message'
  | 'send_template'
  | 'delay'
  | 'assign_agent'
  | 'add_tag'
  | 'remove_tag'
  | 'update_tag'
  | 'update_field'
  | 'create_note'
  | 'notify_agent'
  | 'update_event_status'
  | 'pause_ai'
  | 'enable_ai'
  | 'escalate'
  | 'send_webhook'
  | 'create_followup';

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped_condition'
  | 'blocked_wallet'
  | 'blocked_rate'
  | 'blocked_window'
  | 'blocked_optout'
  | 'blocked_template';

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  rate_limits: {
    per_minute: number;
    per_hour: number;
    per_contact_day: number;
  };
  schedule: Record<string, unknown> | null;
  cooldown_hours: number;
  allowed_hours: {
    start: string;
    end: string;
    days: number[];
    timezone: string;
  };
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  tenant_id: string;
  automation_id: string;
  contact_id: string;
  conversation_id: string | null;
  trigger_event_id: string | null;
  status: AutomationRunStatus;
  wallet_consumed: number;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  automation?: Automation;
  contact?: {
    id: string;
    name: string;
    phone: string | null;
  };
}

export interface AutomationFormData {
  name: string;
  description?: string;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  rate_limits: {
    per_minute: number;
    per_hour: number;
    per_contact_day: number;
  };
  cooldown_hours: number;
  allowed_hours: {
    start: string;
    end: string;
    days: number[];
    timezone: string;
  };
}

// Helper function to sanitize action config - convert empty strings to null for UUID fields
function sanitizeActionConfig(config: Record<string, unknown>): Record<string, unknown> {
  const uuidFields = ['template_id', 'segment_id', 'campaign_id', 'event_id', 'contact_id', 'user_id'];
  const sanitized = { ...config };
  
  for (const field of uuidFields) {
    if (field in sanitized && (sanitized[field] === '' || sanitized[field] === 'undefined' || sanitized[field] === undefined)) {
      sanitized[field] = null;
    }
  }
  
  return sanitized;
}

export function useAutomations(statusFilter?: AutomationStatus) {
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['automations', tenantId, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];

      let q = supabase
        .from('automations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        q = q.eq('status', statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Automation[];
    },
    enabled: !!tenantId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('automations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['automations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return query;
}

export function useAutomation(automationId: string | null) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ['automation', automationId],
    queryFn: async () => {
      if (!automationId || !tenantId) return null;

      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Automation | null;
    },
    enabled: !!automationId && !!tenantId,
  });
}

export function useCreateAutomation() {
  const { user } = useAuth();
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: AutomationFormData) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Sanitize actions to ensure empty UUIDs are null
      const sanitizedActions = formData.actions.map(action => ({
        ...action,
        config: sanitizeActionConfig(action.config),
      }));

      const { data, error } = await supabase
        .from('automations')
        .insert({
          tenant_id: tenantId,
          created_by: user?.id || null,
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          trigger_type: formData.trigger_type as any,
          trigger_config: formData.trigger_config as Json,
          conditions: formData.conditions as unknown as Json,
          actions: sanitizedActions as unknown as Json,
          rate_limits: formData.rate_limits as unknown as Json,
          cooldown_hours: formData.cooldown_hours,
          allowed_hours: formData.allowed_hours as unknown as Json,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automatización creada');
    },
    onError: (error) => {
      toast.error('Error al crear automatización', { description: error.message });
    },
  });
}

export function useUpdateAutomation() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: AutomationFormData & { id: string }) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Sanitize actions to ensure empty UUIDs are null
      const sanitizedActions = formData.actions.map(action => ({
        ...action,
        config: sanitizeActionConfig(action.config),
      }));

      const { data, error } = await supabase
        .from('automations')
        .update({
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          trigger_type: formData.trigger_type as any,
          trigger_config: formData.trigger_config as Json,
          conditions: formData.conditions as unknown as Json,
          actions: sanitizedActions as unknown as Json,
          rate_limits: formData.rate_limits as unknown as Json,
          cooldown_hours: formData.cooldown_hours,
          allowed_hours: formData.allowed_hours as unknown as Json,
        } as any)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation', variables.id] });
      toast.success('Automatización actualizada');
    },
    onError: (error) => {
      toast.error('Error al actualizar', { description: error.message });
    },
  });
}

export function useDeleteAutomation() {
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (automationId: string) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', automationId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automatización eliminada');
    },
    onError: (error) => {
      toast.error('Error al eliminar', { description: error.message });
    },
  });
}

export function useDuplicateAutomation() {
  const { user } = useAuth();
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (automationId: string) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Fetch original automation
      const { data: original, error: fetchError } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) throw fetchError;

      // Create duplicate
      const { data, error } = await supabase
        .from('automations')
        .insert({
          tenant_id: tenantId,
          created_by: user?.id,
          name: `${original.name} (copia)`,
          description: original.description,
          status: 'draft' as AutomationStatus,
          trigger_type: original.trigger_type,
          trigger_config: original.trigger_config,
          conditions: original.conditions,
          actions: original.actions,
          rate_limits: original.rate_limits,
          cooldown_hours: original.cooldown_hours,
          allowed_hours: original.allowed_hours,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automatización duplicada');
    },
    onError: (error) => {
      toast.error('Error al duplicar', { description: error.message });
    },
  });
}

export function useToggleAutomationStatus() {
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AutomationStatus }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const newStatus = status === 'active' ? 'paused' : 'active';

      const { data, error } = await supabase
        .from('automations')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation', data.id] });
      toast.success(data.status === 'active' ? 'Automatización activada' : 'Automatización pausada');
    },
    onError: (error) => {
      toast.error('Error al cambiar estado', { description: error.message });
    },
  });
}

export function useAutomationRuns(automationId?: string, limit = 50) {
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['automation-runs', tenantId, automationId, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      let q = supabase
        .from('automation_runs')
        .select(`
          *,
          automation:automations(id, name, trigger_type),
          contact:contacts(id, name, phone)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (automationId) {
        q = q.eq('automation_id', automationId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as AutomationRun[];
    },
    enabled: !!tenantId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('automation-runs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automation_runs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['automation-runs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return query;
}

export function useAutomationRunSteps(runId: string | null) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ['automation-run-steps', runId],
    queryFn: async () => {
      if (!runId || !tenantId) return [];

      const { data, error } = await supabase
        .from('automation_run_steps')
        .select('*')
        .eq('run_id', runId)
        .eq('tenant_id', tenantId)
        .order('step_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!runId && !!tenantId,
  });
}

export function useAutomationStats(automationId?: string) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ['automation-stats', tenantId, automationId],
    queryFn: async () => {
      if (!tenantId) return null;

      let q = supabase
        .from('automation_runs')
        .select('status, created_at')
        .eq('tenant_id', tenantId);

      if (automationId) {
        q = q.eq('automation_id', automationId);
      }

      // Get runs from last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      q = q.gte('created_at', yesterday.toISOString());

      const { data, error } = await q;
      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        success: data?.filter(r => r.status === 'success').length || 0,
        failed: data?.filter(r => r.status === 'failed').length || 0,
        blocked: data?.filter(r => r.status.startsWith('blocked_')).length || 0,
        skipped: data?.filter(r => r.status === 'skipped_condition').length || 0,
      };

      return stats;
    },
    enabled: !!tenantId,
  });
}
