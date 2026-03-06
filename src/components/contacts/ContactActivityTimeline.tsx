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
  RefreshCw,
  Pin,
  ArrowRightLeft,
  CalendarX,
  CalendarPlus,
  PauseCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useContactActivity, type ContactActivityEvent } from "@/hooks/useContactActivity";
import { useContactNotes, type ContactNote } from "@/hooks/useContactNotes";
import { cn } from "@/lib/utils";

interface ContactActivityTimelineProps {
  contactId: string;
}

type TimelineItem = 
  | { kind: 'activity'; data: ContactActivityEvent }
  | { kind: 'note'; data: ContactNote };

export function ContactActivityTimeline({ contactId }: ContactActivityTimelineProps) {
  const { data: activities = [], isLoading: isLoadingActivity } = useContactActivity(contactId);
  const { data: notes = [], isLoading: isLoadingNotes } = useContactNotes(contactId);

  const isLoading = isLoadingActivity || isLoadingNotes;

  // Merge and sort
  const timelineItems: TimelineItem[] = [
    ...activities.map((a): TimelineItem => ({ kind: 'activity', data: a })),
    ...notes.map((n): TimelineItem => ({ kind: 'note', data: n })),
  ].sort((a, b) => {
    const dateA = new Date(a.data.created_at).getTime();
    const dateB = new Date(b.data.created_at).getTime();
    return dateB - dateA;
  });

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
      case 'ai_paused':
        return <PauseCircle className="h-4 w-4 text-amber-500" />;
      case 'note_added':
        return <StickyNote className="h-4 w-4 text-primary" />;
      case 'visit_scheduled':
        return <CalendarPlus className="h-4 w-4 text-primary" />;
      case 'visit_canceled':
        return <CalendarX className="h-4 w-4 text-destructive" />;
      case 'pipeline_stage_changed':
        return <ArrowRightLeft className="h-4 w-4 text-primary" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'human_marked_attended': return 'Atendido';
      case 'followup_scheduled': return 'Seguimiento programado';
      case 'followup_completed': return 'Seguimiento completado';
      case 'followup_rescheduled': return 'Seguimiento reagendado';
      case 'followup_canceled': return 'Seguimiento cancelado';
      case 'ai_escalated': return 'Escalado a humano';
      case 'ai_reactivated': return 'IA reactivada';
      case 'ai_paused': return 'IA pausada manualmente';
      case 'note_added': return 'Nota agregada';
      case 'visit_scheduled': return 'Cita agendada';
      case 'visit_canceled': return 'Cita cancelada';
      case 'pipeline_stage_changed': return 'Cambio de etapa';
      default: return eventType;
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
          if (payload?.note) text += ` - ${payload.note}`;
          return text;
        }
        return payload?.note ? String(payload.note) : null;
      case 'followup_canceled':
        return payload?.note ? `Nota: ${payload.note}` : null;
      case 'ai_escalated': {
        const reason = payload?.reason as string;
        if (reason === 'human_request') return 'El cliente solicitó hablar con una persona';
        if (reason === 'frustration') return 'Se detectó frustración en el cliente';
        if (reason === 'no_answer') return 'La IA no encontró respuesta adecuada';
        if (reason === 'no_balance') return 'Sin saldo disponible';
        if (reason === 'error') return 'Error en el servicio de IA';
        return null;
      }
      case 'ai_paused':
        return 'Desactivada manualmente por el agente';
      case 'visit_scheduled': {
        if (payload?.start_at) {
          const visitDate = new Date(payload.start_at as string);
          let text = `Para: ${format(visitDate, "dd MMM yyyy 'a las' HH:mm", { locale: es })}`;
          if (payload?.title) text = `${payload.title} — ${text}`;
          return text;
        }
        return payload?.title ? String(payload.title) : null;
      }
      case 'visit_canceled': {
        let text = payload?.title ? String(payload.title) : 'Cita cancelada';
        if (payload?.reason) text += ` — Motivo: ${payload.reason}`;
        return text;
      }
      case 'pipeline_stage_changed': {
        const oldLabel = payload?.old_label as string;
        const newLabel = payload?.new_label as string;
        if (oldLabel && newLabel) return `${oldLabel} → ${newLabel}`;
        return null;
      }
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

  if (timelineItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Sin actividad registrada</p>
        <p className="text-sm mt-1">Las interacciones y notas de este contacto aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {timelineItems.map((item, index) => {
        if (item.kind === 'note') {
          const note = item.data;
          return (
            <div
              key={`note-${note.id}`}
              className={cn(
                "relative pl-6 pb-4",
                index !== timelineItems.length - 1 && "border-l border-border ml-2"
              )}
            >
              <div className="absolute left-0 -translate-x-1/2 bg-background p-1 rounded-full border border-primary/30">
                <StickyNote className="h-4 w-4 text-primary" />
              </div>
              <div className="ml-4 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">Nota</span>
                  {note.is_pinned && (
                    <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30">
                      <Pin className="h-3 w-3" />
                      Fijada
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    {note.author?.name || 'Agente'}
                  </Badge>
                </div>
                <p className="text-sm text-foreground bg-primary/5 rounded-md p-2 border border-primary/10">
                  {note.content}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(note.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                  {' · '}
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
          );
        }

        const event = item.data;
        const description = getEventDescription(event);
        const actorName = event.actor_user?.name || (event.actor_type === 'ai' ? 'IA' : 'Sistema');
        
        return (
          <div
            key={event.id}
            className={cn(
              "relative pl-6 pb-4",
              index !== timelineItems.length - 1 && "border-l border-border ml-2"
            )}
          >
            <div className="absolute left-0 -translate-x-1/2 bg-background p-1 rounded-full border border-border">
              {getEventIcon(event.event_type)}
            </div>
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
                <p className="text-sm text-muted-foreground">{description}</p>
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
