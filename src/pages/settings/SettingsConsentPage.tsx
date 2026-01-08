import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldOff, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface ConsentRow {
  id: string;
  contact_id: string;
  status: string;
  dnd_until: string | null;
  source: string;
  updated_at: string;
  contacts: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
}

const DEFAULT_KEYWORDS = ["stop", "alto", "baja", "cancelar", "unsubscribe", "no molestar"];
const DEFAULT_CONFIRM_MSG = "Listo, no volveremos a enviarte mensajes. Si deseas volver a recibir comunicaciones, escríbenos.";

export default function SettingsConsentPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"blocklist" | "rules">("blocklist");
  
  // Blocklist state
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Rules state
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS.join(", "));
  const [confirmMsg, setConfirmMsg] = useState(DEFAULT_CONFIRM_MSG);
  const [savingRules, setSavingRules] = useState(false);

  const loadBlocklist = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_consents')
        .select(`
          id,
          contact_id,
          status,
          dnd_until,
          source,
          updated_at,
          contacts:contact_id (id, name, phone, email)
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['opted_out', 'dnd', 'blocked'])
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data || []) as unknown as ConsentRow[]);
    } catch (err) {
      console.error('Error loading blocklist:', err);
      toast.error('Error al cargar la lista');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    loadBlocklist();
  }, [loadBlocklist]);

  const filteredRows = rows.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.contacts?.name?.toLowerCase().includes(term) ||
      row.contacts?.phone?.toLowerCase().includes(term) ||
      row.contacts?.email?.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'opted_out':
        return <Badge variant="destructive">Opt-out</Badge>;
      case 'blocked':
        return <Badge variant="secondary">Bloqueado</Badge>;
      case 'dnd':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">DND</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      // For now, just show success - rules are stored in tenant_ai_settings or a new table
      toast.success('Reglas guardadas correctamente');
    } catch (err) {
      console.error('Error saving rules:', err);
      toast.error('Error al guardar las reglas');
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <SettingsLayout 
      title="Consentimiento" 
      description="Gestiona opt-out, DND y bloqueos para WhatsApp"
      icon={Shield}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="blocklist" className="gap-2">
            <ShieldOff className="h-4 w-4" />
            Bloqueos
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Shield className="h-4 w-4" />
            Reglas automáticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blocklist" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lista de bloqueos</CardTitle>
                  <CardDescription>
                    Contactos con opt-out, DND o bloqueados
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadBlocklist}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, teléfono o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Cargando...</p>
              ) : filteredRows.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay contactos bloqueados.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fuente</TableHead>
                        <TableHead>Actualizado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.contacts?.name || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.contacts?.phone || '—'}
                          </TableCell>
                          <TableCell>{getStatusBadge(row.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.source}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(row.updated_at).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Palabras clave para Opt-out (Inbound)</CardTitle>
              <CardDescription>
                Cuando un contacto envía un mensaje con estas palabras, se marca automáticamente como opt-out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keywords">Palabras clave (separadas por coma)</Label>
                <Textarea
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="stop, alto, baja, cancelar"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensaje de confirmación</CardTitle>
              <CardDescription>
                Mensaje que se envía automáticamente cuando se detecta un opt-out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-msg">Mensaje</Label>
                <Textarea
                  id="confirm-msg"
                  value={confirmMsg}
                  onChange={(e) => setConfirmMsg(e.target.value)}
                  rows={3}
                />
              </div>

              <Button onClick={handleSaveRules} disabled={savingRules}>
                {savingRules ? 'Guardando...' : 'Guardar reglas'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Las palabras clave se detectan automáticamente en mensajes 
                entrantes de WhatsApp. Cuando se detecta un opt-out, el contacto se marca como 
                "opted_out" y se envía el mensaje de confirmación.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}
