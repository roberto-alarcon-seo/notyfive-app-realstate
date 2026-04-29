import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { PARTNERS } from "@/config/partnerConfig";

type MasterTemplate = {
  id: string;
  partner_id: string | null;
  name: string;
  display_name: string | null;
  category: string;
  label: string | null;
  header_type: string | null;
  header_text: string | null;
  body: string;
  footer: string | null;
  buttons: any;
  variables: string[] | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

const CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"];
const HEADER_TYPES = ["none", "text", "image", "video", "document"];
const LABELS = ["Bienvenida", "Seguimiento", "Citas", "Documentación", "Post-venta"];
const PARTNER_OPTIONS = Object.values(PARTNERS);

const emptyForm: Partial<MasterTemplate> = {
  name: "",
  display_name: "",
  category: "UTILITY",
  label: null,
  header_type: "none",
  header_text: "",
  body: "",
  footer: "",
  variables: [],
  description: "",
  is_active: true,
  partner_id: null,
  sort_order: 0,
};

export default function MasterTemplates() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MasterTemplate | null>(null);
  const [form, setForm] = useState<Partial<MasterTemplate>>(emptyForm);
  const [deleting, setDeleting] = useState<MasterTemplate | null>(null);
  const [variablesText, setVariablesText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["master_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_templates")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MasterTemplate[];
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((t) => {
      if (partnerFilter === "global" && t.partner_id) return false;
      if (partnerFilter !== "all" && partnerFilter !== "global" && t.partner_id !== partnerFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (labelFilter !== "all") {
        if (labelFilter === "__none__" ? !!t.label : t.label !== labelFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !(t.display_name ?? "").toLowerCase().includes(q) &&
          !t.body.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [data, partnerFilter, categoryFilter, labelFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setVariablesText("");
    setEditorOpen(true);
  };

  const openEdit = (t: MasterTemplate) => {
    setEditing(t);
    setForm({ ...t });
    setVariablesText((t.variables ?? []).join(", "));
    setEditorOpen(true);
  };

  const openDuplicate = (t: MasterTemplate) => {
    setEditing(null);
    const copy = { ...t, name: `${t.name}_copy`, display_name: `${t.display_name ?? t.name} (copia)` };
    delete (copy as any).id;
    delete (copy as any).created_at;
    delete (copy as any).updated_at;
    setForm(copy);
    setVariablesText((t.variables ?? []).join(", "));
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<MasterTemplate>) => {
      const variables = variablesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const body = {
        name: payload.name!,
        display_name: payload.display_name || null,
        category: payload.category || "UTILITY",
        label: payload.label || null,
        header_type: payload.header_type || "none",
        header_text: payload.header_text || null,
        body: payload.body!,
        footer: payload.footer || null,
        variables,
        description: payload.description || null,
        is_active: payload.is_active ?? true,
        partner_id: payload.partner_id || null,
        sort_order: payload.sort_order ?? 0,
      };
      if (editing) {
        const { error } = await supabase.from("master_templates").update(body).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_templates").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master_templates"] });
      toast.success(editing ? "Plantilla actualizada" : "Plantilla creada");
      setEditorOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("master_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master_templates"] });
      toast.success("Plantilla eliminada");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Error al eliminar"),
  });

  const partnerLabel = (id: string | null) => {
    if (!id) return "Global";
    return PARTNERS[id]?.name ?? id;
  };

  return (
    <AdminLayout
      title="Plantillas Globales"
      description="Catálogo maestro de plantillas. Se usan como semilla automática para nuevos tenants."
      actions={
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nueva plantilla
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o contenido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Partner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los partners</SelectItem>
              <SelectItem value="global">Sólo globales</SelectItem>
              {PARTNER_OPTIONS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={labelFilter} onValueChange={setLabelFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por Grupo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              <SelectItem value="__none__">Sin grupo</SelectItem>
              {LABELS.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
              ) : filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.display_name || t.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{t.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.partner_id ? "secondary" : "outline"}>{partnerLabel(t.partner_id)}</Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                  <TableCell>
                    {t.label ? (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-transparent">{t.label}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(t.variables ?? []).length}</TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openDuplicate(t)} title="Duplicar">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(t)} title="Eliminar">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
            <DialogDescription>
              Las plantillas globales se usan como semilla para los nuevos tenants al conectar Twilio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name (slug)</Label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="re_welcome_lead"
                />
              </div>
              <div>
                <Label>Display name</Label>
                <Input
                  value={form.display_name ?? ""}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="Bienvenida Lead"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Partner</Label>
                <Select
                  value={form.partner_id ?? "__global__"}
                  onValueChange={(v) => setForm({ ...form, partner_id: v === "__global__" ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global (todos)</SelectItem>
                    {PARTNER_OPTIONS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={form.category ?? "UTILITY"} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Header type</Label>
                <Select value={form.header_type ?? "none"} onValueChange={(v) => setForm({ ...form, header_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HEADER_TYPES.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Grupo funcional (label)</Label>
              <Select
                value={form.label ?? "__none__"}
                onValueChange={(v) => setForm({ ...form, label: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sin grupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin grupo</SelectItem>
                  {LABELS.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Agrupa la plantilla por intención: Bienvenida, Seguimiento, Citas, Documentación o Post-venta.
              </p>
            </div>
            {form.header_type === "text" && (
              <div>
                <Label>Header text</Label>
                <Input
                  value={form.header_text ?? ""}
                  onChange={(e) => setForm({ ...form, header_text: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Body *</Label>
              <Textarea
                rows={5}
                value={form.body ?? ""}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Hola {{nombre_cliente}}, soy {{nombre_agente}}..."
              />
            </div>
            <div>
              <Label>Footer</Label>
              <Input
                value={form.footer ?? ""}
                onChange={(e) => setForm({ ...form, footer: e.target.value })}
              />
            </div>
            <div>
              <Label>Variables (separadas por coma)</Label>
              <Input
                value={variablesText}
                onChange={(e) => setVariablesText(e.target.value)}
                placeholder="nombre_cliente, nombre_agente, propiedad_nombre"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label>Activa</Label>
                <p className="text-xs text-muted-foreground">Las plantillas inactivas no se siembran a nuevos tenants.</p>
              </div>
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => upsertMutation.mutate(form)}
              disabled={!form.name || !form.body || upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla maestra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. No afectará a las copias ya sembradas en los tenants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}