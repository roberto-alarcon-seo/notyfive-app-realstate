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
import { Loader2, Upload, Mail, Palette, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

// Convert "#RRGGBB" to "H S% L%" string used in CSS variables
function hexToHslString(hex: string): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyPrimaryColorPreview(hsl: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
  root.style.setProperty("--message-outgoing", hsl);
}

export default function PartnerSettings() {
  const { partnerScope, isSuperAdmin } = useAuth();

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
            "id, name, primary_color_hex, primary_color_hsl, logo_url, resend_api_key, resend_from_email, email_sender_name, email_sender_address",
          )
          .order("name");

        if (partnerScope) {
          query = query.eq("id", partnerScope);
        }

        const { data, error } = await query;
        if (cancelled) return;
        if (error) throw error;

        const rows = (data ?? []) as PartnerRow[];
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

  const handleFieldChange = <K extends keyof PartnerRow>(key: K, value: PartnerRow[K]) => {
    setPartner((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleColorChange = (hex: string) => {
    if (!partner) return;
    const hsl = hexToHslString(hex);
    setPartner({ ...partner, primary_color_hex: hex, primary_color_hsl: hsl });
    applyPrimaryColorPreview(hsl);
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
        })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success("Apariencia actualizada");
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

                <div className="space-y-2">
                  <Label>Color primario</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={partner.primary_color_hex}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="h-10 w-16 rounded cursor-pointer bg-transparent border border-border"
                      aria-label="Selector de color primario"
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
                  <p className="text-xs text-muted-foreground">
                    Vista previa aplicada en vivo. Guarda para persistir el cambio.
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
        </Tabs>
      </div>
    </AdminLayout>
  );
}