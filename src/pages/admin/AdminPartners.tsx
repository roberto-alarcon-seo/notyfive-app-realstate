import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Settings2, Building2, CheckCircle2, XCircle, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { CreatePartnerDialog } from "@/components/admin/CreatePartnerDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface PartnerListRow {
  id: string;
  name: string;
  primary_domain: string;
  country_code: string;
  primary_color_hex: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  tenants_count: number;
}

const PAGE_SIZE = 10;

export default function AdminPartners() {
  const navigate = useNavigate();
  const { partnerScope } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["admin-partners-list"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("partners")
        .select("id,name,primary_domain,country_code,primary_color_hex,logo_url,is_active,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (rows ?? []).map((r) => r.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: tenantRows } = await supabase
          .from("tenants")
          .select("partner_id")
          .in("partner_id", ids);
        (tenantRows ?? []).forEach((t: { partner_id: string | null }) => {
          if (!t.partner_id) return;
          counts.set(t.partner_id, (counts.get(t.partner_id) ?? 0) + 1);
        });
      }
      return (rows ?? []).map((r) => ({
        ...r,
        tenants_count: counts.get(r.id) ?? 0,
      })) as PartnerListRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.primary_domain.toLowerCase().includes(q),
    );
  }, [partners, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Solo super admin global
  if (partnerScope) return <Navigate to="/admin/tenants" replace />;

  const headerActions = (
    <Button
      onClick={() => setCreateOpen(true)}
      className="bg-primary hover:bg-primary/90 text-primary-foreground"
    >
      <Plus className="h-4 w-4 mr-2" />
      Nuevo Partner
    </Button>
  );

  return (
    <AdminLayout
      title="Partners"
      description="Gestiona los partners white-label de la plataforma"
      actions={headerActions}
    >
      <CreatePartnerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(pid) => navigate(`/admin/partners/${pid}`)}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{partners.length}</p>
            <p className="text-xs text-muted-foreground">Partners totales</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">
              {partners.filter((p) => p.is_active).length}
            </p>
            <p className="text-xs text-muted-foreground">Activos</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">
              {partners.reduce((acc, p) => acc + p.tenants_count, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Tenants asignados</p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, ID o dominio..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Partner</th>
                <th className="px-4 py-3 font-medium">Dominio</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">Tenants</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando partners...
                  </td>
                </tr>
              )}
              {!isLoading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No se encontraron partners.
                  </td>
                </tr>
              )}
              {pageRows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.logo_url ? (
                        <img
                          src={p.logo_url}
                          alt={p.name}
                          className="w-8 h-8 rounded-lg object-cover bg-muted"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white"
                          style={{ backgroundColor: p.primary_color_hex }}
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.primary_domain}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {p.country_code}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{p.tenants_count}</td>
                  <td className="px-4 py-3">
                    {p.is_active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-0">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Suspendido
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/partners/${p.id}`)}
                    >
                      <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                      Gestionar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <p className="text-muted-foreground text-xs">
              Página {safePage} de {totalPages} · {filtered.length} partners
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}