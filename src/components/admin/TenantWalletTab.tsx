import { useState } from 'react';
import { MessageSquare, Plus, AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown, History, Loader2, Info, Calendar, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTenantWallet, useTenantWalletTransactions, useAddMessages } from '@/hooks/useWallet';
import { useAdminTenantCredits, getPlanMonthlyCredits } from '@/hooks/useTenantCredits';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TenantWalletTabProps {
  tenantId: string;
}

const reasonLabels: Record<string, string> = {
  inbound_message: 'Mensaje entrante',
  outbound_message: 'Mensaje saliente',
  campaign_message: 'Mensaje de campaña',
  template_message: 'Template',
  manual_adjustment: 'Ajuste manual',
};

export function TenantWalletTab({ tenantId }: TenantWalletTabProps) {
  const { data: credits, isLoading: creditsLoading } = useAdminTenantCredits(tenantId);
  const { data: wallet, isLoading: walletLoading } = useTenantWallet(tenantId);
  const { data: transactions, isLoading: txLoading } = useTenantWalletTransactions(tenantId);
  const addMessages = useAddMessages();

  // Tenant context: detect whether this tenant's billing is managed by the
  // external Core. When true we lock manual adjustments and surface a banner.
  const { data: tenantInfo } = useQuery({
    queryKey: ['tenant-managed-externally', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('managed_externally, billing_state')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      return data as { managed_externally: boolean | null; billing_state: string };
    },
    enabled: !!tenantId,
  });
  const isManagedExternally = tenantInfo?.managed_externally === true;
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [messagesToAdd, setMessagesToAdd] = useState('');

  const getStatusConfig = (status: 'active' | 'low' | 'blocked') => {
    switch (status) {
      case 'active':
        return { 
          icon: CheckCircle2, 
          label: 'Activo', 
          color: 'text-success', 
          bg: 'bg-success/10',
          badge: 'default' as const
        };
      case 'low':
        return { 
          icon: AlertTriangle, 
          label: 'Saldo Bajo', 
          color: 'text-warning', 
          bg: 'bg-warning/10',
          badge: 'secondary' as const
        };
      case 'blocked':
        return { 
          icon: XCircle, 
          label: 'Bloqueado', 
          color: 'text-destructive', 
          bg: 'bg-destructive/10',
          badge: 'destructive' as const
        };
    }
  };

  const handleAddMessages = async () => {
    const messages = parseInt(messagesToAdd, 10);
    if (!wallet || isNaN(messages) || messages <= 0) return;

    await addMessages.mutateAsync({
      tenantId,
      walletId: wallet.id,
      messages,
    });

    setShowAddDialog(false);
    setMessagesToAdd('');
  };

  if (creditsLoading || walletLoading || txLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!wallet || !credits) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-3" />
        <p className="text-muted-foreground">No se encontró wallet para este tenant</p>
      </div>
    );
  }

  // Use the new credit system
  const monthlyRemaining = credits.monthly_credits_remaining ?? 0;
  const accumulated = credits.accumulated_credits ?? 0;
  const totalCredits = monthlyRemaining + accumulated;
  const planCredits = getPlanMonthlyCredits(credits.plan);

  // Determine status based on total credits
  const walletStatus = totalCredits <= 0 ? 'blocked' : totalCredits <= 100 ? 'low' : 'active';
  const statusConfig = getStatusConfig(walletStatus);
  const StatusIcon = statusConfig.icon;

  // Format next refill date
  const nextRefillDate = credits.next_refill_at 
    ? format(new Date(credits.next_refill_at), "d MMM yyyy", { locale: es })
    : "—";

  // Calculate totals from transactions
  const totalTopups = transactions?.filter(t => t.type === 'topup').reduce((sum, t) => sum + t.messages, 0) || 0;
  const totalDebits = transactions?.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.messages, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-secondary/30 border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Créditos Disponibles</p>
              <p className="text-3xl font-semibold text-foreground">
                {totalCredits.toLocaleString('es-MX')}
                <span className="text-lg text-muted-foreground ml-2">créditos</span>
              </p>
            </div>
          </div>
          <Badge variant={statusConfig.badge} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Monthly/Accumulated Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Del mes</p>
            <p className="text-lg font-semibold text-foreground">
              {monthlyRemaining.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-muted-foreground">de {planCredits.toLocaleString('es-MX')}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">Acumulados</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs">
                    Créditos de meses anteriores que no se usaron (rollover)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-lg font-semibold text-primary">
              {accumulated.toLocaleString('es-MX')}
            </p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Próxima recarga</p>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {nextRefillDate}
            </p>
          </div>
        </div>

        {/* Action */}
        {isManagedExternally ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Gestionado por el Core</p>
              <p className="text-muted-foreground">
                El saldo y estado de suscripción son dictados por el Core. Los ajustes
                manuales están deshabilitados.
              </p>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowAddDialog(true)} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Créditos
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">Total Recargado</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {totalTopups.toLocaleString('es-MX')} créditos
          </p>
        </div>
        
        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Consumido</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {totalDebits.toLocaleString('es-MX')} créditos
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-foreground">Historial de Movimientos</h3>
          </div>
          <Badge variant="outline">{transactions?.length || 0} movimientos</Badge>
        </div>
        
        {transactions && transactions.length > 0 ? (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${
                    tx.type === 'topup' ? 'bg-success/10' : 'bg-muted'
                  }`}>
                    {tx.type === 'topup' ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {reasonLabels[tx.reason] || tx.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${
                  tx.type === 'topup' ? 'text-success' : 'text-foreground'
                }`}>
                  {tx.type === 'topup' ? '+' : '-'}{tx.messages}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay movimientos registrados
          </p>
        )}
      </div>

      {/* Blocking Info */}
      <div className="text-sm text-muted-foreground bg-warning/10 border border-warning/20 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <div>
            <p className="font-medium text-foreground mb-1">Política de bloqueo</p>
            <p>
              El envío y recepción de mensajes se bloqueará cuando el saldo total sea 0. 
              Se consume primero del mes actual, luego de los acumulados.
            </p>
          </div>
        </div>
      </div>

      {/* Add Messages Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Créditos</DialogTitle>
            <DialogDescription>
              Ingresa la cantidad de créditos a agregar. Se añadirán a los créditos acumulados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Cantidad de créditos
            </label>
            <Input
              type="number"
              min="1"
              value={messagesToAdd}
              onChange={(e) => setMessagesToAdd(e.target.value)}
              placeholder="Ej: 1000"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddMessages}
              disabled={addMessages.isPending || !messagesToAdd || parseInt(messagesToAdd) <= 0}
            >
              {addMessages.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
