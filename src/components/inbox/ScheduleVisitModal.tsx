import { useState } from "react";
import { CalendarPlus } from "lucide-react";
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
import { useCreateEvent } from "@/hooks/useEvents";

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
  const [startAt, setStartAt] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setStartAt("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!startAt) return;

    // Calculate end time: +1 hour
    const startDate = new Date(startAt);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endAt = endDate.toISOString();

    const metadata: Record<string, string> = {};
    if (propertyInterestId) {
      metadata.property_id = propertyInterestId;
    }

    await createEvent.mutateAsync({
      contact_id: contactId,
      event_type: "visita",
      title: `Visita - ${contactName}`,
      start_at: startAt,
      end_at: endAt,
      status: "scheduled",
      source: "manual",
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
