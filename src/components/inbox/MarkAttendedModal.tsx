import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, CalendarClock, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";

interface MarkAttendedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { 
    note: string | null; 
    scheduleFollowup: boolean; 
    followupDueAt?: string;
    followupNote?: string;
  }) => void;
  isLoading?: boolean;
}

export function MarkAttendedModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: MarkAttendedModalProps) {
  const [note, setNote] = useState("");
  const [scheduleFollowup, setScheduleFollowup] = useState(false);
  const [followupDueAt, setFollowupDueAt] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(10, 0, 0, 0);
    return format(tomorrow, "yyyy-MM-dd'T'HH:mm");
  });
  const [followupNote, setFollowupNote] = useState("");

  const handleConfirm = () => {
    onConfirm({
      note: note.trim() || null,
      scheduleFollowup,
      followupDueAt: scheduleFollowup ? new Date(followupDueAt).toISOString() : undefined,
      followupNote: scheduleFollowup ? (followupNote.trim() || undefined) : undefined,
    });
  };

  const handleClose = () => {
    setNote("");
    setScheduleFollowup(false);
    setFollowupNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Marcar como atendido
          </DialogTitle>
          <DialogDescription>
            Esto quita el estado de atención humana. Puedes dejar una nota interna y programar un seguimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Attendance Note */}
          <div className="space-y-2">
            <Label htmlFor="attended-note">Nota de atención (opcional)</Label>
            <Textarea
              id="attended-note"
              placeholder="Ej: Cliente confirmó pedido, se le envió información de pago..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Schedule Follow-up Checkbox */}
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-muted/20">
            <Checkbox
              id="schedule-followup"
              checked={scheduleFollowup}
              onCheckedChange={(checked) => setScheduleFollowup(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="schedule-followup" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <CalendarClock className="h-4 w-4 text-primary" />
                Programar seguimiento
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Agendar un recordatorio para dar seguimiento después
              </p>
            </Label>
          </div>

          {/* Follow-up Fields (shown when checkbox is checked) */}
          {scheduleFollowup && (
            <div className="space-y-4 pt-2 border-t border-border animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <Label htmlFor="followup-date">Fecha y hora del seguimiento</Label>
                <Input
                  id="followup-date"
                  type="datetime-local"
                  value={followupDueAt}
                  onChange={(e) => setFollowupDueAt(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  className="w-full [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="followup-note">Nota del seguimiento (opcional)</Label>
                <Textarea
                  id="followup-note"
                  placeholder="Ej: Recordar llamar para confirmar disponibilidad..."
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
