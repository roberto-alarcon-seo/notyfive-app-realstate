import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Copy, KeyRound, AlertTriangle, CheckCircle2, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { buildDefaultTheme, hexToHslString } from "@/lib/partnerTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (partnerId: string) => void;
}

const SLUG_REGEX = /^[a-z][a-z0-9_]{2,30}$/;
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

function generateApiKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const b64 = btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `pk_live_${b64}`;
}

const COUNTRIES = ["MX", "CO", "AR", "CL", "PE", "US", "ES"];

export function CreatePartnerDialog({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Step 1
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [country, setCountry] = useState("MX");

  // Step 2
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryHex, setPrimaryHex] = useState("#7C3AED");
  const [nonSsoRedirectUrl, setNonSsoRedirectUrl] = useState("");
  const [logoutRedirectUrl, setLogoutRedirectUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [generateKey, setGenerateKey] = useState(true);
  const [externalSync, setExternalSync] = useState(true);
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const [lowThreshold, setLowThreshold] = useState<string>("1000");
  const [confirmText, setConfirmText] = useState("");

  const reset = () => {
    setStep(1);
    setId(""); setName(""); setPrimaryDomain(""); setCountry("MX");
    setLogoUrl(""); setPrimaryHex("#7C3AED");
    setNonSsoRedirectUrl(""); setLogoutRedirectUrl("");
    setGenerateKey(true); setExternalSync(true);
    setInitialBalance("0"); setLowThreshold("1000");
    setConfirmText(""); setCreatedKey(null); setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const step1Errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!SLUG_REGEX.test(id)) e.id = "ID inválido (ej. acme, 3–30 chars, minúsculas)";
    if (name.trim().length < 2) e.name = "Nombre requerido";
    if (!DOMAIN_REGEX.test(primaryDomain)) e.primaryDomain = "Dominio inválido (ej. app.acme.com)";
    return e;
  }, [id, name, primaryDomain]);

  const step2Errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!HEX_REGEX.test(primaryHex)) e.primaryHex = "Color hex inválido";
    if (!logoUrl.trim()) e.logoUrl = "URL de logo requerida";
    return e;
  }, [primaryHex, logoUrl]);

  const balNum = Number(initialBalance);
  const thrNum = Number(lowThreshold);
  const step3Valid =
    !Number.isNaN(balNum) && balNum >= 0 &&
    !Number.isNaN(thrNum) && thrNum >= 0 &&
    confirmText === "CREAR";

  const goNext = async () => {
    if (step === 1) {
      if (Object.keys(step1Errors).length) return;
      // Check duplicates
      const { data, error } = await supabase
        .from("partners")
        .select("id, primary_domain")
        .or(`id.eq.${id},primary_domain.eq.${primaryDomain}`);
      if (error) { toast.error(error.message); return; }
      if (data && data.length) {
        toast.error("Ya existe un partner con ese ID o dominio");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (Object.keys(step2Errors).length) return;
      setStep(3);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El logo no puede superar 2 MB");
      return;
    }
    if (!id) {
      toast.error("Define el ID del partner primero (paso 1)");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("partner-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("partner-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Logo subido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCreate = async () => {
    if (!step3Valid) return;
    setSubmitting(true);
    try {
      const hsl = hexToHslString(primaryHex);
      const apiKey = generateKey ? generateApiKey() : null;
      const branding = buildDefaultTheme(hsl);

      const { error: insErr } = await supabase.from("partners").insert([{
        id,
        name: name.trim(),
        primary_domain: primaryDomain.toLowerCase().trim(),
        country_code: country,
        logo_url: logoUrl.trim(),
        primary_color_hex: primaryHex,
        primary_color_hsl: hsl,
        email_sender_name: name.trim(),
        branding: branding as never,
        api_key: apiKey,
        external_sync_enabled: externalSync,
        non_sso_redirect_url: nonSsoRedirectUrl.trim() || null,
        logout_redirect_url: logoutRedirectUrl.trim() || null,
        is_active: true,
      }]);
      if (insErr) {
        if (insErr.code === "23505") toast.error("ID o dominio duplicado");
        else if (insErr.code === "42501") toast.error("Solo super admins globales pueden crear partners");
        else toast.error(insErr.message);
        setSubmitting(false);
        return;
      }

      // Wallet row
      const { error: walletErr } = await supabase
        .from("partner_super_wallets")
        .insert({ partner_id: id, balance_credits: 0, low_balance_threshold: thrNum });
      if (walletErr && walletErr.code !== "23505") {
        toast.warning(`Partner creado pero falló la wallet: ${walletErr.message}`);
      }

      // Initial top-up
      if (balNum > 0) {
        const { error: topErr } = await supabase.rpc("partner_wallet_topup", {
          _partner_id: id,
          _amount: balNum,
          _description: "Saldo inicial al crear partner",
        });
        if (topErr) {
          toast.warning(`Saldo no asignado: ${topErr.message}`);
        }
      }

      qc.invalidateQueries({ queryKey: ["partners"] });
      toast.success(`Partner "${name}" creado`);
      onCreated?.(id);

      if (apiKey) {
        setCreatedKey(apiKey);
      } else {
        handleOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  // API key reveal screen
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-w-[92vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Partner creado correctamente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span>
                  Esta es la <strong>única vez</strong> que verás este API Token completo.
                  Cópialo y guárdalo en un lugar seguro.
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Token (x-api-key)</Label>
              <div className="flex gap-2">
                <Input value={createdKey} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(createdKey);
                    toast.success("Token copiado");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-[92vw]">
        <DialogHeader>
          <DialogTitle>Crear nuevo Partner — Paso {step} de 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ID (slug único)</Label>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="acme"
              />
              {step1Errors.id && <p className="text-xs text-destructive">{step1Errors.id}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Real Estate" />
              {step1Errors.name && <p className="text-xs text-destructive">{step1Errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Dominio principal</Label>
              <Input
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value.toLowerCase())}
                placeholder="app.acme.com"
              />
              {step1Errors.primaryDomain && (
                <p className="text-xs text-destructive">{step1Errors.primaryDomain}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL del logo</Label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/lovable-uploads/logo.png o https://..."
              />
              {step2Errors.logoUrl && <p className="text-xs text-destructive">{step2Errors.logoUrl}</p>}
              <p className="text-xs text-muted-foreground">
                Puedes subir una imagen mejor desde Apariencia tras crear el partner.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Color primario</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={primaryHex}
                  onChange={(e) => setPrimaryHex(e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="font-mono" />
              </div>
              {step2Errors.primaryHex && <p className="text-xs text-destructive">{step2Errors.primaryHex}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email sender (nombre)</Label>
                <Input value={emailSenderName} onChange={(e) => setEmailSenderName(e.target.value)} placeholder="Acme" />
                {step2Errors.emailSenderName && <p className="text-xs text-destructive">{step2Errors.emailSenderName}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email sender (dirección)</Label>
                <Input
                  value={emailSenderAddress}
                  onChange={(e) => setEmailSenderAddress(e.target.value)}
                  placeholder="no-reply@notifications.acme.com"
                />
                {step2Errors.emailSenderAddress && <p className="text-xs text-destructive">{step2Errors.emailSenderAddress}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL de redirección Non-SSO (opcional)</Label>
              <Input value={nonSsoRedirectUrl} onChange={(e) => setNonSsoRedirectUrl(e.target.value)} placeholder="https://acme.com/login" />
            </div>
            <div className="space-y-2">
              <Label>URL de logout (opcional)</Label>
              <Input value={logoutRedirectUrl} onChange={(e) => setLogoutRedirectUrl(e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Generar API Token</Label>
                <p className="text-xs text-muted-foreground">Para integrar tenants vía API (x-api-key)</p>
              </div>
              <Switch checked={generateKey} onCheckedChange={setGenerateKey} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="space-y-0.5">
                <Label>Sincronización externa habilitada</Label>
                <p className="text-xs text-muted-foreground">Permite que el partner cree tenants vía API</p>
              </div>
              <Switch checked={externalSync} onCheckedChange={setExternalSync} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Saldo inicial Super Wallet</Label>
                <Input
                  type="number"
                  min={0}
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Umbral de saldo bajo</Label>
                <Input
                  type="number"
                  min={0}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Para confirmar, escribe <strong>CREAR</strong></Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="CREAR"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
              Atrás
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {step < 3 ? (
            <Button
              onClick={goNext}
              disabled={
                (step === 1 && Object.keys(step1Errors).length > 0) ||
                (step === 2 && Object.keys(step2Errors).length > 0)
              }
            >
              Siguiente
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={!step3Valid || submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : "Crear Partner"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}