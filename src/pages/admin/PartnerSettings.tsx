import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Upload, Mail, Palette, Eye, EyeOff, Wand2, ExternalLink, Key, Copy } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APP_BG_PRESETS,
  SIDEBAR_STYLE_OPTIONS,
  THEME_PRESETS,
  applyPartnerTheme,
  buildDefaultTheme,
  hexToHslString,
  hslStringToHex,
  type PartnerTheme,
} from "@/lib/partnerTheme";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PartnerRow {
  id: string;
  name: string;
  primary_color_hex: string;
  primary_color_hsl: string;
  logo_url: string;
  resend_api_key: string | null;
  resend_from_email: string | null;
  email_sender_name: string;
  email_sender_address: string;
  branding: PartnerTheme;
  non_sso_redirect_url: string | null;
  logout_redirect_url: string | null;
  api_key: string | null;
  external_sync_enabled: boolean;
}

export default function PartnerSettings() {
  const { partnerScope, isSuperAdmin } = useAuth();
  const { setLiveTheme } = usePartnerBranding();

  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [partner, setPartner] = useState<PartnerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGlobalAdmin = isSuperAdmin && !partnerScope;

  // Initial load: list of partners (only for global admins) or own partner (for scoped)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("partners")
          .select(
            "id, name, primary_color_hex, primary_color_hsl, logo_url, resend_api_key, resend_from_email, email_sender_name, email_sender_address, branding, non_sso_redirect_url, logout_redirect_url, api_key, external_sync_enabled",
          )
          .order("name");

        if (partnerScope) {
          query = query.eq("id", partnerScope);
        }

        const { data, error } = await query;
        if (cancelled) return;
        if (error) throw error;

        const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
          const base = buildDefaultTheme(r.primary_color_hsl as string | null);
          const saved = (r.branding ?? null) as Partial<PartnerTheme> | null;
          const branding: PartnerTheme = {
            ...base,
            ...(saved && typeof saved === "object" ? saved : {}),
            primary_color: saved?.primary_color || (r.primary_color_hsl as string) || base.primary_color,
          };
          return { ...(r as object), branding } as PartnerRow;
        });
        setPartners(rows);
        const initial = partnerScope
          ? rows.find((r) => r.id === partnerScope) ?? null
          : rows[0] ?? null;
        setSelectedId(initial?.id ?? null);
        setPartner(initial);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        toast.error(`No se pudo cargar la configuración: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerScope]);

  // Switch selected partner (only for global admins)
  useEffect(() => {
    if (!selectedId) return;
    const found = partners.find((p) => p.id === selectedId);
    if (found) setPartner(found);
  }, [selectedId, partners]);

  // Live preview: whenever the in-flight partner branding changes, apply tokens.
  useEffect(() => {
    if (!partner) return;
    setLiveTheme(partner.branding);
    return () => {
      // Revert to saved theme when unmounting / leaving the page
      setLiveTheme(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.branding]);

  const handleFieldChange = <K extends keyof PartnerRow>(key: K, value: PartnerRow[K]) => {
    setPartner((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateBranding = (patch: Partial<PartnerTheme>) => {
    setPartner((prev) =>
      prev
        ? {
            ...prev,
            branding: { ...prev.branding, ...patch },
          }
        : prev,
    );
  };

  const handleColorChange = (hex: string) => {
    if (!partner) return;
    const hsl = hexToHslString(hex);
    setPartner({
      ...partner,
      primary_color_hex: hex,
      primary_color_hsl: hsl,
      branding: { ...partner.branding, primary_color: hsl },
    });
  };

  const handleApplyPreset = (presetKey: keyof typeof THEME_PRESETS) => {
    if (!partner) return;
    const preset = THEME_PRESETS[presetKey].theme;
    const hex = hslStringToHex(preset.primary_color);
    setPartner({
      ...partner,
      primary_color_hex: hex,
      primary_color_hsl: preset.primary_color,
      branding: { ...preset },
    });
    toast.success(`Plantilla aplicada: ${THEME_PRESETS[presetKey].label}`);
  };

  const handleSaveBranding = async () => {
    if (!partner) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("partners")
        .update({
          name: partner.name,
          primary_color_hex: partner.primary_color_hex,
          primary_color_hsl: partner.primary_color_hsl,
          logo_url: partner.logo_url,
          branding: partner.branding as unknown as Record<string, string>,
        })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success("Apariencia actualizada");
      // Lock in the saved theme as the new baseline
      applyPartnerTheme(partner.branding);
      setLiveTheme(null);
      // Update local list cache
      setPartners((list) => list.map((p) => (p.id === partner.id ? partner : p)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!partner) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("partners")
        .update({
          resend_api_key: partner.resend_api_key || null,
          resend_from_email: partner.resend_from_email || null,
          email_sender_name: partner.email_sender_name,
        })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success("Configuración de email guardada");
      setPartners((list) => list.map((p) => (p.id === partner.id ? partner : p)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRedirects = async () => {
    if (!partner) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("partners")
        .update({
          non_sso_redirect_url: partner.non_sso_redirect_url?.trim() || null,
          logout_redirect_url: partner.logout_redirect_url?.trim() || null,
        })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success("Redirecciones actualizadas");
      setPartners((list) => list.map((p) => (p.id === partner.id ? partner : p)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiSettings = async () => {
    if (!partner || !isSuperAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("partners")
        .update({
          external_sync_enabled: partner.external_sync_enabled,
        })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success("Configuración de API actualizada");
      setPartners((list) => list.map((p) => (p.id === partner.id ? partner : p)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyApiToken = async () => {
    if (!partner?.api_key) {
      toast.error("No hay token configurado");
      return;
    }
    try {
      await navigator.clipboard.writeText(partner.api_key);
      toast.success("Token copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el token");
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!partner) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El logo no puede superar 2 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${partner.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("partner-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("partner-logos").getPublicUrl(path);
      handleFieldChange("logo_url", data.publicUrl);
      toast.success("Logo subido. Recuerda guardar los cambios.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`No se pudo subir el logo: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!partner) return;
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast.error("Ingresa un email válido");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-test-email", {
        body: { partner_id: partner.id, to_email: testEmail },
      });
      if (error) throw error;
      if ((data as { success?: boolean })?.success) {
        toast.success(`Email de prueba enviado a ${testEmail}`);
      } else {
        const errCode = (data as { error?: string })?.error ?? "unknown";
        toast.error(`Falló la prueba: ${errCode}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`Falló la prueba: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const headerTitle = useMemo(() => "Configuración de Partner", []);
  const headerDesc = useMemo(
    () => "Gestiona la apariencia y la mensajería de tu marca",
    [],
  );

  if (loading) {
    return (
      <AdminLayout title={headerTitle} description={headerDesc}>
        <div className="space-y-4 max-w-3xl">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!partner) {
    return (
      <AdminLayout title={headerTitle} description={headerDesc}>
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            No se encontró información de partner para tu cuenta.
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={headerTitle} description={headerDesc}>
      <div className="max-w-3xl space-y-6">
        {isGlobalAdmin && partners.length > 1 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Label className="whitespace-nowrap">Editando partner:</Label>
              <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Selecciona un partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" /> Apariencia
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" /> Email
            </TabsTrigger>
            <TabsTrigger value="redirects" className="gap-2">
              <ExternalLink className="h-4 w-4" /> Redireccionamiento
            </TabsTrigger>
          </TabsList>

          {/* APARIENCIA */}
          <TabsContent value="appearance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>
                  Personaliza el nombre, color y logotipo que verán tus usuarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="partner-name">Nombre de la instancia</Label>
                  <Input
                    id="partner-name"
                    value={partner.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                  />
                </div>

                {/* THEME ENGINE — full design tokens */}
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Palette className="h-4 w-4" /> Motor de tematización
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Controla la estética completa: fondo, sidebar y acento.
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Wand2 className="h-4 w-4" /> Cargar plantilla
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(THEME_PRESETS).map(([key, p]) => (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => handleApplyPreset(key as keyof typeof THEME_PRESETS)}
                            className="gap-2"
                          >
                            <span
                              className="h-3 w-3 rounded-full border border-border"
                              style={{ backgroundColor: `hsl(${p.theme.primary_color})` }}
                              aria-hidden
                            />
                            {p.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* App background */}
                    <div className="space-y-2">
                      <Label>Tema de fondo</Label>
                      <Select
                        value={partner.branding.app_bg}
                        onValueChange={(v) => updateBranding({ app_bg: v, theme_preset: undefined })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_BG_PRESETS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded border border-border"
                                  style={{ backgroundColor: `hsl(${opt.value})` }}
                                  aria-hidden
                                />
                                {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sidebar style */}
                    <div className="space-y-2">
                      <Label>Estilo de sidebar</Label>
                      <Select
                        value={partner.branding.sidebar_style}
                        onValueChange={(v) =>
                          updateBranding({
                            sidebar_style: v as PartnerTheme["sidebar_style"],
                            theme_preset: undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SIDEBAR_STYLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Accent color */}
                  <div className="space-y-2">
                    <Label>Color de acento</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={partner.primary_color_hex}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="h-10 w-16 rounded cursor-pointer bg-transparent border border-border"
                        aria-label="Selector de color de acento"
                      />
                      <Input
                        value={partner.primary_color_hex}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9a-fA-F]{6}$/.test(v)) handleColorChange(v);
                          else handleFieldChange("primary_color_hex", v);
                        }}
                        className="max-w-[140px] font-mono"
                      />
                      <div
                        className="h-10 w-10 rounded border border-border"
                        style={{ backgroundColor: partner.primary_color_hex }}
                        aria-hidden
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Vista previa aplicada en vivo en la app. Guarda para persistir.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Logotipo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded border border-border bg-muted flex items-center justify-center overflow-hidden">
                      {partner.logo_url ? (
                        <img
                          src={partner.logo_url}
                          alt="Logo actual"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin logo</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Subir nuevo logo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <Input
                    value={partner.logo_url}
                    onChange={(e) => handleFieldChange("logo_url", e.target.value)}
                    placeholder="https://..."
                    className="font-mono text-xs"
                  />
                </div>

                <div className="pt-2">
                  <Button onClick={handleSaveBranding} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Guardar apariencia
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EMAIL */}
          <TabsContent value="email" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Integración con Resend</CardTitle>
                <CardDescription>
                  Configura tu cuenta de Resend para enviar correos transaccionales con tu propio dominio.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="sender-name">Nombre remitente</Label>
                  <Input
                    id="sender-name"
                    value={partner.email_sender_name}
                    onChange={(e) => handleFieldChange("email_sender_name", e.target.value)}
                    placeholder="Ej. MLS Latam"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from-email">Email remitente</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={partner.resend_from_email ?? ""}
                    onChange={(e) => handleFieldChange("resend_from_email", e.target.value)}
                    placeholder="info@tudominio.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    El dominio debe estar verificado en tu cuenta de Resend.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resend-key">Resend API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="resend-key"
                      type={showApiKey ? "text" : "password"}
                      value={partner.resend_api_key ?? ""}
                      onChange={(e) => handleFieldChange("resend_api_key", e.target.value)}
                      placeholder="re_..."
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey((v) => !v)}
                      aria-label={showApiKey ? "Ocultar" : "Mostrar"}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se almacena cifrada. Nunca se expone al navegador después de guardar.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleSaveEmail} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Guardar configuración
                  </Button>
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  <Label htmlFor="test-email">Probar conexión</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="prueba@tudominio.com"
                    />
                    <Button
                      onClick={handleTestEmail}
                      disabled={testing || !partner.resend_api_key || !partner.resend_from_email}
                      variant="secondary"
                    >
                      {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Enviar prueba
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Guarda primero los cambios. Se enviará un correo de prueba con las credenciales almacenadas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REDIRECCIONAMIENTO */}
          <TabsContent value="redirects" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Redireccionamiento de marca blanca</CardTitle>
                <CardDescription>
                  Controla a dónde se envía a los usuarios cuando entran sin
                  sesión o cuando cierran sesión, para mantener oculta la
                  infraestructura interna del CRM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="non-sso-url">Non SSO</Label>
                  <Input
                    id="non-sso-url"
                    type="url"
                    value={partner.non_sso_redirect_url ?? ""}
                    onChange={(e) =>
                      handleFieldChange("non_sso_redirect_url", e.target.value)
                    }
                    placeholder="https://app.tudominio.com/login"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cuando un usuario llega a la página de bienvenida sin estar
                    logueado, será redirigido a esta dirección externa en lugar
                    de mostrarle la pantalla de acceso interna.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logout-url">Logout</Label>
                  <Input
                    id="logout-url"
                    type="url"
                    value={partner.logout_redirect_url ?? ""}
                    onChange={(e) =>
                      handleFieldChange("logout_redirect_url", e.target.value)
                    }
                    placeholder="https://app.tudominio.com/"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tras cerrar sesión, el usuario será enviado a esta
                    dirección. Si lo dejas vacío, los super administradores
                    seguirán el flujo interno por defecto.
                  </p>
                </div>

                <div className="pt-2">
                  <Button onClick={handleSaveRedirects} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Guardar redirecciones
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}