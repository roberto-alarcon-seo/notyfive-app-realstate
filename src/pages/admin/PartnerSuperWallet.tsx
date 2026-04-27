import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Plus, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Loader2, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import {
  usePartnerWallet, usePartnerLedger, useTopupPartnerWallet, useAdjustPartnerWallet,
  type LedgerFilters,
} from '@/hooks/usePartnerWallet';

const PRESET_AMOUNTS = [20000, 30000, 50000];

interface PartnerOption { id: string; name: string }

export default function PartnerSuperWallet() {
  const { partnerScope } = useAuth();
  const isGlobal = partnerScope === null;

  // Partner selector (global super admin can pick; partner admin is locked)
  const { data: partners } = useQuery({
    queryKey: ['partners-list-min'],
    enabled: isGlobal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as PartnerOption[];
    },
  });

  const [selectedPartner, setSelectedPartner] = useState<string | null>(
    partnerScope ?? null,
  );
  const activePartnerId = partnerScope ?? selectedPartner ?? partners?.[0]?.id ?? null;

  const { data: wallet, isLoading: walletLoading } = usePartnerWallet(activePartnerId);

  // Filters
  const [tenantQuery, setTenantQuery] = useState('');
  const [movementType, setMovementType] = useState<LedgerFilters['movementType']>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: ledger, isLoading: ledgerLoading } = usePartnerLedger({
    partnerId: activePartnerId ?? undefined,
    tenantQuery,
    movementType,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  });

  // Topup dialog
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(20000);
  const [topupNote, setTopupNote] = useState('');
  const topup = useTopupPartnerWallet();

  // Adjustment dialog (global super admin only)
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustReasonType, setAdjustReasonType] = useState<string>('');
  const adjust = useAdjustPartnerWallet();

  const handleTopup = async () => {
    if (!activePartnerId) return;
    try {
      await topup.mutateAsync({
        partnerId: activePartnerId,
        amount: topupAmount,
        description: topupNote || `Abono manual de ${topupAmount.toLocaleString('es-MX')} créditos`,
      });
      toast.success(`Abonados ${topupAmount.toLocaleString('es-MX')} créditos`);
      setTopupOpen(false);
      setTopupNote('');
    } catch (e) {
      toast.error('Error al abonar', { description: (e as Error).message });
    }
  };

  const handleAdjust = async () => {
    if (!activePartnerId) return;
    const parsed = parseInt(adjustAmount, 10);
    if (!Number.isFinite(parsed) || parsed === 0) {
      toast.error('Ingresa un monto válido distinto de 0');
      return;
    }
    if (!adjustReasonType) {
      toast.error('Selecciona un motivo');
      return;
    }
    if (adjustReasonType === 'Otro' && !adjustReason.trim()) {
      toast.error('Describe el motivo cuando seleccionas "Otro"');
      return;
    }
    const note = adjustReason.trim();
    const finalDescription =
      adjustReasonType === 'Otro'
        ? note
        : note
          ? `${adjustReasonType}: ${note}`
          : adjustReasonType;
    try {
      await adjust.mutateAsync({
        partnerId: activePartnerId,
        amount: parsed,
        description: finalDescription,
      });
      toast.success(
        `Ajuste aplicado: ${parsed > 0 ? '+' : ''}${parsed.toLocaleString('es-MX')} créditos`,
      );
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustReasonType('');
    } catch (e) {
      toast.error('Error al aplicar el ajuste', { description: (e as Error).message });
    }
  };

  const balance = wallet?.balance_credits ?? 0;
  const threshold = wallet?.low_balance_threshold ?? 1000;
  const isCritical = balance < threshold;

  const totals = useMemo(() => {
    if (!ledger) return { topup: 0, redeem: 0 };
    return ledger.reduce(
      (acc, r) => {
        if (r.movement_type === 'TOPUP') acc.topup += r.amount;
        if (r.movement_type === 'REDEEM') acc.redeem += r.amount;
        return acc;
      },
      { topup: 0, redeem: 0 },
    );
  }, [ledger]);

  return (
    <AdminLayout
      title="Super Wallet"
      description="Saldo de créditos y movimientos por marca (partner)"
      actions={
        isGlobal ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setTopupOpen(true)} disabled={!activePartnerId} className="gap-2">
              <Plus className="h-4 w-4" /> Abonar saldo
            </Button>
            <Button
              variant="outline"
              onClick={() => setAdjustOpen(true)}
              disabled={!activePartnerId}
              className="gap-2"
            >
              <Wrench className="h-4 w-4" /> Ajuste de saldo
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Partner selector (global only) */}
        {isGlobal && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Partner:</span>
            <Select
              value={activePartnerId ?? ''}
              onValueChange={(v) => setSelectedPartner(v)}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecciona un partner" />
              </SelectTrigger>
              <SelectContent>
                {(partners ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Balance card */}
        <Card className={`p-6 border ${isCritical ? 'border-destructive/60 bg-destructive/5' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" /> Saldo Super Wallet
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className={`text-4xl font-semibold ${isCritical ? 'text-destructive' : 'text-foreground'}`}>
                  {walletLoading ? '…' : balance.toLocaleString('es-MX')}
                </span>
                <span className="text-sm text-muted-foreground">créditos</span>
                {isCritical && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Saldo crítico (&lt; {threshold.toLocaleString('es-MX')})
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Partner: <span className="font-mono">{activePartnerId ?? '—'}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Abonos (filtrados)</div>
                <div className="text-xl font-semibold text-emerald-500">
                  +{totals.topup.toLocaleString('es-MX')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Asignaciones (filtradas)</div>
                <div className="text-xl font-semibold text-amber-500">
                  -{totals.redeem.toLocaleString('es-MX')}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Filters + Ledger */}
        <Card className="p-4">
          <div className="flex items-end gap-3 flex-wrap mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Tenant</label>
              <Input
                placeholder="Buscar por nombre..."
                value={tenantQuery}
                onChange={(e) => setTenantQuery(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as LedgerFilters['movementType'])}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="TOPUP">Abono</SelectItem>
                  <SelectItem value="REDEEM">Asignación a tenant</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {(tenantQuery || from || to || movementType !== 'ALL') && (
              <Button
                variant="ghost"
                onClick={() => { setTenantQuery(''); setFrom(''); setTo(''); setMovementType('ALL'); }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo después</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell></TableRow>
                ) : (ledger ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Sin movimientos
                  </TableCell></TableRow>
                ) : (
                  ledger!.map((row) => {
                    const isAdjust = row.movement_type === 'ADJUSTMENT';
                    const sign = row.amount > 0 ? '+' : row.amount < 0 ? '-' : '';
                    const amountClass =
                      isAdjust
                        ? row.amount >= 0 ? 'text-emerald-600' : 'text-destructive'
                        : row.movement_type === 'TOPUP' ? 'text-emerald-600' : 'text-amber-600';
                    const amountPrefix =
                      isAdjust ? sign
                        : row.movement_type === 'TOPUP' ? '+' : '-';
                    return (
                    <TableRow key={row.id} className={isAdjust ? 'bg-muted/40' : undefined}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(row.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {row.movement_type === 'TOPUP' && (
                          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600/40">
                            <ArrowUpCircle className="h-3 w-3" /> Abono
                          </Badge>
                        )}
                        {row.movement_type === 'REDEEM' && (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600/40">
                            <ArrowDownCircle className="h-3 w-3" /> Asignación
                          </Badge>
                        )}
                        {isAdjust && (
                          <Badge variant="outline" className="gap-1 text-foreground border-foreground/30">
                            <Wrench className="h-3 w-3" /> Ajuste
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{row.tenant?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className={`text-right font-medium ${amountClass}`}>
                        {amountPrefix}{Math.abs(row.amount).toLocaleString('es-MX')}
                      </TableCell>
                      <TableCell className="text-right">{row.balance_after.toLocaleString('es-MX')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.description ?? '—'}</TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Topup dialog (global super admin only) */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonar créditos a la Super Wallet</DialogTitle>
            <DialogDescription>
              Los créditos se acumulan al saldo actual del partner seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Bolsa</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant={topupAmount === amt ? 'default' : 'outline'}
                    onClick={() => setTopupAmount(amt)}
                  >
                    {amt.toLocaleString('es-MX')}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Nota (opcional)</label>
              <Input
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Ej: Compra orden #1234"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupOpen(false)}>Cancelar</Button>
            <Button onClick={handleTopup} disabled={topup.isPending}>
              {topup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Abonar {topupAmount.toLocaleString('es-MX')} créditos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment dialog (global super admin only) */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Ajuste manual de saldo
            </DialogTitle>
            <DialogDescription>
              Suma (positivo) o resta (negativo) créditos del saldo actual del partner.
              Queda registrado como <span className="font-medium">ADJUSTMENT</span> en la auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Monto (puede ser negativo)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Ej: 1500 ó -500"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saldo actual: {balance.toLocaleString('es-MX')} créditos
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                Motivo <span className="text-destructive">*</span>
              </label>
              <Select value={adjustReasonType} onValueChange={setAdjustReasonType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Error de digitación">Error de digitación</SelectItem>
                  <SelectItem value="Bonificación comercial">Bonificación comercial</SelectItem>
                  <SelectItem value="Compensación técnica">Compensación técnica</SelectItem>
                  <SelectItem value="Anulación de duplicado">Anulación de duplicado</SelectItem>
                  <SelectItem value="Anulación por cancelación">Anulación por cancelación</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {adjustReasonType && (
              <div>
                <label className="text-sm font-medium">
                  {adjustReasonType === 'Otro' ? (
                    <>Descripción <span className="text-destructive">*</span></>
                  ) : (
                    <>Nota adicional <span className="text-muted-foreground">(opcional)</span></>
                  )}
                </label>
                <Textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={
                    adjustReasonType === 'Otro'
                      ? 'Explica el motivo del ajuste'
                      : 'Detalle opcional que se agregará al motivo'
                  }
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAdjust}
              disabled={
                adjust.isPending ||
                !adjustAmount ||
                !adjustReasonType ||
                (adjustReasonType === 'Otro' && !adjustReason.trim())
              }
            >
              {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aplicar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}