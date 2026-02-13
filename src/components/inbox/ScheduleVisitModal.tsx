import { useState } from "react";
import { format } from "date-fns";
import { CalendarPlus, Building } from "lucide-react";
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

  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyInterestId || "none");

  // Reset form when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const defaultTitle = `Visita - ${contactName}`;
      setTitle(defaultTitle);
      setStartAt("");
      setEndAt("");
      setNotes("");
      setSelectedPropertyId(propertyInterestId || "none");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!startAt) return;

    const metadata: Record<string, string> = {};
    if (selectedPropertyId && selectedPropertyId !== "none") {
      const property = properties.find((p) => p.id === selectedPropertyId);
      if (property) {
        metadata.property_id = property.id;
        metadata.property_title = property.title;
        metadata.property_code = property.property_code || "";
      }
    }

    await createEvent.mutateAsync({
      contact_id: contactId,
      event_type: "visita",
      title: title || `Visita - ${contactName}`,
      start_at: startAt,
      end_at: endAt || undefined,
      status: "scheduled",
      source: "manual",
      notes: notes || undefined,
      metadata,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
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
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="visit-title">Título</Label>
            <Input
              id="visit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Visita departamento Centro"
            />
          </div>

          {/* Property selector */}
          {properties.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Inmueble (opcional)
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

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="visit-start">Fecha y hora *</Label>
              <Input
                id="visit-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visit-end">Fin (opcional)</Label>
              <Input
                id="visit-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="visit-notes">Notas</Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones, dirección, observaciones..."
              className="resize-none min-h-[70px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!startAt || createEvent.isPending}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {createEvent.isPending ? "Agendando..." : "Agendar cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
