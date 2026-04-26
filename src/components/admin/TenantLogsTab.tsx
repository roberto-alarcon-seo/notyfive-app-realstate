import { useEffect, useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface TenantLogsTabProps {
  tenantId: string;
}

interface SecurityEventRow {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

/** Visual hint colors per event-type prefix. */
function colorFor(eventType: string): string {
  if (eventType.startsWith('external_')) return 'border-accent text-accent bg-accent/10';
  if (eventType.includes('error') || eventType.includes('failed')) return 'border-destructive text-destructive bg-destructive/10';
  if (eventType.includes('login') || eventType.includes('auth')) return 'border-primary text-primary bg-primary/10';
  return 'border-border text-muted-foreground bg-muted/30';
}

export function TenantLogsTab({ tenantId }: TenantLogsTabProps) {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('security_events')
          .select('id, event_type, metadata, ip_address, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setEvents((data ?? []) as SecurityEventRow[]);
      } catch (err) {
        console.error('Error loading tenant logs:', err);
        toast.error('No se pudo cargar los logs del tenant');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, [tenantId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Eventos de seguridad y sincronización
          </h3>
          <p className="text-xs text-muted-foreground">
            Últimos {events.length} eventos registrados para este tenant.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileSearch className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No hay eventos registrados todavía.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <ul className="divide-y divide-border">
              {events.map((evt) => {
                const meta = evt.metadata ?? {};
                const summary = (() => {
                  const reason = (meta as any).reason;
                  const action = (meta as any).action;
                  if (reason) return String(reason);
                  if (action) return String(action);
                  return null;
                })();
                return (
                  <li key={evt.id} className="px-4 py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider ${colorFor(evt.event_type)}`}
                      >
                        {evt.event_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evt.created_at).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    {summary && (
                      <p className="text-sm text-foreground truncate">{summary}</p>
                    )}
                    {evt.ip_address && (
                      <p className="text-xs text-muted-foreground">IP: {evt.ip_address}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}