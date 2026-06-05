import { useState } from "react";
import {
  Sparkles,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Plug,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMetaAdsConnection } from "@/hooks/useMetaAdsConnection";
import { useMetaAdsCampaigns } from "@/hooks/useMetaAdsCampaigns";
import { CampaignsList } from "@/components/meta-ads/CampaignsList";
import { CreateCampaignWizard } from "@/components/meta-ads/CreateCampaignWizard";
import { DateRangePicker } from "@/components/meta-ads/DateRangePicker";
import { useSummaryInsights, type DateRange } from "@/hooks/useMetaAdsInsights";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { cn } from "@/lib/utils";

interface AdAccount {
  id: string;
  name: string;
  status: number;
  currency: string;
  timezone: string;
}

interface PixelOption {
  id: string;
  name: string;
}

const NO_PIXEL = "__none__";

export default function MetaAds() {
  const { tenantRole, isSuperAdmin } = useAuth();
  const canManage =
    isSuperAdmin || tenantRole === "administrador" || tenantRole === "manager";
  const { data: connection, isLoading } = useMetaAdsConnection();
  const { data: campaigns = [], isLoading: loadingCampaigns } =
    useMetaAdsCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ preset: "last_7d" });

  const isConnected = connection?.status === "connected";
  const { data: summary } = useSummaryInsights(dateRange, isConnected);
  const insightsByCampaign = (summary?.campaigns ?? []).reduce(
    (acc, s) => {
      acc[s.campaign_id] = s.insights;
      return acc;
    },
    {} as Record<string, ReturnType<typeof Object> | any>,
  );

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Meta Ads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de campañas publicitarias
          </p>
        </div>
        {/* El acceso principal a crear campañas es desde Propiedades. */}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isConnected ? (
            <>
              <ConnectedCard connection={connection!} canManage={canManage} />
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold">Campañas</h2>
                  <DateRangePicker value={dateRange} onChange={setDateRange} />
                </div>
                {loadingCampaigns ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-10 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Aún no has creado campañas.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      También puedes crear campañas directamente desde tu inventario de propiedades.
                    </p>
                    {canManage && (
                      <Button onClick={() => setWizardOpen(true)}>
                        <Plus className="h-4 w-4" /> Nueva campaña
                      </Button>
                    )}
                  </div>
                ) : (
                  <CampaignsList
                    campaigns={campaigns}
                    canManage={canManage}
                    insightsByCampaign={insightsByCampaign}
                  />
                )}
              </section>
            </>
          ) : (
            <ConnectWizard canManage={canManage} initialError={connection?.error_message ?? null} />
          )}
        </div>
      </div>

      <CreateCampaignWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function ConnectedCard({
  connection,
  canManage,
}: {
  connection: NonNullable<ReturnType<typeof useMetaAdsConnection>["data"]>;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [changingAccount, setChangingAccount] = useState(false);
  const [changeAccountLoading, setChangeAccountLoading] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<AdAccount[]>([]);
  const [changeAccountError, setChangeAccountError] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const handleOpenChangeAccount = async () => {
    setChangeAccountLoading(true);
    setChangeAccountError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "validate-meta-ads-credentials",
        { body: { action: "list_accounts" } },
      );
      if (error) {
        const msg = await extractEdgeFunctionError(error);
        setChangeAccountError(msg);
        return;
      }
      if (!data?.ad_accounts) {
        setChangeAccountError(data?.error ?? "Error al cargar cuentas");
        return;
      }
      setAvailableAccounts(data.ad_accounts);
      setChangingAccount(true);
    } catch (e) {
      setChangeAccountError(
        e instanceof Error ? e.message : "Error al cargar cuentas",
      );
    } finally {
      setChangeAccountLoading(false);
    }
  };

  const handleSelectNewAccount = async (accountId: string, accountName: string) => {
    setSwitchingTo(accountId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "validate-meta-ads-credentials",
        {
          body: {
            action: "connect",
            access_token: "__use_stored__",
            ad_account_id: accountId,
            ad_account_name: accountName,
          },
        },
      );
      if (error || !data?.success) {
        const msg = error
          ? await extractEdgeFunctionError(error)
          : data?.error || "No se pudo cambiar la cuenta";
        toast.error("No se pudo cambiar la cuenta", { description: msg });
        return;
      }
      toast.success("Cuenta publicitaria actualizada");
      setChangingAccount(false);
      queryClient.invalidateQueries({ queryKey: ["meta-ads-connection"] });
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const { error } = await supabase
      .from("meta_ads_connections")
      .update({ status: "disconnected" })
      .eq("id", connection.id);
    setDisconnecting(false);
    if (error) {
      toast.error("No se pudo desconectar", { description: error.message });
      return;
    }
    toast.success("Cuenta desconectada");
    queryClient.invalidateQueries({ queryKey: ["meta-ads-connection"] });
  };

  if (reconnecting) {
    return (
      <ConnectWizard
        canManage={canManage}
        initialError={null}
        onCancel={() => setReconnecting(false)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="h-8 w-8 rounded-full bg-green-500/15 flex items-center justify-center">
            <Check className="h-5 w-5 text-green-500" />
          </div>
          Meta Ads conectado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Cuenta" value={connection.ad_account_name || "—"} />
        <Row label="ID" value={connection.ad_account_id || "—"} mono />
        <Row label="Pixel" value={connection.pixel_name || "Sin pixel"} />
        <Row label="Conectado como" value={connection.meta_user_name || "—"} />
        <Row
          label="Última validación"
          value={
            connection.last_validated_at
              ? new Date(connection.last_validated_at).toLocaleString("es-MX")
              : "—"
          }
        />

        {canManage && (
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleOpenChangeAccount}
              disabled={changeAccountLoading}
            >
              {changeAccountLoading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Cambiar cuenta
            </Button>
            <Button variant="outline" onClick={() => setReconnecting(true)}>
              Reconectar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={disconnecting}>
                  {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Desconectar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Desconectar Meta Ads?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se perderá el acceso a la cuenta publicitaria. Podrás
                    reconectarla en cualquier momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>
                    Desconectar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        {changeAccountError && (
          <p className="text-sm text-destructive flex items-center gap-1 pt-2">
            <AlertCircle className="h-3.5 w-3.5" /> {changeAccountError}
          </p>
        )}
      </CardContent>

      <Dialog open={changingAccount} onOpenChange={setChangingAccount}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cambiar cuenta publicitaria</DialogTitle>
            <DialogDescription>
              Selecciona la cuenta con la que quieres trabajar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {availableAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No se encontraron cuentas publicitarias.
              </p>
            ) : (
              availableAccounts.map((acc) => {
                const disabled = acc.status !== 1;
                const isCurrent = acc.id === connection.ad_account_id;
                const isSwitching = switchingTo === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={disabled || isCurrent || !!switchingTo}
                    onClick={() => handleSelectNewAccount(acc.id, acc.name)}
                    className={cn(
                      "w-full text-left rounded-md border p-3 transition-colors",
                      "border-border hover:bg-accent",
                      (disabled || isCurrent) &&
                        "opacity-60 cursor-not-allowed hover:bg-transparent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{acc.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {acc.id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {acc.currency} · {acc.timezone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent && <Badge variant="secondary">Actual</Badge>}
                        {disabled && !isCurrent && (
                          <Badge variant="secondary">Deshabilitada</Badge>
                        )}
                        {isSwitching && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setChangingAccount(false)}
              disabled={!!switchingTo}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border last:border-0 pb-2 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground text-right", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function ConnectWizard({
  canManage,
  initialError,
  onCancel,
}: {
  canManage: boolean;
  initialError: string | null;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [validating, setValidating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const [metaUser, setMetaUser] = useState<{ id: string; name: string } | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pixels, setPixels] = useState<PixelOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedPixelId, setSelectedPixelId] = useState<string>(NO_PIXEL);

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meta Ads no está conectado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Solo un administrador o manager puede conectar la cuenta de Meta Ads.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleValidate = async () => {
    if (!accessToken.trim()) return;
    setValidating(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "validate-meta-ads-credentials",
        { body: { access_token: accessToken.trim(), action: "validate" } },
      );
      if (invokeError) {
        const msg = await extractEdgeFunctionError(invokeError);
        setError(msg);
        return;
      }
      if (!data?.valid) {
        setError(data?.error || "Token inválido");
        return;
      }
      setMetaUser(data.meta_user);
      setAdAccounts(data.ad_accounts || []);
      setPixels(data.pixels || []);
      setSelectedAccountId(null);
      setSelectedPixelId(NO_PIXEL);
    } finally {
      setValidating(false);
    }
  };

  const handleConnect = async () => {
    const account = adAccounts.find((a) => a.id === selectedAccountId);
    if (!account) return;
    const pixel = pixels.find((p) => p.id === selectedPixelId);
    setConnecting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "validate-meta-ads-credentials",
        {
          body: {
            access_token: accessToken.trim(),
            action: "connect",
            ad_account_id: account.id,
            ad_account_name: account.name,
            pixel_id: pixel?.id ?? null,
            pixel_name: pixel?.name ?? null,
          },
        },
      );
      if (invokeError || !data?.success) {
        const msg = invokeError
          ? await extractEdgeFunctionError(invokeError)
          : data?.error || "No se pudo conectar la cuenta";
        toast.error("Error al conectar", { description: msg });
        return;
      }
      toast.success("Cuenta de Meta Ads conectada correctamente");
      queryClient.invalidateQueries({ queryKey: ["meta-ads-connection"] });
      onCancel?.();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plug className="h-5 w-5 text-primary" />
          Conecta tu cuenta de Meta Ads
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Necesitas un Access Token de usuario de Meta con permisos de{" "}
          <code className="text-xs">ads_management</code> y{" "}
          <code className="text-xs">ads_read</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <a
          href="https://developers.facebook.com/tools/explorer/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          ¿Cómo obtener mi Access Token? <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="space-y-2">
          <Label htmlFor="meta-token">Access Token</Label>
          <div className="relative">
            <Input
              id="meta-token"
              type={showToken ? "text" : "password"}
              placeholder="EAAxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={validating || !!metaUser}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>

        {!metaUser ? (
          <div className="flex gap-2">
            <Button
              onClick={handleValidate}
              disabled={validating || !accessToken.trim()}
            >
              {validating && <Loader2 className="h-4 w-4 animate-spin" />}
              Validar token
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={validating}>
                Cancelar
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Token válido — conectado como{" "}
              <span className="font-medium">{metaUser.name}</span>
            </div>

            <div className="space-y-2">
              <Label>Selecciona tu cuenta publicitaria</Label>
              {adAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No se encontraron cuentas publicitarias.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {adAccounts.map((acc) => {
                    const disabled = acc.status !== 1;
                    const selected = selectedAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={cn(
                          "w-full text-left rounded-md border p-3 transition-colors",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent",
                          disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{acc.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {acc.id}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {acc.currency} · {acc.timezone}
                            </p>
                          </div>
                          {disabled && <Badge variant="secondary">Deshabilitada</Badge>}
                          {selected && !disabled && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Pixel de seguimiento (opcional)</Label>
              <Select value={selectedPixelId} onValueChange={setSelectedPixelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin pixel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PIXEL}>Sin pixel</SelectItem>
                  {pixels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConnect}
                disabled={connecting || !selectedAccountId}
              >
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                Conectar cuenta
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMetaUser(null);
                  setAdAccounts([]);
                  setPixels([]);
                  setSelectedAccountId(null);
                }}
                disabled={connecting}
              >
                Cambiar token
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} disabled={connecting}>
                  Cancelar
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}