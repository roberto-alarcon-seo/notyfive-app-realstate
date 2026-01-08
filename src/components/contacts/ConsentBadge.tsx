import { useState, useCallback } from "react";
import { Shield, ShieldAlert, ShieldOff, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useContactConsent, type ConsentStatus } from "@/hooks/useContactConsent";
import ConsentManageModal from "./ConsentManageModal";

interface ConsentBadgeProps {
  contactId: string;
}

function getStatusBadge(status: ConsentStatus, effective: string, dndUntil: string | null) {
  switch (status) {
    case 'allowed':
      return {
        label: 'Permitido',
        shortLabel: 'Permitido',
        icon: ShieldCheck,
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
      };
    case 'opted_out':
      return {
        label: 'Opt-out',
        shortLabel: 'Opt-out',
        icon: ShieldOff,
        className: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
      };
    case 'blocked':
      return {
        label: 'Bloqueado',
        shortLabel: 'Bloqueado',
        icon: ShieldAlert,
        className: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/30',
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
        shortLabel: isExpired ? 'DND expirado' : 'DND',
        icon: Clock,
        className: isExpired 
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
          : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
      };
    default:
      return {
        label: 'Permitido',
        shortLabel: 'Permitido',
        icon: ShieldCheck,
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
      };
  }
}

export default function ConsentBadge({ contactId }: ConsentBadgeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { consent, loading, effectiveStatus, refetch } = useContactConsent(contactId);

  const badge = getStatusBadge(effectiveStatus.status, effectiveStatus.effective, effectiveStatus.dnd_until);
  const BadgeIcon = badge.icon;

  const handleOpenModal = useCallback(() => {
    setPopoverOpen(false);
    // Small delay to ensure popover is closed before modal opens
    setTimeout(() => {
      setIsModalOpen(true);
    }, 100);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSaved = useCallback(async () => {
    setIsModalOpen(false);
    await refetch();
  }, [refetch]);

  if (loading) {
    return <Skeleton className="h-8 w-24" />;
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Gestionar consentimiento"
            className={`${badge.className} rounded-full px-3 py-1.5 text-sm font-medium transition-colors`}
          >
            <BadgeIcon className="h-3.5 w-3.5 mr-1.5" />
            {badge.shortLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Consentimiento</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Estado:</strong> {badge.label}</p>
              <p><strong>Canal:</strong> WhatsApp</p>
              {consent?.reason && (
                <p><strong>Motivo:</strong> {consent.reason.replace(/_/g, ' ')}</p>
              )}
              {consent?.note && (
                <p className="italic">"{consent.note}"</p>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={handleOpenModal}
            >
              Gestionar consentimiento
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ConsentManageModal
        open={isModalOpen}
        contactId={contactId}
        initial={consent}
        onClose={handleCloseModal}
        onSaved={handleSaved}
      />
    </>
  );
}
