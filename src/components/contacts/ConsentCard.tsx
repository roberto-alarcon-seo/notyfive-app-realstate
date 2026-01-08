import { useState } from "react";
import { Shield, ShieldAlert, ShieldOff, ShieldCheck, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContactConsent, getEffectiveStatus, type ConsentStatus } from "@/hooks/useContactConsent";
import ConsentManageModal from "./ConsentManageModal";

interface ConsentCardProps {
  contactId: string;
}

function getStatusBadge(status: ConsentStatus, effective: string, dndUntil: string | null) {
  switch (status) {
    case 'allowed':
      return {
        label: 'Permitido',
        icon: ShieldCheck,
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
    case 'opted_out':
      return {
        label: 'Opt-out',
        icon: ShieldOff,
        className: 'bg-red-500/15 text-red-400 border-red-500/30',
      };
    case 'blocked':
      return {
        label: 'Bloqueado',
        icon: ShieldAlert,
        className: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
      };
    case 'dnd':
      const isExpired = effective === 'dnd_expired';
      const untilStr = dndUntil 
        ? new Date(dndUntil).toLocaleDateString('es-MX', { 
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
          })
        : 'indefinido';
      return {
        label: isExpired ? 'DND expirado' : `DND hasta ${untilStr}`,
        icon: Clock,
        className: isExpired 
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      };
    default:
      return {
        label: 'Permitido',
        icon: ShieldCheck,
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
  }
}

export default function ConsentCard({ contactId }: ConsentCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { consent, loading, effectiveStatus, refetch } = useContactConsent(contactId);

  const badge = getStatusBadge(effectiveStatus.status, effectiveStatus.effective, effectiveStatus.dnd_until);
  const BadgeIcon = badge.icon;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Consentimiento</CardTitle>
            </div>
            <Badge variant="outline" className={badge.className}>
              <BadgeIcon className="h-3.5 w-3.5 mr-1.5" />
              {badge.label}
            </Badge>
          </div>
          <CardDescription>Canal: WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {consent?.reason 
                ? `Motivo: ${consent.reason.replace(/_/g, ' ')}`
                : 'Sin restricciones'}
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              Gestionar
            </Button>
          </div>
          {consent?.note && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              "{consent.note}"
            </p>
          )}
        </CardContent>
      </Card>

      <ConsentManageModal
        open={isModalOpen}
        contactId={contactId}
        initial={consent}
        onClose={() => setIsModalOpen(false)}
        onSaved={async () => {
          setIsModalOpen(false);
          await refetch();
        }}
      />
    </>
  );
}
