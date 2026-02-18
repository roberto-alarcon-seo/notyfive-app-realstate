import { useState, useCallback } from "react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Plus, List, Calendar as CalendarIcon, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvents, useEventTypes, EventFilters, Event, getEventTypeLabel } from "@/hooks/useEvents";
import { EventListView } from "@/components/events/EventListView";
import { EventAgendaView } from "@/components/events/EventAgendaView";
import { EventDrawer } from "@/components/events/EventDrawer";
import { EventDetailDrawer } from "@/components/events/EventDetailDrawer";

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'completed', label: 'Completado' },
  { value: 'no_show', label: 'No asistió' },
];

export default function Events() {
  const [view, setView] = useState<'list' | 'agenda'>('agenda');
  const [filters, setFilters] = useState<EventFilters>({});
  const [dateRange, setDateRange] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);

  const { data: events = [], isLoading } = useEvents(filters);
  const { data: eventTypes = [] } = useEventTypes();

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value || undefined }));
  };

  const handleStatusFilter = (value: string) => {
    setFilters(prev => ({ ...prev, status: value === 'all' ? undefined : value }));
  };

  const handleTypeFilter = (value: string) => {
    setFilters(prev => ({ ...prev, event_type: value === 'all' ? undefined : value }));
  };

  const handleDateRangeFilter = (value: string) => {
    setDateRange(value);
    const now = new Date();
    let from_date: string | undefined;
    let to_date: string | undefined;

    if (value === 'today') {
      from_date = startOfDay(now).toISOString();
      to_date = endOfDay(now).toISOString();
    } else if (value === 'week') {
      from_date = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      to_date = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
    } else if (value === 'month') {
      from_date = startOfMonth(now).toISOString();
      to_date = endOfMonth(now).toISOString();
    }

    setFilters(prev => ({ ...prev, from_date, to_date }));
  };

  const handleEventClick = (event: Event) => {
    setViewingEvent(event);
  };

  const handleEditEvent = (event: Event) => {
    setViewingEvent(null);
    setEditingEvent(event);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Citas</h1>
        <Button onClick={() => setIsCreateOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1 md:mr-2" />
          Crear cita
        </Button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col gap-3 p-3 md:p-4 border-b border-border bg-muted/30">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, contacto..."
            className="pl-9"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Filters + View Toggle row */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select onValueChange={handleStatusFilter} defaultValue="all">
            <SelectTrigger className="w-[130px] md:w-[160px] text-xs md:text-sm h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={handleTypeFilter} defaultValue="all">
            <SelectTrigger className="w-[130px] md:w-[160px] text-xs md:text-sm h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {eventTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {getEventTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={handleDateRangeFilter}>
            <SelectTrigger className="w-[130px] md:w-[160px] text-xs md:text-sm h-9">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'agenda')} className="ml-auto">
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="agenda" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                <CalendarIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Agenda
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'list' ? (
          <EventListView
            events={events}
            isLoading={isLoading}
            onEventClick={handleEventClick}
            onEditEvent={handleEditEvent}
          />
        ) : (
          <EventAgendaView
            events={events}
            isLoading={isLoading}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Create/Edit Drawer */}
      <EventDrawer
        open={isCreateOpen || !!editingEvent}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingEvent(null);
          }
        }}
        event={editingEvent}
      />

      {/* Detail Drawer */}
      <EventDetailDrawer
        event={viewingEvent}
        open={!!viewingEvent}
        onOpenChange={(open) => {
          if (!open) setViewingEvent(null);
        }}
        onEdit={handleEditEvent}
      />
    </div>
  );
}
