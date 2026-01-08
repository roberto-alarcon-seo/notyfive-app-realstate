import { useEffect } from 'react';
import { Bot, Sparkles, MessageCircle, Clock, ToggleLeft, ToggleRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TenantAutomationTabProps {
  tenantId: string;
}

interface AutomationSummary {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  trigger_type: string;
  updated_at: string;
}

interface RunStats {
  total: number;
  success: number;
  failed: number;
  blocked: number;
  wallet_consumed: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  inbound_message: 'Mensaje entrante',
  window_expiring: 'Ventana por expirar',
  window_expired: 'Ventana expirada',
  campaign_touched: 'Campaña enviada',
  campaign_replied: 'Campaña respondida',
  field_changed: 'Campo modificado',
  tag_changed: 'Tag modificado',
  scheduled: 'Programado',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'text-success' },
  paused: { label: 'Pausada', color: 'text-warning' },
  draft: { label: 'Borrador', color: 'text-muted-foreground' },
};

export function TenantAutomationTab({ tenantId }: TenantAutomationTabProps) {
  const queryClient = useQueryClient();

  // Fetch automations for tenant
  const { data: automations, isLoading: loadingAutomations } = useQuery({
    queryKey: ['admin-tenant-automations', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automations')
        .select('id, name, status, trigger_type, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AutomationSummary[];
    },
    enabled: !!tenantId,
  });

  // Fetch run stats for last 7 days
  const { data: runStats, isLoading: loadingStats } = useQuery({
    queryKey: ['admin-tenant-automation-stats', tenantId],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('automation_runs')
        .select('status, wallet_consumed')
        .eq('tenant_id', tenantId)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      const stats: RunStats = {
        total: data?.length || 0,
        success: data?.filter(r => r.status === 'success').length || 0,
        failed: data?.filter(r => r.status === 'failed').length || 0,
        blocked: data?.filter(r => (r.status as string).startsWith('blocked_')).length || 0,
        wallet_consumed: data?.reduce((sum, r) => sum + (r.wallet_consumed || 0), 0) || 0,
      };

      return stats;
    },
    enabled: !!tenantId,
  });

  // Fetch recent runs
  const { data: recentRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ['admin-tenant-recent-runs', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_runs')
        .select(`
          id,
          status,
          wallet_consumed,
          error_message,
          created_at,
          automation:automations(name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`admin-automation-runs-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automation_runs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-tenant-automation-stats', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['admin-tenant-recent-runs', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const isLoading = loadingAutomations || loadingStats;
  const activeCount = automations?.filter(a => a.status === 'active').length || 0;
  const hasAutomations = automations && automations.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Automation Status */}
      <div className={`${activeCount > 0 ? 'bg-success/5' : 'bg-muted/30'} border border-border rounded-xl p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${activeCount > 0 ? 'bg-success/10' : 'bg-muted'}`}>
              <Bot className={`h-6 w-6 ${activeCount > 0 ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Automatizaciones Activas</p>
              <p className={`text-lg font-medium ${activeCount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {activeCount} de {automations?.length || 0}
              </p>
            </div>
          </div>
          <div className={`p-2 ${activeCount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
            {activeCount > 0 ? (
              <ToggleRight className="h-8 w-8" />
            ) : (
              <ToggleLeft className="h-8 w-8" />
            )}
          </div>
        </div>
      </div>

      {/* Stats (last 7 days) */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-secondary/30 border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">{runStats?.total || 0}</p>
          <p className="text-sm text-muted-foreground">Ejecuciones (7d)</p>
        </div>
        <div className="bg-secondary/30 border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-success">{runStats?.success || 0}</p>
          <p className="text-sm text-muted-foreground">Exitosas</p>
        </div>
        <div className="bg-secondary/30 border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-destructive">{runStats?.failed || 0}</p>
          <p className="text-sm text-muted-foreground">Fallidas</p>
        </div>
        <div className="bg-secondary/30 border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-primary">{runStats?.wallet_consumed || 0}</p>
          <p className="text-sm text-muted-foreground">Mensajes</p>
        </div>
      </div>

      {/* Automations List */}
      {hasAutomations ? (
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Automatizaciones del Tenant
          </h3>
          <div className="space-y-3">
            {automations.map((automation) => {
              const statusConfig = STATUS_CONFIG[automation.status] || STATUS_CONFIG.draft;
              return (
                <div
                  key={automation.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{automation.name}</span>
                      <Badge variant="outline" className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(automation.updated_at).toLocaleDateString('es-MX')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-secondary/30 border border-border rounded-xl p-8 text-center">
          <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Este tenant no tiene automatizaciones configuradas</p>
        </div>
      )}

      {/* Recent Runs */}
      {recentRuns && recentRuns.length > 0 && (
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Últimas Ejecuciones
          </h3>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {recentRuns.map((run) => {
                const StatusIcon = run.status === 'success' 
                  ? CheckCircle 
                  : run.status === 'failed' 
                    ? XCircle 
                    : AlertTriangle;
                const statusColor = run.status === 'success'
                  ? 'text-success'
                  : run.status === 'failed'
                    ? 'text-destructive'
                    : 'text-warning';

                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                  >
                    <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {(run.automation as { name?: string })?.name || 'Automatización'}
                      </p>
                      {run.error_message && (
                        <p className="text-xs text-destructive truncate">{run.error_message}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString('es-MX', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {run.wallet_consumed > 0 && (
                        <p className="text-xs text-primary">{run.wallet_consumed} msg</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Info */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
        <p>
          Las automatizaciones se configuran desde el panel del tenant. 
          Aquí se muestra el estado actual, métricas de uso y últimas ejecuciones.
        </p>
      </div>
    </div>
  );
}
