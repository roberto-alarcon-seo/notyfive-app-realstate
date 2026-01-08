import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Event } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EventAgendaViewProps {
  events: Event[];
  isLoading: boolean;
  onEventClick: (event: Event) => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300",
  confirmed: "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300",
  canceled: "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300 line-through opacity-60",
  completed: "bg-muted border-muted-foreground text-muted-foreground",
  no_show: "bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-300",
};

export function EventAgendaView({ events, isLoading, onEventClick }: EventAgendaViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, Event[]> = {};
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = events.filter(event => 
        isSameDay(new Date(event.start_at), day)
      ).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    });
    return grouped;
  }, [events, weekDays]);

  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Hoy
          </Button>
        </div>
        <h2 className="text-lg font-medium">
          {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
        </h2>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2 min-h-[400px]">
        {weekDays.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dayKey] || [];
          const isTodayDay = isToday(day);

          return (
            <div
              key={dayKey}
              className={cn(
                "flex flex-col border border-border rounded-lg overflow-hidden",
                isTodayDay && "ring-2 ring-primary"
              )}
            >
              {/* Day Header */}
              <div className={cn(
                "px-2 py-1 text-center border-b border-border",
                isTodayDay ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <p className="text-xs font-medium uppercase">
                  {format(day, "EEE", { locale: es })}
                </p>
                <p className="text-lg font-semibold">
                  {format(day, "d")}
                </p>
              </div>

              {/* Day Events */}
              <div className="flex-1 p-1 space-y-1 overflow-y-auto max-h-[300px]">
                {dayEvents.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                    Sin eventos
                  </div>
                ) : (
                  dayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className={cn(
                        "w-full text-left p-1.5 rounded border-l-2 text-xs transition-all hover:scale-[1.02]",
                        STATUS_COLORS[event.status] || STATUS_COLORS.scheduled
                      )}
                    >
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-[10px] opacity-80">
                        {format(new Date(event.start_at), "HH:mm")}
                        {event.contact?.name && ` • ${event.contact.name}`}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No hay eventos esta semana</p>
        </div>
      )}
    </div>
  );
}
