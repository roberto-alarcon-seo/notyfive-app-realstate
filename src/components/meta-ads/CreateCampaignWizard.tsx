import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Sparkles, ImageIcon, Check, MessageCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { cn } from "@/lib/utils";
import type { MetaAdsCampaign } from "@/hooks/useMetaAdsCampaigns";

interface PropertyOption {
  id: string;
  title: string;
  price: number;
  currency: string;
  zone: string;
  operation_type: string;
  property_type: string | null;
  property_images: Array<{ file_url: string; is_cover: boolean }>;
}

const LOADING_MESSAGES = [
  "Analizando la propiedad...",
  "Generando copy publicitario...",
  "Configurando audiencia objetivo...",
  "Calculando presupuesto recomendado...",
];

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString("es-MX")}`;
  }
}

export function CreateCampaignWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [objective, setObjective] = useState<"MESSAGES" | "LEAD_GENERATION" | null>(null);
  const [facebookPageId, setFacebookPageId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null);
  const [generating, setGenerating] = useState(false);
  const [campaign, setCampaign] = useState<MetaAdsCampaign | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(
      () => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length),
      1500,
    );
    return () => clearInterval(t);
  }, [generating]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setObjective(null);
      setFacebookPageId("");
      setSearch("");
      setSelectedProperty(null);
      setCampaign(null);
      setGenerating(false);
      setPublishing(false);
      setSaving(false);
    }
  }, [open]);

  const { data: properties = [], isLoading: loadingProps } = useQuery({
    enabled: open,
    queryKey: ["meta-ads-properties"],
    queryFn: async (): Promise<PropertyOption[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, title, price, currency, zone, operation_type, property_type, property_images(file_url, is_cover)",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as PropertyOption[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return properties;
    return properties.filter(
      (p) =>
        p.title.toLowerCase().includes(s) || p.zone.toLowerCase().includes(s),
    );
  }, [properties, search]);

  const goToStep2 = async () => {
    if (!selectedProperty) return;
    setStep(2);
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "ai-meta-campaign-builder",
        {
          body: {
            action: "generate",
            property_id: selectedProperty.id,
            objective: objective ?? "LEAD_GENERATION",
            facebook_page_id: objective === "MESSAGES" ? facebookPageId.trim() : null,
          },
        },
      );
      if (error) {
        const msg = await extractEdgeFunctionError(error);
        toast.error("No se pudo generar la campaña", { description: msg });
        setStep(1);
        return;
      }
      if (!data?.campaign) {
        toast.error("Respuesta inválida del generador");
        setStep(1);
        return;
      }
      setCampaign(data.campaign as MetaAdsCampaign);
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async (publishAfter = false) => {
    if (!campaign) return;
    setSaving(true);
    const { error } = await supabase
      .from("meta_ads_campaigns")
      .update({
        name: campaign.name,
        headline: campaign.headline,
        primary_text: campaign.primary_text,
        description: campaign.description,
        age_min: campaign.age_min,
        age_max: campaign.age_max,
        genders: campaign.genders,
        daily_budget_cents: campaign.daily_budget_cents,
        status: publishAfter ? campaign.status : "draft",
      })
      .eq("id", campaign.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar", { description: error.message });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
    if (!publishAfter) {
      toast.success("Borrador guardado");
      onOpenChange(false);
    }
    return true;
  };

  const publish = async () => {
    if (!campaign) return;
    const ok = await saveDraft(true);
    if (!ok) return;
    setPublishing(true);
    const { data, error } = await supabase.functions.invoke(
      "ai-meta-campaign-builder",
      { body: { action: "publish", campaign_id: campaign.id } },
    );
    setPublishing(false);
    if (error || !data?.success) {
      const msg = error
        ? await extractEdgeFunctionError(error)
        : data?.error || "Error al publicar";
      toast.error("No se pudo publicar", { description: msg });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      return;
    }
    toast.success("Campaña publicada en Meta");
    queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
    onOpenChange(false);
  };

  const updateCampaign = <K extends keyof MetaAdsCampaign>(
    key: K,
    value: MetaAdsCampaign[K],
  ) => setCampaign((c) => (c ? { ...c, [key]: value } : c));

  const budgetMxn = (campaign?.daily_budget_cents ?? 0) / 100;
  const estimatedLeads = Math.max(1, Math.round(budgetMxn / 50));

  const genderList = campaign?.genders ?? [];
  const hasMen = genderList.includes("1");
  const hasWomen = genderList.includes("2");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Nueva campaña
          </SheetTitle>
          <div className="flex items-center gap-2 pt-2">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium",
                    step >= (n as 0 | 1 | 2 | 3)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {n + 1}
                </div>
                {n < 3 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 rounded",
                      step > (n as 0 | 1 | 2 | 3) ? "bg-primary" : "bg-muted",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </SheetHeader>

        <div className="mt-6">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">¿Qué resultado buscas?</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setObjective("MESSAGES")}
                  className={cn(
                    "text-left rounded-lg border p-4 transition-colors relative",
                    objective === "MESSAGES"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <Badge className="absolute top-2 right-2 text-[10px]">Recomendado</Badge>
                  <MessageCircle className="h-6 w-6 text-primary mb-2" />
                  <p className="font-medium text-sm">Mensajes por WhatsApp</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    El lead abre WhatsApp y pregunta directamente. La IA responde automáticamente.
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    <li>✓ Flujo automático completo</li>
                    <li>✓ Sin pasos extra</li>
                  </ul>
                </button>
                <button
                  type="button"
                  onClick={() => setObjective("LEAD_GENERATION")}
                  className={cn(
                    "text-left rounded-lg border p-4 transition-colors",
                    objective === "LEAD_GENERATION"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <ClipboardList className="h-6 w-6 text-primary mb-2" />
                  <p className="font-medium text-sm">Formulario de leads</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Meta captura nombre, teléfono y email del lead. Llegan al CRM automáticamente.
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    <li>Útil si no tienes Página de Facebook vinculada</li>
                  </ul>
                </button>
              </div>

              {objective === "MESSAGES" && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <Label htmlFor="fb-page">ID de tu Página de Facebook</Label>
                  <Input
                    id="fb-page"
                    value={facebookPageId}
                    onChange={(e) => setFacebookPageId(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456789012345"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encuéntralo en Configuración de tu Página → Acerca de → ID de página.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setStep(1)}
                  disabled={
                    !objective ||
                    (objective === "MESSAGES" && facebookPageId.trim().length < 5)
                  }
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium">
                ¿Sobre qué propiedad quieres anunciarte?
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por título o ciudad..."
                  className="pl-9"
                />
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {loadingProps ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No se encontraron propiedades.
                  </p>
                ) : (
                  filtered.map((p) => {
                    const cover =
                      p.property_images?.find((i) => i.is_cover)?.file_url ??
                      p.property_images?.[0]?.file_url ??
                      null;
                    const selected = selectedProperty?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProperty(p)}
                        className={cn(
                          "w-full text-left rounded-md border p-3 transition-colors flex gap-3",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <div className="w-16 h-16 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                          {cover ? (
                            <img
                              src={cover}
                              alt={p.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {p.title}
                            </p>
                            {selected && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.zone}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-medium">
                              {formatPrice(Number(p.price), p.currency)}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {p.operation_type === "sale" ? "Venta" : "Renta"}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Atrás
                </Button>
                <Button onClick={goToStep2} disabled={!selectedProperty}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {generating || !campaign ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative">
                    <Sparkles className="h-10 w-10 text-primary" />
                    <Loader2 className="h-10 w-10 animate-spin text-primary/40 absolute inset-0" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </p>
                </div>
              ) : (
                <>
                  <section className="space-y-3">
                    <h3 className="font-medium text-sm">Copy del anuncio</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="headline">Título del anuncio</Label>
                        <span className="text-xs text-muted-foreground">
                          {campaign.headline.length}/40
                        </span>
                      </div>
                      <Input
                        id="headline"
                        value={campaign.headline}
                        maxLength={40}
                        onChange={(e) => updateCampaign("headline", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="primary">Texto principal</Label>
                        <span className="text-xs text-muted-foreground">
                          {campaign.primary_text.length}/125
                        </span>
                      </div>
                      <Textarea
                        id="primary"
                        value={campaign.primary_text}
                        maxLength={125}
                        rows={3}
                        onChange={(e) =>
                          updateCampaign("primary_text", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="desc">Descripción</Label>
                        <span className="text-xs text-muted-foreground">
                          {(campaign.description ?? "").length}/30
                        </span>
                      </div>
                      <Input
                        id="desc"
                        value={campaign.description ?? ""}
                        maxLength={30}
                        onChange={(e) =>
                          updateCampaign("description", e.target.value)
                        }
                      />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="font-medium text-sm">Audiencia</h3>
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Edad mínima</Label>
                        <Input
                          type="number"
                          min={18}
                          max={65}
                          value={campaign.age_min ?? 25}
                          onChange={(e) =>
                            updateCampaign("age_min", Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Edad máxima</Label>
                        <Input
                          type="number"
                          min={18}
                          max={65}
                          value={campaign.age_max ?? 65}
                          onChange={(e) =>
                            updateCampaign("age_max", Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-6 pt-1">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={hasMen}
                          onCheckedChange={(v) => {
                            const set = new Set(genderList);
                            v ? set.add("1") : set.delete("1");
                            updateCampaign(
                              "genders",
                              Array.from(set) as string[],
                            );
                          }}
                        />
                        Hombres
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={hasWomen}
                          onCheckedChange={(v) => {
                            const set = new Set(genderList);
                            v ? set.add("2") : set.delete("2");
                            updateCampaign(
                              "genders",
                              Array.from(set) as string[],
                            );
                          }}
                        />
                        Mujeres
                      </label>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Ubicación: </span>
                      <span>
                        {(campaign.geo_locations?.cities?.[0]?.name as string) ??
                          selectedProperty?.zone ??
                          "—"}
                      </span>
                    </div>
                    {Array.isArray(campaign.interests) &&
                      campaign.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(campaign.interests as Array<{ name: string }>).map(
                            (i, idx) => (
                              <Badge key={idx} variant="secondary">
                                {i.name}
                              </Badge>
                            ),
                          )}
                        </div>
                      )}
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-medium text-sm">Presupuesto</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        MXN $
                      </span>
                      <Input
                        type="number"
                        min={50}
                        value={budgetMxn}
                        onChange={(e) =>
                          updateCampaign(
                            "daily_budget_cents",
                            Math.round(Number(e.target.value) * 100),
                          )
                        }
                      />
                      <span className="text-sm text-muted-foreground">/día</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Estimado: ~{estimatedLeads} leads por día
                    </p>
                  </section>

                  <section className="rounded-md border bg-card p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Vista previa
                    </p>
                    {campaign.image_url && (
                      <img
                        src={campaign.image_url}
                        alt=""
                        className="rounded w-full max-h-48 object-cover"
                      />
                    )}
                    <p className="font-semibold text-sm">{campaign.headline}</p>
                    <p className="text-sm text-muted-foreground">
                      {campaign.primary_text}
                    </p>
                    <Button size="sm" variant="outline" disabled>
                      Más información
                    </Button>
                  </section>

                  <div className="flex justify-between gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      Atrás
                    </Button>
                    <Button onClick={() => setStep(3)}>Siguiente</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && campaign && (
            <div className="space-y-4">
              <h3 className="font-medium">Revisión final</h3>
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <Row
                  label="Objetivo"
                  value={
                    campaign.campaign_objective === "MESSAGES"
                      ? "💬 Mensajes por WhatsApp"
                      : "📋 Formulario de leads"
                  }
                />
                <Row label="Nombre" value={campaign.name} />
                <Row label="Título" value={campaign.headline} />
                <Row label="Texto" value={campaign.primary_text} />
                <Row
                  label="Edades"
                  value={`${campaign.age_min} - ${campaign.age_max}`}
                />
                <Row
                  label="Géneros"
                  value={
                    hasMen && hasWomen
                      ? "Ambos"
                      : hasMen
                        ? "Hombres"
                        : hasWomen
                          ? "Mujeres"
                          : "—"
                  }
                />
                <Row
                  label="Presupuesto"
                  value={`MXN $${budgetMxn.toLocaleString("es-MX")}/día`}
                />
              </div>
              <div className="rounded-md border p-4 space-y-2">
                {campaign.image_url ? (
                  <img
                    src={campaign.image_url}
                    alt=""
                    className="rounded w-full max-h-48 object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin imagen disponible.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Se usará la imagen de portada de la propiedad.
                </p>
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Atrás
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => saveDraft(false)}
                    disabled={saving || publishing}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar borrador
                  </Button>
                  <Button onClick={publish} disabled={saving || publishing}>
                    {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Publicar en Meta
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}