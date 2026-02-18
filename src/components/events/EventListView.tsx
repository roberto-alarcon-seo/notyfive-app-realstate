import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Edit, XCircle, Eye, CalendarClock, User, Building2 } from "lucide-react";
import { Event, useCancelEvent, getEventTypeLabel } from "@/hooks/useEvents";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

interface EventListViewProps {
  events: Event[];
  isLoading: boolean;
  onEventClick: (event: Event) => void;
  onEditEvent: (event: Event) => void;
}

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Programado", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  canceled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Completado", variant: "outline" },
  no_show: { label: "No asistió", variant: "destructive" },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  api: "API",
  import: "Importado",
  ai: "IA",
};

export function EventListView({ events, isLoading, onEventClick, onEditEvent }: EventListViewProps) {
  const cancelEvent = useCancelEvent();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground">No hay eventos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Crea tu primer evento para comenzar
        </p>
      </div>
    );
  }

  const handleCancel = (event: Event) => {
    if (window.confirm(`¿Estás seguro de cancelar "${event.title}"?`)) {
      cancelEvent.mutate({ id: event.id });
    }
  };

  // Mobile: card layout
  if (isMobile) {
    return (
      <div className="space-y-2">
        {events.map((event) => {
          const statusBadge = STATUS_BADGES[event.status] || STATUS_BADGES.scheduled;
          return (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{event.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    {format(new Date(event.start_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </div>
                </div>
                <Badge variant={statusBadge.variant} className="text-[10px] shrink-0">
                  {statusBadge.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize text-[10px]">
                  {getEventTypeLabel(event.event_type)}
                </Badge>
                {event.contact?.name && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {event.contact.name}
                  </span>
                )}
                {(event.metadata as any)?.property_title && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {(event.metadata as any).property_title}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Desktop: table layout
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Fecha/Hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Propiedad</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead className="w-[80px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const statusBadge = STATUS_BADGES[event.status] || STATUS_BADGES.scheduled;
            return (
              <TableRow
                key={event.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onEventClick(event)}
              >
                <TableCell className="font-medium">
                  {format(new Date(event.start_at), "d MMM yyyy, HH:mm", { locale: es })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {getEventTypeLabel(event.event_type)}
                  </Badge>
                </TableCell>
                <TableCell>{event.title}</TableCell>
                <TableCell>
                  {(event.metadata as any)?.property_title ? (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate max-w-[180px]">{(event.metadata as any).property_title}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{event.contact?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{event.contact?.phone || ""}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {SOURCE_LABELS[event.source] || event.source}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEventClick(event)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditEvent(event)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {event.status !== 'canceled' && event.status !== 'completed' && (
                        <DropdownMenuItem 
                          onClick={() => handleCancel(event)}
                          className="text-destructive"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}