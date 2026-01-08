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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, CalendarClock, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";

interface CompleteFollowupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onReschedule: (data: { newDueAt: string; note: string | null }) => void;
  isLoading?: boolean;
}

export function CompleteFollowupModal({
  open,
  onOpenChange,
  onComplete,
  onReschedule,
  isLoading = false,
}: CompleteFollowupModalProps) {
  const [action, setAction] = useState<"complete" | "reschedule">("complete");
  const [newDueAt, setNewDueAt] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(10, 0, 0, 0);
    return format(tomorrow, "yyyy-MM-dd'T'HH:mm");
  });
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    if (action === "complete") {
      onComplete();
    } else {
      onReschedule({
        newDueAt: new Date(newDueAt).toISOString(),
        note: note.trim() || null,
      });
    }
  };

  const handleClose = () => {
    setAction("complete");
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Completar seguimiento
          </DialogTitle>
          <DialogDescription>
            ¿Qué acción deseas tomar con este seguimiento?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={action}
            onValueChange={(v) => setAction(v as "complete" | "reschedule")}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="complete" id="complete" className="mt-0.5" />
              <Label htmlFor="complete" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Seguimiento resuelto
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Marca como completado y cierra el seguimiento
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="reschedule" id="reschedule" className="mt-0.5" />
              <Label htmlFor="reschedule" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Reagendar seguimiento
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Programar una nueva fecha para dar seguimiento
                </p>
              </Label>
            </div>
          </RadioGroup>

          {action === "reschedule" && (
            <div className="space-y-4 pt-2 border-t border-border animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <Label htmlFor="reschedule-date">Nueva fecha y hora</Label>
                <Input
                  id="reschedule-date"
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  className="w-full [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reschedule-note">Nota (opcional)</Label>
                <Textarea
                  id="reschedule-note"
                  placeholder="Motivo del reagendamiento o contexto adicional..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
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
            ) : action === "complete" ? (
              "Completar"
            ) : (
              "Reagendar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
