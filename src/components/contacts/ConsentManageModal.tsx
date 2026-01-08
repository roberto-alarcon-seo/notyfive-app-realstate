import { useState, useMemo } from "react";
import { X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContactConsent, type ConsentStatus, type ContactConsent } from "@/hooks/useContactConsent";

interface ConsentManageModalProps {
  open: boolean;
  contactId: string;
  initial: ContactConsent | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS: { value: ConsentStatus; label: string; description: string }[] = [
  { 
    value: 'allowed', 
    label: 'Permitido', 
    description: 'El contacto puede recibir mensajes' 
  },
  { 
    value: 'opted_out', 
    label: 'Opt-out', 
    description: 'El contacto pidió no recibir mensajes' 
  },
  { 
    value: 'dnd', 
    label: 'No molestar (DND)', 
    description: 'Pausa temporal de mensajes' 
  },
  { 
    value: 'blocked', 
    label: 'Bloqueado', 
    description: 'Bloqueo interno permanente' 
  },
];

export default function ConsentManageModal({ 
  open,
  contactId, 
  initial, 
  onClose, 
  onSaved 
}: ConsentManageModalProps) {
  const { updateConsent, saving } = useContactConsent(contactId);
  
  const [status, setStatus] = useState<ConsentStatus>(initial?.status || 'allowed');
  const [dndUntil, setDndUntil] = useState(
    initial?.dnd_until 
      ? new Date(initial.dnd_until).toISOString().slice(0, 16) 
      : ''
  );
  const [note, setNote] = useState(initial?.note || '');

  const isDnd = status === 'dnd';

  const reason = useMemo(() => {
    switch (status) {
      case 'opted_out': return 'manual_opt_out';
      case 'blocked': return 'manual_blocked';
      case 'dnd': return 'manual_dnd';
      default: return 'manual_allowed';
    }
  }, [status]);

  const handleSave = async () => {
    const success = await updateConsent(status, {
      dnd_until: isDnd && dndUntil ? new Date(dndUntil).toISOString() : null,
      reason,
      note: note.trim() || undefined,
      source: 'ui',
    });

    if (success) {
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Gestionar consentimiento
          </DialogTitle>
          <DialogDescription>
            Configura el estado de consentimiento para WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ConsentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground group-data-[highlighted]:text-accent-foreground/90 group-data-[state=checked]:text-accent-foreground/90">
                        {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isDnd && (
            <div className="space-y-2">
              <Label htmlFor="dnd-until">DND hasta (opcional)</Label>
              <Input
                id="dnd-until"
                type="datetime-local"
                value={dndUntil}
                onChange={(e) => setDndUntil(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si lo dejas vacío, el DND será indefinido hasta que lo cambies manualmente.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              placeholder="Ej. Usuario pidió baja por WhatsApp"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
