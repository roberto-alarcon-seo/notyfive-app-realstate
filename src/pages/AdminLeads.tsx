import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AssigneeSelector } from "@/components/inbox/AssigneeSelector";
import {
  AlertTriangle,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  History,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface ConvRow {
  id: string;
  contact_id: string;
  status: string;
  needs_human: boolean | null;
  risk_flagged_at: string | null;
  last_assigned_at: string | null;
  last_customer_message_at: string | null;
  updated_at: string;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    pipeline_stage: string;
    assigned_agent_id: string | null;
    agent?: { id: string; name: string | null; email: string | null } | null;
  } | null;
}

export default function AdminLeads() {
  const { profile, tenantRole, isSuperAdmin, isLoading: authLoading } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"attention" | "all" | "unassigned" | "risk" | "needs_human">(
    "attention",
  );
  const [historyContactId, setHistoryContactId] = useState<string | null>(null);
  const [historyContactName, setHistoryContactName] = useState<string>("");

  const isAllowed =
    isSuperAdmin || ["administrador", "manager"].includes(tenantRole || "");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-leads", tenantId],
    enabled: !!tenantId && isAllowed,
    queryFn: async (): Promise<ConvRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          `id, contact_id, status, needs_human, risk_flagged_at, last_assigned_at,
           last_customer_message_at, updated_at,
           contact:contacts!inner(id, name, email, pipeline_stage, assigned_agent_id)`,
        )
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data ?? []) as any as ConvRow[];

      const agentIds = Array.from(
        new Set(
          list
            .map((r) => r.contact?.assigned_agent_id)
            .filter((x): x is string => !!x),
        ),
      );
      if (agentIds.length) {
        const { data: agents } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", agentIds);
        const map = new Map(
          (agents ?? []).map((a: any) => [a.id, a]),
        );
        for (const r of list) {
          if (r.contact?.assigned_agent_id) {
            r.contact.agent = map.get(r.contact.assigned_agent_id) ?? null;
          }
        }
      }
      return list;
    },
  });

  // Realtime: refresh supervisión when new messages arrive or conversations change
  useEffect(() => {
    if (!tenantId || !isAllowed) return;
    const channel = supabase
      .channel(`admin-leads-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ["admin-leads", tenantId] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ["admin-leads", tenantId] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assignment_logs", filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-leads", tenantId] });
          queryClient.invalidateQueries({ queryKey: ["assignment-logs-recent", tenantId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, isAllowed, queryClient]);

  // Assignment logs (últimos 30 días) — tenant-wide reassignment history
  const { data: recentLogs = [] } = useQuery({
    queryKey: ["assignment-logs-recent", tenantId],
    enabled: !!tenantId && isAllowed,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("assignment_logs")
        .select(
          `id, created_at, reason, strategy, previous_agent_id, new_agent_id,
           assigned_by, contact_id,
           contact:contacts(id, name),
           previous_agent:profiles!assignment_logs_previous_agent_id_fkey(id, name, email),
           new_agent:profiles!assignment_logs_new_agent_id_fkey(id, name, email),
           assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(id, name, email)`,
        )
        .eq("tenant_id", tenantId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "attention") {
        const needsAttention =
          !r.contact?.assigned_agent_id || !!r.risk_flagged_at || !!r.needs_human;
        if (!needsAttention) return false;
      }
      if (filter === "unassigned" && r.contact?.assigned_agent_id) return false;
      if (filter === "risk" && !r.risk_flagged_at) return false;
      if (filter === "needs_human" && !r.needs_human) return false;
      if (!s) return true;
      const hay = `${r.contact?.name ?? ""} ${r.contact?.email ?? ""} ${
        r.contact?.agent?.name ?? ""
      }`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const unassigned = rows.filter((r) => !r.contact?.assigned_agent_id).length;
    const risk = rows.filter((r) => r.risk_flagged_at).length;
    const needsHuman = rows.filter((r) => r.needs_human).length;
    return { total, unassigned, risk, needsHuman };
  }, [rows]);

  const agentDistribution = useMemo(() => {
    const map = new Map<string, { name: string; total: number; risk: number }>();
    for (const r of rows) {
      const id = r.contact?.assigned_agent_id;
      if (!id) continue;
      const name = r.contact?.agent?.name || r.contact?.agent?.email || "—";
      const entry = map.get(id) ?? { name, total: 0, risk: 0 };
      entry.total += 1;
      if (r.risk_flagged_at) entry.risk += 1;
      map.set(id, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [rows]);

  if (authLoading) return null;
  if (!isAllowed) return <Navigate to="/" replace />;

  return (
    <div className="container max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Supervisión de leads
        </h1>
        <p className="text-sm text-muted-foreground">
          Vista del manager: distribución, riesgo y reasignación.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Conversaciones"
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Sin asignar"
          value={stats.unassigned}
          icon={<UserX className="h-4 w-4" />}
          tone={stats.unassigned > 0 ? "warning" : undefined}
          onClick={() => setFilter("unassigned")}
        />
        <StatCard
          label="Requieren humano"
          value={stats.needsHuman}
          icon={<UserCheck className="h-4 w-4" />}
          tone={stats.needsHuman > 0 ? "warning" : undefined}
          onClick={() => setFilter("needs_human")}
        />
        <StatCard
          label="En riesgo"
          value={stats.risk}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats.risk > 0 ? "danger" : undefined}
          onClick={() => setFilter("risk")}
        />
      </div>

      {recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Reasignaciones recientes (últimos 30 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead />
                  <TableHead>A</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.slice(0, 15).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.contact?.name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.previous_agent?.name || log.previous_agent?.email || (
                        <span className="text-muted-foreground italic">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.new_agent?.name || log.new_agent?.email || (
                        <span className="text-muted-foreground italic">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {labelForReason(log.reason, log.strategy)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.assigned_by_profile?.name ||
                        log.assigned_by_profile?.email ||
                        "Sistema"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {agentDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Distribución de leads por asesor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={agentDistribution}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148,44,204,0.08)" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <Bar dataKey="total" name="Leads" radius={[4, 4, 0, 0]}>
                    {agentDistribution.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.risk > 0 ? "#ef4444" : "#942CCC"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Conversaciones recientes</CardTitle>
            {filter === "attention" && (
              <p className="text-xs text-muted-foreground mt-1">
                Mostrando solo leads que requieren acción: sin asignar, en riesgo o con humano pendiente.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
              {(
                [
                  ["attention", "Atención"],
                  ["all", "Todas"],
                  ["unassigned", "Sin asignar"],
                  ["needs_human", "Humano"],
                  ["risk", "Riesgo"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded ${
                    filter === k
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Input
              placeholder="Buscar…"
              className="h-8 w-[200px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Contacto</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último mensaje</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sin conversaciones que coincidan.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <SlaDot
                      lastCustomerAt={r.last_customer_message_at}
                      atRisk={!!r.risk_flagged_at}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {r.contact?.name || (
                        <span className="text-muted-foreground">Sin nombre</span>
                      )}
                    </div>
                    {r.contact?.email && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {r.contact.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {r.contact?.pipeline_stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <AssigneeSelector
                      conversationId={r.id}
                      contactId={r.contact_id}
                      currentAgentId={r.contact?.assigned_agent_id ?? null}
                      compact
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.needs_human && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40">
                          Humano
                        </Badge>
                      )}
                      {r.risk_flagged_at && (
                        <Badge variant="destructive">En riesgo</Badge>
                      )}
                      {!r.contact?.assigned_agent_id && (
                        <Badge variant="outline">Sin asignar</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.last_customer_message_at
                      ? formatDistanceToNow(
                          new Date(r.last_customer_message_at),
                          { addSuffix: true, locale: es },
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/inbox?conversation=${r.id}`)}
                    >
                      Abrir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setHistoryContactId(r.contact_id);
                        setHistoryContactName(r.contact?.name || "Lead");
                      }}
                      title="Ver historial de reasignaciones"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContactAssignmentHistoryDialog
        contactId={historyContactId}
        contactName={historyContactName}
        onOpenChange={(open) => !open && setHistoryContactId(null)}
      />
    </div>
  );
}

