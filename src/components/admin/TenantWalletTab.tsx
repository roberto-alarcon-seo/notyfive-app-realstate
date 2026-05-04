import { useState } from 'react';
import { MessageSquare, Plus, AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown, History, Loader2, Info, Calendar, Lock, Wallet, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTenantWallet, useAddMessages } from '@/hooks/useWallet';
import { useAdminTenantCredits, getPlanMonthlyCredits } from '@/hooks/useTenantCredits';
import { usePartnerWallet, useRedeemPartnerWalletToTenant } from '@/hooks/usePartnerWallet';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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
  ai_reply: 'Respuesta IA',
  manual_adjustment: 'Ajuste manual',
  external_recharge: 'Recarga vía Core',
  core_adjustment: 'Ajuste vía Core',
  revert_send_failed: 'Reverso (envío fallido)',
};

interface LedgerEntry {
  id: string;
  tenant_id: string;
  movement_type: 'credit' | 'debit';
  amount: number;
  reason: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export function TenantWalletTab({ tenantId }: TenantWalletTabProps) {
  const { data: credits, isLoading: creditsLoading } = useAdminTenantCredits(tenantId);
  const { data: wallet, isLoading: walletLoading } = useTenantWallet(tenantId);
  const addMessages = useAddMessages();

  // Movement history is read directly from the canonical `wallet_ledger`
  // table, which records every credit / debit including external recharges
  // pushed by the Core via `sync-external-core`.
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['wallet-ledger', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_ledger')
        .select(
          'id, tenant_id, movement_type, amount, reason, description, metadata, balance_before, balance_after, created_at',
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    enabled: !!tenantId,
  });

  // Tenant context: detect whether this tenant's billing is managed by the
  // external Core. When true we lock manual adjustments and surface a banner.
  const { data: tenantInfo } = useQuery({
    queryKey: ['tenant-managed-externally', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('managed_externally, billing_state, partner_id, name')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      return data as {
        managed_externally: boolean | null;
        billing_state: string;
        partner_id: string | null;
        name: string;
      };
    },
    enabled: !!tenantId,
  });
  const isManagedExternally = tenantInfo?.managed_externally === true;
  const partnerId = tenantInfo?.partner_id ?? null;
  
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

  if (creditsLoading || walletLoading || ledgerLoading) {
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

  // Aggregate totals from the canonical wallet_ledger so the dashboard
  // counters reflect every movement (including Core recharges).
  const totalTopups =
    ledger?.filter((l) => l.movement_type === 'credit').reduce((sum, l) => sum + l.amount, 0) || 0;
  const totalDebits =
    ledger?.filter((l) => l.movement_type === 'debit').reduce((sum, l) => sum + l.amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Super Wallet assignment (super_admin only, when tenant has partner) */}
      <SuperWalletAssignCard tenantId={tenantId} partnerId={partnerId} />

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
          <Badge variant="outline">{ledger?.length || 0} movimientos</Badge>
        </div>

        {ledger && ledger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-medium py-2 pr-3">Fecha y hora</th>
                  <th className="text-left font-medium py-2 pr-3">Concepto</th>
                  <th className="text-right font-medium py-2 pr-3">Monto</th>
                  <th className="text-right font-medium py-2">Saldo resultante</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => {
                  const isCredit = entry.movement_type === 'credit';
                  const label = reasonLabels[entry.reason] || entry.reason;
                  const description = entry.description?.trim();
                  return (
                    <tr key={entry.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-3 pr-3 text-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), "dd/MM/yyyy hh:mm a", { locale: es })}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-start gap-2">
                          <div
                            className={`mt-0.5 p-1 rounded-md ${
                              isCredit ? 'bg-success/10' : 'bg-muted'
                            }`}
                          >
                            {isCredit ? (
                              <TrendingUp className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            {description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className={`py-3 pr-3 text-right font-medium whitespace-nowrap ${
                          isCredit ? 'text-success' : 'text-foreground'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {entry.amount.toLocaleString('es-MX')}
                      </td>
                      <td className="py-3 text-right text-foreground whitespace-nowrap">
                        {entry.balance_after.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

interface SuperWalletAssignCardProps {
  tenantId: string;
  partnerId: string | null;
}

function SuperWalletAssignCard({ tenantId, partnerId }: SuperWalletAssignCardProps) {
  const { isSuperAdmin } = useAuth();
  const { data: wallet, isLoading } = usePartnerWallet(partnerId);
  const redeem = useRedeemPartnerWalletToTenant();
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  if (!isSuperAdmin || !partnerId) return null;

  const balance = wallet?.balance_credits ?? 0;
  const threshold = wallet?.low_balance_threshold ?? 1000;
  const isCritical = balance > 0 && balance < threshold;
  const isEmpty = balance <= 0;

  const parsed = parseInt(amount, 10);
  const validAmount = Number.isFinite(parsed) && parsed > 0;
  const exceeds = validAmount && parsed > balance;
  const canSubmit = validAmount && !exceeds && !redeem.isPending;

  const handleSubmit = async () => {
    if (!canSubmit || !partnerId) return;
    try {
      await redeem.mutateAsync({
        partnerId,
        tenantId,
        amount: parsed,
        description:
          note.trim() ||
          `Asignación manual de ${parsed.toLocaleString('es-MX')} créditos al tenant`,
      });
      toast.success(
        `${parsed.toLocaleString('es-MX')} créditos asignados al tenant`,
      );
      setAmount('');
      setNote('');
    } catch (e) {
      toast.error('Error al asignar créditos', {
        description: (e as Error).message,
      });
    }
  };

  return (
    <div
      className={`border rounded-xl p-5 space-y-4 ${
        isEmpty
          ? 'border-destructive/40 bg-destructive/5'
          : isCritical
          ? 'border-warning/40 bg-warning/5'
          : 'border-border bg-secondary/30'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Super Wallet del partner
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {isLoading ? '…' : balance.toLocaleString('es-MX')}
              <span className="text-sm text-muted-foreground ml-2">
                créditos disponibles
              </span>
            </p>
          </div>
        </div>
        {isEmpty ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> Sin saldo
          </Badge>
        ) : isCritical ? (
          <Badge variant="secondary" className="gap-1 text-warning">
            <AlertTriangle className="h-3 w-3" /> Saldo bajo
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="text-xs font-medium text-foreground mb-1.5 block">
            Cantidad
          </label>
          <Input
            type="number"
            min={1}
            placeholder="Ej: 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isEmpty}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-foreground mb-1.5 block">
            Nota (opcional)
          </label>
          <Input
            placeholder="Concepto del cargo"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isEmpty}
            maxLength={200}
          />
        </div>
      </div>

      {exceeds && (
        <p className="text-xs text-destructive">
          La cantidad excede el saldo disponible en la Super Wallet (
          {balance.toLocaleString('es-MX')}).
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
          {redeem.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Asignar créditos
        </Button>
      </div>
    </div>
  );
}
