import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const SOURCE_LABELS: Record<string, string> = {
  META_PIXEL: "Pixel",
  META_CAPI: "CAPI",
  INTERNAL: "Interno",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  SENT: { label: "Enviado", icon: CheckCircle2, className: "text-green-600 bg-green-50 border-green-200" },
  FAILED: { label: "Fallido", icon: XCircle, className: "text-red-600 bg-red-50 border-red-200" },
  PENDING: { label: "Pendiente", icon: Clock, className: "text-yellow-600 bg-yellow-50 border-yellow-200" },
};

export function ConversionEventLogsPanel() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['conversion-event-logs', tenantId, sourceFilter, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from('conversion_event_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle>Historial de Eventos Enviados</CardTitle>
            <CardDescription>
              Últimos eventos de conversión enviados a Meta y registrados internamente.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="META_PIXEL">Pixel</SelectItem>
              <SelectItem value="META_CAPI">CAPI</SelectItem>
              <SelectItem value="INTERNAL">Interno</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="SENT">Enviado</SelectItem>
              <SelectItem value="FAILED">Fallido</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs list */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Cargando eventos...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
            No hay eventos registrados aún.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => {
                const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = statusCfg.icon;
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${statusCfg.className.split(' ')[0]}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{log.event_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[log.source] || log.source}
                          </Badge>
                          {log.event_id && (
                            <Badge variant="secondary" className="text-xs font-mono">
                              {log.event_id.substring(0, 20)}…
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss", { locale: es })}
                          {log.pipeline_stage && ` · Etapa: ${log.pipeline_stage}`}
                        </div>
                        {log.error_message && (
                          <div className="text-xs text-destructive mt-0.5 truncate max-w-[300px]">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setSelectedLog(log as unknown as Record<string, unknown>)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Detail dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalle del evento</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Evento:</span> <span className="font-medium">{selectedLog.event_name as string}</span></div>
                  <div><span className="text-muted-foreground">Fuente:</span> {SOURCE_LABELS[selectedLog.source as string] || selectedLog.source as string}</div>
                  <div><span className="text-muted-foreground">Estado:</span> {selectedLog.status as string}</div>
                  <div><span className="text-muted-foreground">Etapa:</span> {selectedLog.pipeline_stage as string || '—'}</div>
                  {selectedLog.event_id && (
                    <div className="col-span-2"><span className="text-muted-foreground">Event ID:</span> <code className="text-xs bg-muted px-1 rounded">{selectedLog.event_id as string}</code></div>
                  )}
                </div>
                {selectedLog.error_message && (
                  <div className="p-2 bg-destructive/10 rounded text-destructive text-xs">
                    {selectedLog.error_message as string}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-xs">Payload:</span>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
