import { useState } from 'react';
import { Loader2, Wallet, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  usePartnerWallet, usePartnerLedger, useRedeemPartnerWalletToTenant,
} from '@/hooks/usePartnerWallet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  tenantId: string;
  partnerId: string | null | undefined;
}

export function TenantSuperWalletTab({ tenantId, partnerId }: Props) {
  const { data: wallet, isLoading } = usePartnerWallet(partnerId);
  const { data: ledger } = usePartnerLedger({ partnerId: partnerId ?? undefined });
  const redeem = useRedeemPartnerWalletToTenant();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(1000);
  const [note, setNote] = useState('');

  const balance = wallet?.balance_credits ?? 0;
  const threshold = wallet?.low_balance_threshold ?? 1000;
  const isCritical = balance < threshold;

  const tenantMovements = (ledger ?? []).filter((l) => l.tenant_id === tenantId).slice(0, 10);

  const handleRedeem = async () => {
    if (!partnerId) return;
    if (amount <= 0) { toast.error('Monto inválido'); return; }
    if (amount > balance) { toast.error('Saldo insuficiente en la Super Wallet'); return; }
    try {
      await redeem.mutateAsync({
        partnerId, tenantId, amount,
        description: note || `Asignación de ${amount.toLocaleString('es-MX')} créditos al tenant`,
      });
      toast.success(`${amount.toLocaleString('es-MX')} créditos asignados al tenant`);
      setOpen(false);
      setNote('');
    } catch (e) {
      toast.error('Error al asignar', { description: (e as Error).message });
    }
  };

  if (!partnerId) {
    return <p className="text-sm text-muted-foreground">Este tenant no tiene partner asignado.</p>;
  }

  return (
    <div className="space-y-4">
      <Card className={`p-5 ${isCritical ? 'border-destructive/60 bg-destructive/5' : ''}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Super Wallet del partner
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className={`text-3xl font-semibold ${isCritical ? 'text-destructive' : ''}`}>
                {isLoading ? '…' : balance.toLocaleString('es-MX')}
              </span>
              <span className="text-sm text-muted-foreground">créditos disponibles</span>
              {isCritical && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Saldo crítico
                </Badge>
              )}
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2" disabled={balance <= 0}>
            <Send className="h-4 w-4" /> Asignar al tenant
          </Button>
        </div>
      </Card>

      <div>
        <h4 className="text-sm font-medium mb-2">Movimientos recientes a este tenant</h4>
        {tenantMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin asignaciones registradas.</p>
        ) : (
          <div className="space-y-2">
            {tenantMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted-foreground">
                  {format(new Date(m.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                </span>
                <span className="font-medium text-amber-600">
                  -{m.amount.toLocaleString('es-MX')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar créditos al tenant</DialogTitle>
            <DialogDescription>
              Se descontará de la Super Wallet del partner y se sumará al saldo del tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Monto (créditos)</label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Disponible: {balance.toLocaleString('es-MX')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Nota (opcional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleRedeem} disabled={redeem.isPending}>
              {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}