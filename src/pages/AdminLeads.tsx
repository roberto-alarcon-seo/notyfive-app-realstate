import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AssigneeSelector } from "@/components/inbox/AssigneeSelector";
import {
  AlertTriangle,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
} from "lucide-react";

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
  const { profile, tenantRole, isSuperAdmin, isLoading } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned" | "risk" | "needs_human">(
    "all",
  );

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

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
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

  if (isLoading) return null;
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

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-base">Conversaciones recientes</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
              {(
                [
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin conversaciones que coincidan.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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