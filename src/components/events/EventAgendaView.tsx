import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  format, 
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, 
  startOfMonth, endOfMonth, addMonths, subMonths,
  isSameDay, isToday, isSameMonth 
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Event } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

export function EventAgendaView({ events, isLoading, onEventClick }: EventAgendaViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendaMode, setAgendaMode] = useState<'week' | 'month'>('week');
  const isMobile = useIsMobile();

  // Week calculations
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Month calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthCalendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthCalendarStart, end: monthCalendarEnd });

  const days = agendaMode === 'week' ? weekDays : monthDays;

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, Event[]> = {};
    days.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = events.filter(event => 
        isSameDay(new Date(event.start_at), day)
      ).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    });
    return grouped;
  }, [events, days]);

  const goPrev = () => setCurrentDate(agendaMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  const goNext = () => setCurrentDate(agendaMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = agendaMode === 'week'
    ? `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`
    : format(currentDate, "MMMM yyyy", { locale: es });

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
    <div className="flex flex-col gap-3 md:gap-4">
      {/* Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={goPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={goNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={goToToday} size="sm" className="text-xs md:text-sm h-8 md:h-9">
            Hoy
          </Button>
          <Tabs value={agendaMode} onValueChange={(v) => setAgendaMode(v as 'week' | 'month')} className="ml-1">
            <TabsList className="h-8">
              <TabsTrigger value="week" className="text-xs px-2 md:px-3 h-6">Semana</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2 md:px-3 h-6">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <h2 className="text-sm md:text-lg font-medium capitalize">{headerLabel}</h2>
      </div>

      {/* Week View - Desktop: 7-column grid */}
      {agendaMode === 'week' && !isMobile && (
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
                <div className={cn(
                  "px-2 py-1 text-center border-b border-border",
                  isTodayDay ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <p className="text-xs font-medium uppercase">
                    {format(day, "EEE", { locale: es })}
                  </p>
                  <p className="text-lg font-semibold">{format(day, "d")}</p>
                </div>
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
      )}

      {/* Week View - Mobile: vertical day list */}
      {agendaMode === 'week' && isMobile && (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay[dayKey] || [];
            const isTodayDay = isToday(day);

            return (
              <div
                key={dayKey}
                className={cn(
                  "rounded-lg border border-border overflow-hidden",
                  isTodayDay && "ring-2 ring-primary"
                )}
              >
                <div className={cn(
                  "px-3 py-2 flex items-center gap-2 border-b border-border",
                  isTodayDay ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <span className="text-xs font-medium uppercase">
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span className="text-sm font-semibold">{format(day, "d MMM", { locale: es })}</span>
                  {dayEvents.length > 0 && (
                    <span className="ml-auto text-[10px] opacity-70">{dayEvents.length} evento{dayEvents.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                {dayEvents.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground">Sin eventos</div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={cn(
                          "w-full text-left p-2 rounded border-l-2 text-xs transition-all",
                          STATUS_COLORS[event.status] || STATUS_COLORS.scheduled
                        )}
                      >
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="text-[10px] opacity-80">
                          {format(new Date(event.start_at), "HH:mm")}
                          {event.contact?.name && ` • ${event.contact.name}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {agendaMode === 'month' && (
        <div className="flex flex-col">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAY_NAMES.map((name) => (
              <div key={name} className="text-center text-[10px] md:text-xs font-semibold text-muted-foreground py-1 md:py-2">
                {isMobile ? name.charAt(0) : name}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border/50 border border-border rounded-lg overflow-hidden">
            {monthDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay[dayKey] || [];
              const isTodayDay = isToday(day);
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "bg-background min-h-[60px] md:min-h-[100px] p-0.5 md:p-1 flex flex-col",
                    !isCurrentMonth && "opacity-40"
                  )}
                >
                  {/* Day number */}
                  <div className="flex justify-end mb-0.5">
                    <span
                      className={cn(
                        "text-[10px] md:text-xs font-medium w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full",
                        isTodayDay && "bg-primary text-primary-foreground",
                        !isTodayDay && "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  {/* Events */}
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, isMobile ? 2 : 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={cn(
                          "w-full text-left px-0.5 md:px-1 py-0.5 rounded text-[8px] md:text-[10px] leading-tight truncate border-l-2 transition-colors hover:brightness-110",
                          STATUS_COLORS[event.status] || STATUS_COLORS.scheduled
                        )}
                        title={`${event.title} - ${format(new Date(event.start_at), "HH:mm")}`}
                      >
                        {isMobile ? (
                          <span className="font-medium">{format(new Date(event.start_at), "HH:mm")}</span>
                        ) : (
                          <>
                            <span className="font-medium">{format(new Date(event.start_at), "HH:mm")}</span>{" "}
                            {event.title}
                          </>
                        )}
                      </button>
                    ))}
                    {dayEvents.length > (isMobile ? 2 : 3) && (
                      <p className="text-[8px] md:text-[10px] text-muted-foreground text-center">
                        +{dayEvents.length - (isMobile ? 2 : 3)} más
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            No hay eventos {agendaMode === 'week' ? 'esta semana' : 'este mes'}
          </p>
        </div>
      )}
    </div>
  );
}