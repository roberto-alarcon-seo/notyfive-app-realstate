import { useState, useEffect } from "react";
import { CalendarPlus, Building, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCreateEvent } from "@/hooks/useEvents";
import { useProperties } from "@/hooks/useProperties";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { localDatetimeToTimezoneISO } from "@/lib/timezoneUtils";

interface ScheduleVisitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  propertyInterestId?: string | null;
}


export function ScheduleVisitModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  propertyInterestId,
}: ScheduleVisitModalProps) {
  const createEvent = useCreateEvent();
  const { data: properties = [] } = useProperties();

  const [clientName, setClientName] = useState(contactName);
  const [startAt, setStartAt] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyInterestId || "none");
  const [notes, setNotes] = useState("");

  // Sync property interest when modal opens or prop changes
  useEffect(() => {
    if (open) {
      setClientName(contactName);
      setSelectedPropertyId(propertyInterestId || "none");
      setStartAt("");
      setNotes("");
    }
  }, [open, contactName, propertyInterestId]);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setClientName(contactName);
      setStartAt("");
      setSelectedPropertyId(propertyInterestId || "none");
      setNotes("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!startAt) return;

    const trimmedName = clientName.trim();
    if (!trimmedName) {
      toast.error("El nombre del cliente es requerido");
      return;
    }

    // Convert datetime-local to timezone-aware ISO string
    const startISO = localDatetimeToTimezoneISO(startAt);
    const startDate = new Date(startISO);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endISO = endDate.toISOString();

    const metadata: Record<string, string> = {};
    if (selectedPropertyId && selectedPropertyId !== "none") {
      const property = properties.find((p) => p.id === selectedPropertyId);
      if (property) {
        metadata.property_id = property.id;
        metadata.property_title = property.title;
        metadata.property_code = property.property_code || "";
      }
    }

    // 2.1 Update contact name if changed
    if (trimmedName !== contactName) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ name: trimmedName })
        .eq("id", contactId);

      if (updateError) {
        toast.error(`Error al actualizar nombre: ${updateError.message}`);
        return;
      }
    }

    // 2.2 Create the appointment
    await createEvent.mutateAsync({
      contact_id: contactId,
      event_type: "visita",
      title: `Visita - ${trimmedName}`,
      start_at: startISO,
      end_at: endISO,
      status: "scheduled",
      source: "manual",
      notes: notes || undefined,
      metadata,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Agendar cita
          </DialogTitle>
          <DialogDescription>
            Programa una visita para <span className="font-medium text-foreground">{contactName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client Name - First field */}
          <div className="space-y-2">
            <Label htmlFor="visit-client-name" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Nombre del cliente
            </Label>
            <Input
              id="visit-client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre completo del cliente"
            />
            <p className="text-xs text-muted-foreground">
              Se actualizará el nombre en la ficha del contacto
            </p>
          </div>

          {/* Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="visit-start">Fecha y hora</Label>
            <Input
              id="visit-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              La cita tendrá una duración de 1 hora
            </p>
          </div>

          {/* Property selector */}
          {properties.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Inmueble
              </Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar inmueble" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin inmueble</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.property_code ? `[${p.property_code}] ` : ""}{p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="visit-notes">Comentarios (opcional)</Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dirección, indicaciones, observaciones..."
              className="resize-none min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!startAt || !clientName.trim() || createEvent.isPending}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {createEvent.isPending ? "Agendando..." : "Agendar cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
