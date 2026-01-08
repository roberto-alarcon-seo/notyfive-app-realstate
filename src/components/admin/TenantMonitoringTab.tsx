import { useState } from 'react';
import { 
  Activity, 
  MessageSquare, 
  Bot, 
  Wallet, 
  AlertTriangle, 
  TrendingUp,
  Users,
  RefreshCw,
  Clock,
  Zap,
  BarChart3
} from 'lucide-react';
import { useTenantMetrics, TenantMetrics } from '@/hooks/useTenantMetrics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function TenantMonitoringTab() {
  const { data, isLoading, refetch, isFetching } = useTenantMetrics();
  const [sortBy, setSortBy] = useState<'messages' | 'ai' | 'wallet' | 'attention'>('messages');

  const sortedTenants = data?.tenants.slice().sort((a, b) => {
    switch (sortBy) {
      case 'ai':
        return b.aiInteractions24h - a.aiInteractions24h;
      case 'wallet':
        return a.walletBalance - b.walletBalance;
      case 'attention':
        return b.needsHumanCount - a.needsHumanCount;
      default:
        return (b.messagesInbound24h + b.messagesOutbound24h) - (a.messagesInbound24h + a.messagesOutbound24h);
    }
  });

  const getWalletBadge = (status: 'active' | 'low' | 'blocked') => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-success/20 text-success border-success/30">Activo</Badge>;
      case 'low':
        return <Badge variant="default" className="bg-warning/20 text-warning border-warning/30">Bajo</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Bloqueado</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      enterprise: 'bg-primary/20 text-primary',
      pro: 'bg-accent/20 text-accent',
      growth: 'bg-success/20 text-success',
      starter: 'bg-secondary text-secondary-foreground',
      trial: 'bg-muted text-muted-foreground',
    };
    return (
      <Badge variant="outline" className={colors[plan] || colors.trial}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const totals = data?.totals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Monitoreo Multi-Tenant</h2>
          <p className="text-sm text-muted-foreground">
            Métricas de uso en tiempo real • Última actualización:{' '}
            {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString('es-MX') : '-'}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Mensajes 24h</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {totals?.totalMessages24h.toLocaleString()}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <span className="text-sm text-muted-foreground">Interacciones IA</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {totals?.totalAIInteractions24h.toLocaleString()}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Balance Total</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {totals?.totalWalletBalance.toLocaleString()}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Requieren Atención</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {totals?.tenantsNeedingAttention}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'messages', label: 'Por Mensajes', icon: MessageSquare },
          { key: 'ai', label: 'Por IA', icon: Bot },
          { key: 'wallet', label: 'Por Wallet', icon: Wallet },
          { key: 'attention', label: 'Atención', icon: AlertTriangle },
        ].map(tab => (
          <Button
            key={tab.key}
            variant={sortBy === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy(tab.key as typeof sortBy)}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tenant Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-[200px]">Tenant</TableHead>
                <TableHead className="text-center">Plan</TableHead>
                <TableHead className="text-center">Msgs 24h</TableHead>
                <TableHead className="text-center">IA 24h</TableHead>
                <TableHead className="text-center">Resp. Avg</TableHead>
                <TableHead className="text-center">Conv. Activas</TableHead>
                <TableHead className="text-center">Wallet</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTenants?.map((tenant) => (
                <TenantRow key={tenant.tenantId} tenant={tenant} />
              ))}
              {(!sortedTenants || sortedTenants.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No hay tenants para mostrar
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Distribución de Planes</span>
          </div>
          <div className="space-y-2">
            {['enterprise', 'pro', 'growth', 'starter', 'trial'].map(plan => {
              const count = data?.tenants.filter(t => t.plan === plan).length || 0;
              const percent = totals?.totalTenants ? (count / totals.totalTenants) * 100 : 0;
              return (
                <div key={plan} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 capitalize">{plan}</span>
                  <Progress value={percent} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Estado de Wallets</span>
          </div>
          <div className="space-y-2">
            {['active', 'low', 'blocked'].map(status => {
              const count = data?.tenants.filter(t => t.walletStatus === status).length || 0;
              const colors = {
                active: 'bg-success',
                low: 'bg-warning',
                blocked: 'bg-destructive',
              };
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 capitalize">{status}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${colors[status as keyof typeof colors]}`}
                      style={{ width: `${totals?.totalTenants ? (count / totals.totalTenants) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Top 5 por Actividad</span>
          </div>
          <div className="space-y-2">
            {data?.tenants.slice(0, 5).map((tenant, i) => {
              const msgs = tenant.messagesInbound24h + tenant.messagesOutbound24h;
              const maxMsgs = data.tenants[0] ? 
                data.tenants[0].messagesInbound24h + data.tenants[0].messagesOutbound24h : 1;
              return (
                <div key={tenant.tenantId} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-xs text-foreground flex-1 truncate">{tenant.tenantName}</span>
                  <Progress value={(msgs / maxMsgs) * 100} className="h-2 w-16" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{msgs}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantRow({ tenant }: { tenant: TenantMetrics }) {
  const totalMsgs = tenant.messagesInbound24h + tenant.messagesOutbound24h;
  const escalationRate = tenant.aiInteractions24h > 0 
    ? Math.round((tenant.aiEscalations24h / tenant.aiInteractions24h) * 100) 
    : 0;

  const needsAttention = tenant.needsHumanCount > 0 || tenant.walletStatus === 'blocked';

  const getWalletBadge = (status: 'active' | 'low' | 'blocked') => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-success/20 text-success border-success/30 text-xs">Activo</Badge>;
      case 'low':
        return <Badge variant="default" className="bg-warning/20 text-warning border-warning/30 text-xs">Bajo</Badge>;
      case 'blocked':
        return <Badge variant="destructive" className="text-xs">Bloqueado</Badge>;
    }
  };

  return (
    <TableRow className={needsAttention ? 'bg-destructive/5' : ''}>
      <TableCell>
        <div className="flex items-center gap-2">
          {needsAttention && (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          )}
          <div>
            <p className="font-medium text-foreground truncate max-w-[150px]">{tenant.tenantName}</p>
            <p className="text-xs text-muted-foreground">
              {tenant.lastActivityAt 
                ? `Últ: ${new Date(tenant.lastActivityAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                : 'Sin actividad'}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs capitalize">
          {tenant.plan}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center">
          <span className="font-medium text-foreground">{totalMsgs}</span>
          <span className="text-xs text-muted-foreground">
            ↓{tenant.messagesInbound24h} ↑{tenant.messagesOutbound24h}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center">
          <span className="font-medium text-foreground">{tenant.aiInteractions24h}</span>
          {tenant.aiEscalations24h > 0 && (
            <span className="text-xs text-warning">
              {escalationRate}% esc.
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <span className={`text-sm ${tenant.aiResponseTimeAvg > 3000 ? 'text-warning' : 'text-muted-foreground'}`}>
          {tenant.aiResponseTimeAvg > 0 ? `${tenant.aiResponseTimeAvg}ms` : '-'}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center">
          <span className="font-medium text-foreground">{tenant.activeConversations}</span>
          {tenant.needsHumanCount > 0 && (
            <span className="text-xs text-destructive">
              {tenant.needsHumanCount} humano
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="font-medium text-foreground">{tenant.walletBalance.toLocaleString()}</span>
          {getWalletBadge(tenant.walletStatus)}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge 
          variant={tenant.status === 'active' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {tenant.status === 'active' ? 'Activo' : tenant.status === 'trial' ? 'Trial' : 'Suspendido'}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
