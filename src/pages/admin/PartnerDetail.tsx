import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Users,
  Wallet,
  TrendingDown,
  KeyRound,
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  X,
  ExternalLink,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePartner,
  usePartnerMetrics,
  usePartnerTenants,
  useUpdatePartner,
  useRegeneratePartnerKey,
  useDeletePartner,
} from "@/hooks/usePartner";
import { usePartnerWallet } from "@/hooks/usePartnerWallet";

const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

function maskKey(k: string | null | undefined) {
  if (!k) return "—";
  if (k.length < 14) return k;
  return `${k.slice(0, 10)}••••••••${k.slice(-4)}`;
}

function fmtNumber(n: number | undefined | null) {
  return new Intl.NumberFormat("es-MX").format(Number(n ?? 0));
}

export default function PartnerDetail() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();

  const { data: partner, isLoading } = usePartner(partnerId);
  const { data: metrics } = usePartnerMetrics(partnerId);
  const { data: tenants } = usePartnerTenants(partnerId);
  const { data: wallet } = usePartnerWallet(partnerId);

  const updateM = useUpdatePartner();
  const regenM = useRegeneratePartnerKey();
  const deleteM = useDeletePartner();

  // Local form state (Identity tab)
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [altDomains, setAltDomains] = useState<string[]>([]);
  const [newAlt, setNewAlt] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [nonSsoUrl, setNonSsoUrl] = useState("");
  const [logoutUrl, setLogoutUrl] = useState("");
  const [externalSync, setExternalSync] = useState(false);
  const [lowThreshold, setLowThreshold] = useState<number>(1000);

  // Dialogs
  const [confirmActiveOpen, setConfirmActiveOpen] = useState(false);
  const [pendingActive, setPendingActive] = useState<boolean>(true);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (!partner) return;
    setName(partner.name);
    setCountry(partner.country_code);
    setPrimaryDomain(partner.primary_domain);
    setAltDomains(partner.alt_domains ?? []);
    setDashboardUrl(partner.dashboard_url ?? "");
    setNonSsoUrl(partner.non_sso_redirect_url ?? "");
    setLogoutUrl(partner.logout_redirect_url ?? "");
    setExternalSync(!!partner.external_sync_enabled);
  }, [partner]);

  useEffect(() => {
    if (wallet) setLowThreshold(wallet.low_balance_threshold ?? 1000);
  }, [wallet]);

  const blockingTenants = (metrics?.tenants_total ?? 0) > 0;

  if (isLoading) {
    return (
      <AdminLayout title="Partner" description="Cargando...">
        <div className="space-y-4 p-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!partner) {
    return (
      <AdminLayout title="Partner no encontrado" description="">
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate("/admin/tenants")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const handleSaveIdentity = async () => {
    if (!primaryDomain || !DOMAIN_REGEX.test(primaryDomain)) {
      toast.error("Dominio principal inválido");
      return;
    }
    for (const d of altDomains) {
      if (!DOMAIN_REGEX.test(d)) {
        toast.error(`Dominio alterno inválido: ${d}`);
        return;
      }
    }
    try {
      await updateM.mutateAsync({
        partnerId: partner.id,
        patch: {
          name: name.trim(),
          country_code: country.trim().toUpperCase(),
          primary_domain: primaryDomain.trim().toLowerCase(),
          alt_domains: altDomains,
          dashboard_url: dashboardUrl.trim(),
          non_sso_redirect_url: nonSsoUrl.trim(),
          logout_redirect_url: logoutUrl.trim(),
        },
      });
      toast.success("Identidad actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al actualizar");
    }
  };

  const handleAddAlt = () => {
    const v = newAlt.trim().toLowerCase();
    if (!v) return;
    if (!DOMAIN_REGEX.test(v)) {
      toast.error("Dominio inválido");
      return;
    }
    if (altDomains.includes(v) || v === primaryDomain) {
      toast.error("Dominio duplicado");
      return;
    }
    setAltDomains([...altDomains, v]);
    setNewAlt("");
  };

  const handleConfirmActive = async () => {
    try {
      await updateM.mutateAsync({
        partnerId: partner.id,
        patch: { is_active: pendingActive },
      });
      toast.success(pendingActive ? "Partner activado" : "Partner suspendido");
      setConfirmActiveOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const handleSaveIntegration = async () => {
    try {
      await updateM.mutateAsync({
        partnerId: partner.id,
        patch: { external_sync_enabled: externalSync, low_balance_threshold: lowThreshold },
      });
      toast.success("Integración actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const handleRegenerate = async () => {
    if (regenConfirm !== "REGENERAR") {
      toast.error("Debes escribir REGENERAR para confirmar");
      return;
    }
    try {
      const newKey = await regenM.mutateAsync(partner.id);
      setRevealedKey(newKey);
      setRegenOpen(false);
      setRegenConfirm("");
      toast.success("API key regenerada. Cópiala ahora — no se mostrará de nuevo.");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== partner.id) {
      toast.error(`Debes escribir exactamente: ${partner.id}`);
      return;
    }
    try {
      await deleteM.mutateAsync({ partnerId: partner.id, confirmId: deleteConfirm });
      toast.success("Partner eliminado");
      navigate("/admin/tenants");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("PARTNER_HAS_TENANTS")) {
        toast.error("No se puede eliminar: el partner aún tiene tenants asignados.");
      } else {
        toast.error(msg || "Error al eliminar");
      }
    }
  };

  const headerTitle = partner.name;
  const headerDesc = `${partner.id} · ${partner.primary_domain}`;

  return (
    <AdminLayout title={headerTitle} description={headerDesc}>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tenants")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {partner.logo_url ? (
              <img
                src={partner.logo_url}
                alt={partner.name}
                className="h-12 w-12 object-contain rounded-md border bg-background p-1"
              />
            ) : (
              <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{partner.name}</h1>
                <Badge variant={partner.is_active ? "default" : "destructive"}>
                  {partner.is_active ? "Activo" : "Suspendido"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{headerDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={partner.is_active}
              onCheckedChange={(v) => {
                setPendingActive(v);
                setConfirmActiveOpen(true);
              }}
            />
            <span className="text-sm text-muted-foreground">
              {partner.is_active ? "Activo" : "Suspendido"}
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Building2} label="Tenants" value={fmtNumber(metrics?.tenants_total)} />
          <KpiCard icon={Users} label="Usuarios" value={fmtNumber(metrics?.users_total)} />
          <KpiCard
            icon={Wallet}
            label="Saldo Wallet"
            value={fmtNumber(metrics?.wallet_balance)}
            suffix="cr"
          />
          <KpiCard
            icon={TrendingDown}
            label="Consumido 30d"
            value={fmtNumber(metrics?.credits_consumed_30d)}
            suffix="cr"
          />
        </div>

        <Tabs defaultValue="identity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="identity">Identidad y Dominios</TabsTrigger>
            <TabsTrigger value="integration">Integración</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="danger">Zona Peligrosa</TabsTrigger>
          </TabsList>

          {/* Identity */}
          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle>Identidad y Dominios</CardTitle>
                <CardDescription>
                  Información pública del partner y dominios autorizados para resolver el branding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>País (ISO 2)</Label>
                    <Input
                      value={country}
                      maxLength={2}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dominio principal</Label>
                    <Input
                      value={primaryDomain}
                      onChange={(e) => setPrimaryDomain(e.target.value)}
                      placeholder="app.midominio.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dashboard URL (opcional)</Label>
                    <Input
                      value={dashboardUrl}
                      onChange={(e) => setDashboardUrl(e.target.value)}
                      placeholder="https://midominio.com/dashboard"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Redirect Non-SSO</Label>
                    <Input
                      value={nonSsoUrl}
                      onChange={(e) => setNonSsoUrl(e.target.value)}
                      placeholder="https://midominio.com/login"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Redirect Logout</Label>
                    <Input
                      value={logoutUrl}
                      onChange={(e) => setLogoutUrl(e.target.value)}
                      placeholder="https://midominio.com/bye"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dominios alternos</Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/30">
                    {altDomains.length === 0 && (
                      <span className="text-xs text-muted-foreground self-center">
                        Sin dominios alternos
                      </span>
                    )}
                    {altDomains.map((d) => (
                      <Badge key={d} variant="secondary" className="gap-1">
                        {d}
                        <button
                          type="button"
                          onClick={() => setAltDomains(altDomains.filter((x) => x !== d))}
                          className="ml-1 hover:text-destructive"
                          aria-label={`Eliminar ${d}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newAlt}
                      onChange={(e) => setNewAlt(e.target.value)}
                      placeholder="alt.midominio.com"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAlt();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddAlt}>
                      <Plus className="h-4 w-4 mr-1" /> Añadir
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveIdentity} disabled={updateM.isPending}>
                    {updateM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Guardar cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integration */}
          <TabsContent value="integration">
            <Card>
              <CardHeader>
                <CardTitle>Integración API</CardTitle>
                <CardDescription>
                  Token para que el partner cree tenants vía API y configuración de sincronización
                  externa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key (x-api-key)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={maskKey(partner.api_key)} className="font-mono" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRegenOpen(true)}
                      disabled={regenM.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" /> Regenerar
                    </Button>
                  </div>
                  {revealedKey && (
                    <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Nueva API Key (se mostrará una sola vez)
                      </p>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={revealedKey}
                          className="font-mono text-xs"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(revealedKey);
                            toast.success("Copiada");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevealedKey(null)}
                      >
                        Ya la guardé, ocultar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <Label className="text-base">Sincronización externa</Label>
                    <p className="text-xs text-muted-foreground">
                      Permite que cambios en el sistema externo sincronicen tenants.
                    </p>
                  </div>
                  <Switch checked={externalSync} onCheckedChange={setExternalSync} />
                </div>

                <div className="space-y-2">
                  <Label>Umbral saldo bajo (créditos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={lowThreshold}
                    onChange={(e) => setLowThreshold(Number(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Notificación cuando la Super Wallet caiga por debajo de este monto.
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" asChild>
                    <a href="/admin/partner-settings">
                      <ExternalLink className="h-4 w-4 mr-2" /> Apariencia y branding
                    </a>
                  </Button>
                  <Button onClick={handleSaveIntegration} disabled={updateM.isPending}>
                    {updateM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tenants */}
          <TabsContent value="tenants">
            <Card>
              <CardHeader>
                <CardTitle>Tenants del partner</CardTitle>
                <CardDescription>
                  {fmtNumber(tenants?.length ?? 0)} tenants asociados a este partner.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!tenants || tenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Este partner aún no tiene tenants.
                  </p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {tenants.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => navigate(`/admin/tenants/${t.id}`)}
                        className="w-full text-left p-3 hover:bg-muted/50 transition flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Plan {t.plan} · {t.billing_state}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{fmtNumber(t.message_credits)} créditos</p>
                          <p>{new Date(t.created_at).toLocaleDateString()}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wallet */}
          <TabsContent value="wallet">
            <Card>
              <CardHeader>
                <CardTitle>Super Wallet</CardTitle>
                <CardDescription>
                  Saldo, recarga y movimientos del partner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-md">
                    <p className="text-sm text-muted-foreground">Saldo actual</p>
                    <p className="text-3xl font-semibold mt-1">
                      {fmtNumber(wallet?.balance_credits)}
                    </p>
                    <p className="text-xs text-muted-foreground">créditos</p>
                  </div>
                  <div className="p-4 border rounded-md">
                    <p className="text-sm text-muted-foreground">Umbral de alerta</p>
                    <p className="text-3xl font-semibold mt-1">
                      {fmtNumber(wallet?.low_balance_threshold)}
                    </p>
                    <p className="text-xs text-muted-foreground">créditos</p>
                  </div>
                </div>
                <Button asChild>
                  <a href="/admin/super-wallet">
                    <Wallet className="h-4 w-4 mr-2" /> Ir a Super Wallet
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger zone */}
          <TabsContent value="danger">
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <Trash2 className="h-5 w-5" /> Zona Peligrosa
                </CardTitle>
                <CardDescription>
                  Acciones irreversibles. Procede con cuidado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div>
                    <p className="font-medium">
                      {partner.is_active ? "Suspender partner" : "Reactivar partner"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {partner.is_active
                        ? "Los tenants seguirán existiendo pero el partner queda marcado como inactivo."
                        : "Restaura el partner al estado activo."}
                    </p>
                  </div>
                  <Button
                    variant={partner.is_active ? "destructive" : "default"}
                    onClick={() => {
                      setPendingActive(!partner.is_active);
                      setConfirmActiveOpen(true);
                    }}
                  >
                    {partner.is_active ? "Suspender" : "Activar"}
                  </Button>
                </div>

                <div className="p-4 border border-destructive/40 rounded-md space-y-3">
                  <p className="font-medium text-destructive">Eliminar partner</p>
                  <p className="text-xs text-muted-foreground">
                    Borra el partner, su Super Wallet y el historial del ledger. No es posible si
                    aún tiene tenants asignados ({fmtNumber(metrics?.tenants_total)} actualmente).
                  </p>
                  <Button
                    variant="destructive"
                    disabled={blockingTenants}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Eliminar partner
                  </Button>
                  {blockingTenants && (
                    <p className="text-xs text-amber-600">
                      Mueve o elimina los tenants del partner antes de eliminar.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Active toggle confirm */}
      <AlertDialog open={confirmActiveOpen} onOpenChange={setConfirmActiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingActive ? "Activar partner" : "Suspender partner"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingActive
                ? "El partner volverá a operar normalmente."
                : "El partner quedará marcado como inactivo. Los tenants seguirán existiendo pero el partner ya no podrá crear nuevos vía API."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmActive}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate key */}
      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Regenerar API Key
            </AlertDialogTitle>
            <AlertDialogDescription>
              La key actual quedará invalidada inmediatamente. Cualquier integración del partner
              dejará de funcionar hasta actualizar la nueva key. Escribe{" "}
              <strong>REGENERAR</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={regenConfirm}
            onChange={(e) => setRegenConfirm(e.target.value)}
            placeholder="REGENERAR"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRegenConfirm("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              disabled={regenConfirm !== "REGENERAR" || regenM.isPending}
            >
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Eliminar partner</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Para confirmar, escribe el ID del partner:{" "}
              <code className="font-mono">{partner.id}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={partner.id}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirm !== partner.id || deleteM.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-semibold mt-2">
          {value} {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}