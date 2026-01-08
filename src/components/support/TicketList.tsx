import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SupportTicket,
  getStatusLabel,
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
} from '@/hooks/useSupportTickets';
import { cn } from '@/lib/utils';

interface TicketListProps {
  tickets: SupportTicket[];
  isLoading: boolean;
  selectedTicketId: string | null;
  onSelectTicket: (id: string) => void;
}

export function TicketList({
  tickets,
  isLoading,
  selectedTicketId,
  onSelectTicket,
}: TicketListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8 text-center">
        <div>
          <p className="font-medium">No hay tickets</p>
          <p className="text-sm mt-1">Crea un nuevo ticket para empezar</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onSelectTicket(ticket.id)}
            className={cn(
              'w-full text-left p-4 rounded-lg transition-colors',
              selectedTicketId === ticket.id
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-secondary border border-transparent'
            )}
          >
            {/* Ticket ID */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">
                #{ticket.id.slice(0, 8)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(ticket.updated_at), {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
            </div>

            {/* Subject */}
            <h3 className="font-medium text-foreground line-clamp-2 mb-2">
              {ticket.subject}
            </h3>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-xs', getStatusColor(ticket.status))}>
                {getStatusLabel(ticket.status)}
              </Badge>
              <Badge className={cn('text-xs', getPriorityColor(ticket.priority))}>
                {getPriorityLabel(ticket.priority)}
              </Badge>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}