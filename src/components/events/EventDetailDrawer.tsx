import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { es } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Building, 
  FileText, 
  Edit, 
  XCircle, 
  CheckCircle,
  AlertCircle,
  Zap,
  MapPin,
  ExternalLink,
  MessageCircle,
  Trash2,
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

export function EventDetailDrawer({ event, open, onOpenChange, onEdit }: EventDetailDrawerProps) {
  const cancelEvent = useCancelEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: auditLogs = [], isLoading: isLoadingLogs } = useEventAuditLogs(event?.id);

  if (!event) return null;

  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.scheduled;
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  const propertyId = metadata.property_id as string | undefined;
  const propertyTitle = metadata.property_title as string | undefined;
  const propertyCode = metadata.property_code as string | undefined;
  const hasProperty = !!propertyId;

  // Filter out property-related metadata for "other" fields
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[90vh] rounded-t-2xl p-0 flex flex-col" : "w-full sm:max-w-lg p-0 flex flex-col"}>
        {/* Header */}
        <SheetHeader className="p-4 sm:p-6 pb-4 border-b border-border">
          {isMobile && (
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-2" />
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-xs">
                  {getEventTypeLabel(event.event_type)}
                </Badge>
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>
              <SheetTitle className="text-lg leading-tight">{event.title}</SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Date & Time Card */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm capitalize">
                  {format(new Date(event.start_at), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {format(new Date(event.start_at), "HH:mm")}
                  {event.end_at && ` – ${format(new Date(event.end_at), "HH:mm")}`}
                </p>
              </div>
            </div>

            {/* Contact Card */}
            {event.contact && (
              <div className="flex items-center gap-2">
                <div 
                  className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => navigate(`/contacts/${event.contact!.id}`)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                      {contactInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.contact.name}</p>
                    {event.contact.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {event.contact.phone}
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

            {/* Property Card */}
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
                  <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30">
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
                      <div key={key} className="flex justify-between items-center px-3 py-2 text-sm">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-foreground truncate max-w-[200px]">{String(value)}</span>
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

            {/* Automation Placeholder */}
            <div className="bg-muted/20 border border-dashed border-border/60 rounded-lg p-4 text-center">
              <Zap className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-sm font-medium text-muted-foreground">Automatizaciones sugeridas</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Próximamente: recordatorios y confirmaciones automáticas
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 bg-background border-t border-border flex gap-2 shrink-0">
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
      </SheetContent>
    </Sheet>
  );
}
