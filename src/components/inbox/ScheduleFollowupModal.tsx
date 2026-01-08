import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, addDays, addHours, setHours, setMinutes } from "date-fns";

interface ScheduleFollowupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (data: { due_at: string; note: string }) => void;
  isLoading?: boolean;
}

export function ScheduleFollowupModal({
  open,
  onOpenChange,
  onSchedule,
  isLoading,
}: ScheduleFollowupModalProps) {
  // Default to tomorrow at 10:00 AM
  const getDefaultDateTime = () => {
    const tomorrow = addDays(new Date(), 1);
    const withTime = setMinutes(setHours(tomorrow, 10), 0);
    return format(withTime, "yyyy-MM-dd'T'HH:mm");
  };

  const [dueAt, setDueAt] = useState(getDefaultDateTime());
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    onSchedule({
      due_at: new Date(dueAt).toISOString(),
      note,
    });
  };

  const handleQuickSelect = (hours: number) => {
    const future = addHours(new Date(), hours);
    setDueAt(format(future, "yyyy-MM-dd'T'HH:mm"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 shrink-0 text-[hsl(var(--primary))]" />
            Programar seguimiento
          </DialogTitle>
          <DialogDescription>
            Agenda un recordatorio para dar seguimiento a esta conversación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(1)}
            >
              En 1 hora
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(24)}
            >
              Mañana
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(48)}
            >
              En 2 días
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(168)}
            >
              En 1 semana
            </Button>
          </div>

          {/* Date/time picker */}
          <div className="space-y-2">
            <Label htmlFor="due_at">Fecha y hora</Label>
            <Input
              id="due_at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="w-full [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Confirmar disponibilidad del producto, revisar cotización..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !dueAt}>
            {isLoading ? "Programando..." : "Programar seguimiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
