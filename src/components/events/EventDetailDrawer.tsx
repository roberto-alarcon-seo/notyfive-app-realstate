import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Tag, 
  FileText, 
  Edit, 
  XCircle, 
  CheckCircle,
  AlertCircle,
  Zap
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Event, useCancelEvent, useUpdateEvent, useEventAuditLogs } from "@/hooks/useEvents";
import { Skeleton } from "@/components/ui/skeleton";

interface EventDetailDrawerProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: Event) => void;
}

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Programado", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  canceled: { label: "Cancelado", variant: "destructive" },
  completed: { label: "Completado", variant: "outline" },
  no_show: { label: "No asistió", variant: "destructive" },
};

const ACTION_LABELS: Record<string, string> = {
  created: "Evento creado",
  updated: "Evento actualizado",
  status_changed: "Estado cambiado",
  canceled: "Evento cancelado",
  rescheduled: "Evento reagendado",
};

export function EventDetailDrawer({ event, open, onOpenChange, onEdit }: EventDetailDrawerProps) {
  const cancelEvent = useCancelEvent();
  const updateEvent = useUpdateEvent();
  const { data: auditLogs = [], isLoading: isLoadingLogs } = useEventAuditLogs(event?.id);

  if (!event) return null;

  const statusBadge = STATUS_BADGES[event.status] || STATUS_BADGES.scheduled;
  const metadataEntries = Object.entries(event.metadata || {});

  const handleCancel = () => {
    if (window.confirm(`¿Estás seguro de cancelar "${event.title}"?`)) {
      cancelEvent.mutate({ id: event.id });
      onOpenChange(false);
    }
  };

  const handleStatusChange = (newStatus: Event['status']) => {
    updateEvent.mutate({ id: event.id, status: newStatus });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline" className="mb-2 capitalize">
                {event.event_type}
              </Badge>
              <SheetTitle className="text-xl">{event.title}</SheetTitle>
            </div>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="px-6 space-y-6">
            {/* Date & Time */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {format(new Date(event.start_at), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(event.start_at), "HH:mm")}
                  {event.end_at && ` - ${format(new Date(event.end_at), "HH:mm")}`}
                </p>
              </div>
            </div>

            {/* Contact */}
            {event.contact && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{event.contact.name}</p>
                  {event.contact.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {event.contact.phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {event.notes && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notas</p>
                  <p className="text-sm mt-1">{event.notes}</p>
                </div>
              </div>
            )}

            {/* Metadata */}
            {metadataEntries.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Campos adicionales
                </p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Quick Actions */}
            {event.status !== 'canceled' && event.status !== 'completed' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Acciones rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {event.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('confirmed')}
                      disabled={updateEvent.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                      Confirmar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange('completed')}
                    disabled={updateEvent.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Completado
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange('no_show')}
                    disabled={updateEvent.isPending}
                  >
                    <AlertCircle className="w-4 h-4 mr-1 text-orange-500" />
                    No asistió
                  </Button>
                </div>
              </div>
            )}

            {/* Audit Log */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Historial del evento</p>
              {isLoadingLogs ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin historial</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{ACTION_LABELS[log.action] || log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Automation Placeholder */}
            <div className="bg-muted/30 border border-dashed border-border rounded-lg p-4 text-center">
              <Zap className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Automatizaciones sugeridas</p>
              <p className="text-xs text-muted-foreground mt-1">
                Próximamente: recordatorios, confirmaciones y follow-ups basados en eventos
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onEdit(event)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          {event.status !== 'canceled' && event.status !== 'completed' && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelEvent.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