function labelForReason(reason: string | null, strategy: string): string {
  const r = (reason || "").toLowerCase();
  if (r.includes("manual")) return "Manual";
  if (r.includes("claim")) return "Reclamado";
  if (r.includes("timeout")) return "Por timeout";
  if (r.includes("round_robin") || strategy === "round_robin") return "Round-robin";
  if (r.includes("property")) return "Por propiedad";
  if (r.includes("sticky")) return "Sticky";
  return reason || strategy;
}

function ContactAssignmentHistoryDialog({
  contactId,
  contactName,
  onOpenChange,
}: {
  contactId: string | null;
  contactName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["assignment-logs-contact", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_logs")
        .select(
          `id, created_at, reason, strategy,
           previous_agent:profiles!assignment_logs_previous_agent_id_fkey(name, email),
           new_agent:profiles!assignment_logs_new_agent_id_fkey(name, email),
           assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(name, email)`,
        )
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <Dialog open={!!contactId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de reasignaciones — {contactName}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Cargando…
            </p>
          )}
          {!isLoading && logs.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Este lead no tiene reasignaciones registradas.
            </p>
          )}
          {!isLoading && logs.length > 0 && (
            <ol className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="border-l-2 border-primary/30 pl-3 py-1"
                >
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "PPpp", { locale: es })}
                  </div>
                  <div className="text-sm flex items-center gap-2 flex-wrap mt-0.5">
                    <span>
                      {log.previous_agent?.name ||
                        log.previous_agent?.email || (
                          <span className="italic text-muted-foreground">
                            Sin asignar
                          </span>
                        )}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {log.new_agent?.name || log.new_agent?.email || (
                        <span className="italic text-muted-foreground">
                          Sin asignar
                        </span>
                      )}
                    </span>
                    <Badge variant="outline" className="text-xs ml-1">
                      {labelForReason(log.reason, log.strategy)}
                    </Badge>
                  </div>
                  {log.assigned_by_profile && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Por:{" "}
                      {log.assigned_by_profile.name ||
                        log.assigned_by_profile.email}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "warning" | "danger";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/40"
      : tone === "warning"
        ? "border-amber-500/40"
        : "";
  return (
    <Card
      className={`${toneClass} ${onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function SlaDot({
  lastCustomerAt,
  atRisk,
}: {
  lastCustomerAt: string | null;
  atRisk: boolean;
}) {
  let tone: "green" | "amber" | "red" | "gray" = "gray";
  let label = "Sin actividad reciente";
  if (atRisk) {
    tone = "red";
    label = "En riesgo: timeout vencido";
  } else if (lastCustomerAt) {
    const mins = (Date.now() - new Date(lastCustomerAt).getTime()) / 60000;
    if (mins < 30) {
      tone = "green";
      label = "Respondido recientemente (<30 min)";
    } else if (mins < 60) {
      tone = "amber";
      label = "Por atender (30-60 min)";
    } else {
      tone = "red";
      label = `Sin respuesta hace ${Math.round(mins)} min`;
    }
  }
  const color =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "red"
          ? "bg-red-500"
          : "bg-muted-foreground/40";
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-block w-2.5 h-2.5 rounded-full ${color}`}
    />
  );
}