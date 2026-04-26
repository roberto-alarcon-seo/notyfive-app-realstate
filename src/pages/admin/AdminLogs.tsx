import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, FileText, Database, ShieldAlert, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface EdgeLog {
  id: string;
  timestamp: string;
  event_message: string;
  status_code?: number;
  method?: string;
  function_id?: string;
  execution_time_ms?: number;
}

interface DbLog {
  id: string;
  timestamp: string;
  event_message: string;
  identifier?: string;
  error_severity?: string;
}

interface SecurityEvent {
  id: string;
  created_at: string;
  event_type: string;
  user_id: string | null;
  tenant_id: string | null;
  ip_address: string | null;
  metadata: any;
}

const AdminLogs = () => {
  const [tab, setTab] = useState<'edge' | 'security' | 'database'>('edge');

  const [edgeLogs, setEdgeLogs] = useState<EdgeLog[]>([]);
  const [dbLogs, setDbLogs] = useState<DbLog[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);

  const [loadingEdge, setLoadingEdge] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const [loadingSec, setLoadingSec] = useState(false);

  const [search, setSearch] = useState('');

  const fetchEdgeLogs = async () => {
    setLoadingEdge(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-fetch-logs', {
        body: { type: 'edge', limit: 100 },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Error');
      setEdgeLogs(data.logs || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Error al cargar logs de Edge Functions: ' + e.message);
    } finally {
      setLoadingEdge(false);
    }
  };

  const fetchDbLogs = async () => {
    setLoadingDb(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-fetch-logs', {
        body: { type: 'database', limit: 100 },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Error');
      setDbLogs(data.logs || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Error al cargar logs de base de datos: ' + e.message);
    } finally {
      setLoadingDb(false);
    }
  };

  const fetchSecurityLogs = async () => {
    setLoadingSec(true);
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('id, created_at, event_type, user_id, tenant_id, ip_address, metadata')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setSecurityLogs(data || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Error al cargar logs de seguridad');
    } finally {
      setLoadingSec(false);
    }
  };

  useEffect(() => {
    if (tab === 'edge' && edgeLogs.length === 0) fetchEdgeLogs();
    if (tab === 'database' && dbLogs.length === 0) fetchDbLogs();
    if (tab === 'security' && securityLogs.length === 0) fetchSecurityLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const refreshCurrent = () => {
    if (tab === 'edge') fetchEdgeLogs();
    if (tab === 'database') fetchDbLogs();
    if (tab === 'security') fetchSecurityLogs();
  };

  const getStatusColor = (code?: number) => {
    if (!code) return 'text-muted-foreground';
    if (code >= 500) return 'text-destructive';
    if (code >= 400) return 'text-warning';
    if (code >= 200 && code < 300) return 'text-success';
    return 'text-muted-foreground';
  };

  const getSeverityVariant = (sev?: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (!sev) return 'outline';
    const s = sev.toUpperCase();
    if (['ERROR', 'FATAL', 'PANIC'].includes(s)) return 'destructive';
    if (['WARNING'].includes(s)) return 'secondary';
    return 'outline';
  };

  const filterText = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const filteredEdge = edgeLogs.filter(
    (l) => filterText(l.event_message) || filterText(l.function_id || '')
  );
  const filteredDb = dbLogs.filter(
    (l) => filterText(l.event_message) || filterText(l.identifier || '')
  );
  const filteredSec = securityLogs.filter(
    (l) => filterText(l.event_type) || filterText(JSON.stringify(l.metadata || {}))
  );

  const headerActions = (
    <Button variant="outline" size="sm" onClick={refreshCurrent}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Refrescar
    </Button>
  );

  return (
    <AdminLayout
      title="Logs"
      description="Monitorea APIs, base de datos y eventos de seguridad"
      actions={headerActions}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="edge">
            <FileText className="h-4 w-4 mr-2" />
            APIs / Edge Functions
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Seguridad / Auditoría
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="h-4 w-4 mr-2" />
            Base de datos
          </TabsTrigger>
        </TabsList>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>

        <TabsContent value="edge" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingEdge ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredEdge.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No hay logs disponibles</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Método</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tiempo (ms)</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEdge.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td className="p-3 font-mono text-xs">{log.method || '—'}</td>
                      <td className={`p-3 font-mono text-xs font-medium ${getStatusColor(log.status_code)}`}>
                        {log.status_code || '—'}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{log.execution_time_ms || '—'}</td>
                      <td className="p-3 text-xs font-mono break-all max-w-xl">{log.event_message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingSec ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredSec.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No hay eventos de seguridad</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Evento</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">IP</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSec.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-secondary/30 align-top">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('es-MX')}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            log.event_type.startsWith('blocked_') ? 'destructive' : 'secondary'
                          }
                          className="font-mono text-xs"
                        >
                          {log.event_type}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">
                        {log.ip_address || '—'}
                      </td>
                      <td className="p-3 text-xs font-mono text-muted-foreground max-w-xl break-all">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="database" className="mt-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingDb ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredDb.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No hay logs disponibles</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Severidad</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Identificador</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDb.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-secondary/30 align-top">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td className="p-3">
                        <Badge variant={getSeverityVariant(log.error_severity)} className="text-xs">
                          {log.error_severity || 'INFO'}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">
                        {log.identifier || '—'}
                      </td>
                      <td className="p-3 text-xs font-mono break-all max-w-xl">{log.event_message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminLogs;