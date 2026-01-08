import { CalendarClock, Check, RefreshCw, User, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import type { Followup } from "@/hooks/useFollowups";

interface FollowupCardProps {
  followup: Followup;
  onComplete: () => void;
  onReschedule: () => void;
  isLoading?: boolean;
}

export function FollowupCard({
  followup,
  onComplete,
  onReschedule,
  isLoading,
}: FollowupCardProps) {
  const dueDate = new Date(followup.due_at);
  const isOverdue = isPast(dueDate) && !isToday(dueDate);
  const isDueToday = isToday(dueDate);
  const isDueTomorrow = isTomorrow(dueDate);

  const getDateLabel = () => {
    if (isOverdue) return "Atrasado";
    if (isDueToday) return "Hoy";
    if (isDueTomorrow) return "Mañana";
    return format(dueDate, "dd MMM", { locale: es });
  };

  const getBadgeVariant = () => {
    if (isOverdue) return "destructive";
    if (isDueToday) return "default";
    return "secondary";
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Seguimiento programado
          </span>
        </div>
        <Badge variant={getBadgeVariant()} className="shrink-0">
          {getDateLabel()}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>
            {format(dueDate, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
          </span>
        </div>

        {followup.assigned_user && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{followup.assigned_user.name}</span>
          </div>
        )}

        {followup.note && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-words">{followup.note}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 text-xs"
          onClick={onComplete}
          disabled={isLoading}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          Completar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={onReschedule}
          disabled={isLoading}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Reagendar
        </Button>
      </div>
    </div>
  );
}
