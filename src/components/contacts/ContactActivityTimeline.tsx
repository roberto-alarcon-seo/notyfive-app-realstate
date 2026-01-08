import { 
  CheckCircle2, 
  CalendarClock, 
  Bot, 
  AlertTriangle,
  User,
  XCircle,
  Activity,
  Loader2,
  StickyNote,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useContactActivity, type ContactActivityEvent } from "@/hooks/useContactActivity";
import { cn } from "@/lib/utils";

interface ContactActivityTimelineProps {
  contactId: string;
}

export function ContactActivityTimeline({ contactId }: ContactActivityTimelineProps) {
  const { data: activities = [], isLoading } = useContactActivity(contactId);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'human_marked_attended':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'followup_scheduled':
        return <CalendarClock className="h-4 w-4 text-primary" />;
      case 'followup_completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'followup_rescheduled':
        return <RefreshCw className="h-4 w-4 text-primary" />;
      case 'followup_canceled':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case 'ai_escalated':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'ai_reactivated':
        return <Bot className="h-4 w-4 text-purple-500" />;
      case 'note_added':
        return <StickyNote className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'human_marked_attended':
        return 'Atendido';
      case 'followup_scheduled':
        return 'Seguimiento programado';
      case 'followup_completed':
        return 'Seguimiento completado';
      case 'followup_rescheduled':
        return 'Seguimiento reagendado';
      case 'followup_canceled':
        return 'Seguimiento cancelado';
      case 'ai_escalated':
        return 'Escalado a humano';
      case 'ai_reactivated':
        return 'IA reactivada';
      case 'note_added':
        return 'Nota agregada';
      default:
        return eventType;
    }
  };

  const getEventDescription = (event: ContactActivityEvent) => {
    const payload = event.payload as Record<string, unknown> | null;
    
    switch (event.event_type) {
      case 'human_marked_attended':
        return payload?.note ? `Nota: ${payload.note}` : null;
      case 'followup_scheduled':
        if (payload?.due_at) {
          const dueDate = new Date(payload.due_at as string);
          return `Para: ${format(dueDate, "dd MMM yyyy 'a las' HH:mm", { locale: es })}`;
        }
        return null;
      case 'followup_rescheduled':
        if (payload?.new_due_at) {
          const newDueDate = new Date(payload.new_due_at as string);
          let text = `Nueva fecha: ${format(newDueDate, "dd MMM yyyy 'a las' HH:mm", { locale: es })}`;
          if (payload?.note) {
            text += ` - ${payload.note}`;
          }
          return text;
        }
        return payload?.note ? String(payload.note) : null;
      case 'ai_escalated':
        const reason = payload?.reason as string;
        if (reason === 'human_request') return 'El cliente solicitó hablar con una persona';
        if (reason === 'frustration') return 'Se detectó frustración en el cliente';
        if (reason === 'no_answer') return 'La IA no encontró respuesta adecuada';
        if (reason === 'no_balance') return 'Sin saldo disponible';
        if (reason === 'error') return 'Error en el servicio de IA';
        return null;
      default:
        return payload?.note ? String(payload.note) : null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Sin actividad registrada</p>
        <p className="text-sm mt-1">Las interacciones con este contacto aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((event, index) => {
        const description = getEventDescription(event);
        const actorName = event.actor_user?.name || (event.actor_type === 'ai' ? 'IA' : 'Sistema');
        
        return (
          <div
            key={event.id}
            className={cn(
              "relative pl-6 pb-4",
              index !== activities.length - 1 && "border-l border-border ml-2"
            )}
          >
            {/* Timeline dot */}
            <div className="absolute left-0 -translate-x-1/2 bg-background p-1 rounded-full border border-border">
              {getEventIcon(event.event_type)}
            </div>
            
            {/* Event content */}
            <div className="ml-4 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">
                  {getEventLabel(event.event_type)}
                </span>
                {event.actor_type === 'user' && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    {actorName}
                  </Badge>
                )}
                {event.actor_type === 'ai' && (
                  <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/30">
                    <Bot className="h-3 w-3 mr-1" />
                    IA
                  </Badge>
                )}
              </div>
              
              {description && (
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
              
              <p className="text-xs text-muted-foreground">
                {format(new Date(event.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                {' · '}
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: es })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
