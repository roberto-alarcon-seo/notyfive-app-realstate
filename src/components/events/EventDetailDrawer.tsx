import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { es } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  Phone, 
  Building, 
  FileText, 
  Edit, 
  XCircle, 
  CheckCircle,
  AlertCircle,
  MapPin,
  ExternalLink,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Event, useCancelEvent, useUpdateEvent, useDeleteEvent, useEventAuditLogs, getEventTypeLabel } from "@/hooks/useEvents";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface EventDetailDrawerProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: Event) => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  scheduled: { label: "Programado", variant: "secondary", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  confirmed: { label: "Confirmado", variant: "default", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  canceled: { label: "Cancelado", variant: "destructive", className: "bg-destructive/15 text-destructive border-destructive/30" },
  completed: { label: "Completado", variant: "outline", className: "bg-primary/15 text-primary border-primary/30" },
  no_show: { label: "No asistió", variant: "destructive", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

const ACTION_LABELS: Record<string, string> = {
  created: "Evento creado",
  updated: "Evento actualizado",
  status_changed: "Estado cambiado",
  canceled: "Evento cancelado",
  rescheduled: "Evento reagendado",
};

function EventDetailContent({ event, onOpenChange, onEdit }: { event: Event; onOpenChange: (open: boolean) => void; onEdit: (event: Event) => void }) {
  const cancelEvent = useCancelEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const navigate = useNavigate();
  const { data: auditLogs = [], isLoading: isLoadingLogs } = useEventAuditLogs(event.id);

  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.scheduled;
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  const propertyId = metadata.property_id as string | undefined;
  const propertyTitle = metadata.property_title as string | undefined;
  const propertyCode = metadata.property_code as string | undefined;
  const hasProperty = !!propertyId;

  const otherMetadata = Object.entries(metadata).filter(
    ([key]) => !['property_id', 'property_title', 'property_code'].includes(key)
  );

  const contactInitials = event.contact?.name
    ? event.contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'C';

  const handleCancel = () => {
    if (window.confirm(`¿Estás seguro de cancelar "${event.title}"?`)) {
      cancelEvent.mutate({ id: event.id });
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`¿Estás seguro de eliminar "${event.title}"? Esta acción no se puede deshacer.`)) {
      deleteEvent.mutate(event.id);
      onOpenChange(false);
    }
  };

  const handleStatusChange = (newStatus: Event['status']) => {
    updateEvent.mutate({ id: event.id, status: newStatus });
  };

  const isActive = event.status !== 'canceled' && event.status !== 'completed' && event.status !== 'no_show';

  return (
    <>
      {/* Header */}
      <div className="p-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="capitalize text-xs">
            {getEventTypeLabel(event.event_type)}
          </Badge>
          <Badge className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>
        <h2 className="text-lg font-semibold text-foreground leading-tight">{event.title}</h2>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-4">
          {/* Date & Time */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm capitalize">
                {format(new Date(event.start_at), "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {format(new Date(event.start_at), "HH:mm")}
                {event.end_at && ` – ${format(new Date(event.end_at), "HH:mm")}`}
              </p>
            </div>
          </div>

          {/* Contact */}
          {event.contact && (
            <div className="flex items-center gap-2">
              <div 
                className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 cursor-pointer hover:bg-muted/60 transition-colors min-w-0"
                onClick={() => navigate(`/contacts/${event.contact!.id}`)}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                    {contactInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{event.contact.name}</p>
                  {event.contact.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="truncate">{event.contact.phone}</span>
                    </p>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0"
                title="Ir al chat"
                onClick={() => navigate(`/inbox?contact_id=${event.contact!.id}`)}
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Property */}
          {hasProperty && (
            <div 
              className="p-3 rounded-lg border border-border/50 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/properties/${propertyId}`)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                    <MapPin className="w-3 h-3" />
                    Inmueble a visitar
                  </p>
                  <p className="font-medium text-sm truncate">{propertyTitle || 'Propiedad'}</p>
                  {propertyCode && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
                      {propertyCode}
                    </Badge>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Comentarios
                </p>
                <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 break-words">
                  {event.notes}
                </p>
              </div>
            </>
          )}

          {/* Other Metadata */}
          {otherMetadata.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Campos adicionales
                </p>
                <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                  {otherMetadata.map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center px-3 py-2 text-sm gap-2">
                      <span className="text-muted-foreground capitalize shrink-0">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-foreground truncate">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Quick Actions */}
          {isActive && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Acciones rápidas
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {event.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-auto py-2.5 flex-col gap-1 border-green-500/30 hover:bg-green-500/10 hover:text-green-400"
                      onClick={() => handleStatusChange('confirmed')}
                      disabled={updateEvent.isPending}
                    >
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs">Confirmar</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-auto py-2.5 flex-col gap-1 border-primary/30 hover:bg-primary/10 hover:text-primary"
                    onClick={() => handleStatusChange('completed')}
                    disabled={updateEvent.isPending}
                  >
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-xs">Completado</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-auto py-2.5 flex-col gap-1 border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-400"
                    onClick={() => handleStatusChange('no_show')}
                    disabled={updateEvent.isPending}
                  >
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-xs">No asistió</span>
                  </Button>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Audit Log */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Historial
            </p>
            {isLoadingLogs ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin historial</p>
            ) : (
              <div className="space-y-0 relative pl-4 border-l-2 border-border/50">
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative pb-3 last:pb-0">
                    <div className="absolute -left-[calc(1rem+5px)] top-1.5 w-2 h-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">{ACTION_LABELS[log.action] || log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border flex gap-2 shrink-0">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => onEdit(event)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Editar
        </Button>
        {isActive && (
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelEvent.isPending}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        )}
        {event.status === 'canceled' && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteEvent.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar
          </Button>
        )}
      </div>
    </>
  );
}

export function EventDetailDrawer({ event, open, onOpenChange, onEdit }: EventDetailDrawerProps) {
  const isMobile = useIsMobile();

  if (!event) return null;

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 flex flex-col max-w-[100vw] overflow-x-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{event.title}</SheetTitle>
          </SheetHeader>
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-3 mb-1" />
          <EventDetailContent event={event} onOpenChange={onOpenChange} onEdit={onEdit} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: centered modal
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 !flex !flex-col max-h-[85vh] overflow-hidden gap-0">
        <DialogTitle className="sr-only">{event.title}</DialogTitle>
        <EventDetailContent event={event} onOpenChange={onOpenChange} onEdit={onEdit} />
      </DialogContent>
    </Dialog>
  );
}
