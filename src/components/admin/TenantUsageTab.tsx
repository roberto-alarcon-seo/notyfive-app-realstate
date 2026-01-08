import { useState, useEffect } from 'react';
import { Send, MessageSquareText, Megaphone, MessagesSquare, TrendingUp, TrendingDown, Loader2, Clock, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface TenantUsageTabProps {
  tenantId: string;
}

interface UsageStats {
  messagesSent: number;
  messagesReceived: number;
  activeConversations: number;
  lastInboundAt: string | null;
  walletBalance: number;
  walletStatus: 'active' | 'low' | 'blocked';
}

export function TenantUsageTab({ tenantId }: TenantUsageTabProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Get messages count by direction
        const { data: inboundCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('direction', 'inbound');

        const { data: outboundCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('direction', 'outbound');

        // Get active conversations count
        const { count: conversationsCount } = await supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'open');

        // Get last inbound message
        const { data: lastInbound } = await supabase
          .from('messages')
          .select('created_at')
          .eq('tenant_id', tenantId)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance_messages, status')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        setStats({
          messagesReceived: inboundCount ? (inboundCount as any).length || 0 : 0,
          messagesSent: outboundCount ? (outboundCount as any).length || 0 : 0,
          activeConversations: conversationsCount || 0,
          lastInboundAt: lastInbound?.created_at || null,
          walletBalance: wallet?.balance_messages || 0,
          walletStatus: (wallet?.status as 'active' | 'low' | 'blocked') || 'blocked',
        });
      } catch (error) {
        console.error('Error fetching usage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [tenantId]);

  const getWalletStatusConfig = (status: 'active' | 'low' | 'blocked') => {
    switch (status) {
      case 'active':
        return { label: 'Activo', color: 'text-success', bg: 'bg-success/10' };
      case 'low':
        return { label: 'Bajo', color: 'text-warning', bg: 'bg-warning/10' };
      case 'blocked':
        return { label: 'Bloqueado', color: 'text-destructive', bg: 'bg-destructive/10' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const walletConfig = getWalletStatusConfig(stats?.walletStatus || 'blocked');

  const statCards = [
    {
      icon: MessageSquareText,
      label: 'Mensajes Recibidos',
      sublabel: 'Inbound total',
      value: (stats?.messagesReceived || 0).toLocaleString(),
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      icon: Send,
      label: 'Mensajes Enviados',
      sublabel: 'Outbound total',
      value: (stats?.messagesSent || 0).toLocaleString(),
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      icon: MessagesSquare,
      label: 'Conversaciones Activas',
      sublabel: 'Estado: open',
      value: (stats?.activeConversations || 0).toLocaleString(),
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Wallet Status Card */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${walletConfig.bg}`}>
              <Wallet className={`h-5 w-5 ${walletConfig.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensajes disponibles</p>
              <p className="text-2xl font-semibold text-foreground">
                {(stats?.walletBalance || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={walletConfig.color}>
            {walletConfig.label}
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((stat, index) => {
          const StatIcon = stat.icon;
          
          return (
            <div key={index} className="bg-secondary/30 border border-border rounded-xl p-5">
              <div className="flex items-start mb-4">
                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                  <StatIcon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground/70">{stat.sublabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last Inbound */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Último mensaje recibido</p>
            <p className="text-foreground font-medium">
              {stats?.lastInboundAt 
                ? new Date(stats.lastInboundAt).toLocaleString('es-MX')
                : 'Sin mensajes'}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
        <p>
          Las métricas muestran el total acumulado. 
          Cada mensaje (entrante o saliente) consume 1 crédito del wallet.
        </p>
      </div>
    </div>
  );
}
