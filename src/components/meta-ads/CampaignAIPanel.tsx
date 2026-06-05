import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Loader2,
  Sparkles,
  Rocket,
  MessageCircle,
  ClipboardList,
  CheckCircle2,
  Lightbulb,
  Building2,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { cn } from "@/lib/utils";
import type { Property } from "@/hooks/useProperties";
import type { MetaAdsCampaign } from "@/hooks/useMetaAdsCampaigns";
import { useTenantContext } from "@/hooks/useTenantContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CopyVariant {
  headline: string;
  primary_text: string;
  description: string;
}

interface InterestItem {
  id: string;
  name: string;
}

interface CampaignAIPanelProps {
  open: boolean;
  property: Property | null;
  onClose: () => void;
}

const DEFAULT_RECOMMENDATIONS = [
  "Mantén el presupuesto diario al menos 7 días para que el algoritmo aprenda.",
  "Si después de 48h tienes pocos clics, ajusta el copy o la imagen.",
  "Responde rápido los primeros mensajes para mejorar tu calidad publicitaria.",
];

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

const AI_STEPS = [
  "Analizando características de la propiedad...",
  "Identificando audiencia ideal...",
  "Creando 3 variantes de copy...",
  "Calculando presupuesto óptimo...",
  "Generando recomendaciones...",
];

function AnimatedLoadingText() {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % AI_STEPS.length),
      1800,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <p
      key={idx}
      className="text-xs text-muted-foreground"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      {AI_STEPS[idx]}
    </p>
  );
}

export function CampaignAIPanel({ open, property, onClose }: CampaignAIPanelProps) {
  const queryClient = useQueryClient();
  const { data: tenant } = useTenantContext();

  const [objective, setObjective] = useState<"MESSAGES" | "LEAD_GENERATION">("MESSAGES");
  const [facebookPageId, setFacebookPageId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<MetaAdsCampaign | null>(null);
  const [copies, setCopies] = useState<CopyVariant[]>([]);
  const [selectedCopyIndex, setSelectedCopyIndex] = useState(0);
  const [editedHeadline, setEditedHeadline] = useState("");
  const [editedText, setEditedText] = useState("");
  const [budget, setBudget] = useState(350);
  const [ageMin, setAgeMin] = useState(28);
  const [ageMax, setAgeMax] = useState(60);
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [activeInterestIds, setActiveInterestIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [expandedCopyIdx, setExpandedCopyIdx] = useState<number | null>(null);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setObjective("MESSAGES");
      setFacebookPageId("");
      setGenerating(false);
      setGenerationError(null);
      setCampaign(null);
      setCopies([]);
      setSelectedCopyIndex(0);
      setEditedHeadline("");
      setEditedText("");
      setBudget(350);
      setAgeMin(28);
      setAgeMax(60);
      setInterests([]);
      setActiveInterestIds([]);
      setRecommendations([]);
      setPublishing(false);
      setSavingDraft(false);
      setPreviewExpanded(false);
    }
  }, [open]);

  // Auto-generate when opening or when objective changes
  useEffect(() => {
    if (!open || !property) return;
    let cancelled = false;

    const run = async () => {
      setGenerating(true);
      setGenerationError(null);
      setCampaign(null);
      try {
        const { data, error } = await supabase.functions.invoke(
          "ai-meta-campaign-builder",
          {
            body: {
              action: "generate",
              property_id: property.id,
              objective,
              facebook_page_id:
                objective === "MESSAGES" ? facebookPageId.trim() : null,
            },
          },
        );
        if (cancelled) return;
        if (error) {
          setGenerationError(await extractEdgeFunctionError(error));
          return;
        }
        if (!data?.campaign) {
          setGenerationError(data?.error ?? "Respuesta inválida");
          return;
        }
        const c = data.campaign as MetaAdsCampaign;
        const cps = (data.copies as CopyVariant[]) ?? [
          {
            headline: c.headline,
            primary_text: c.primary_text,
            description: c.description ?? "",
          },
        ];
        setCampaign(c);
        setCopies(cps);
        setSelectedCopyIndex(0);
        setEditedHeadline(cps[0]?.headline ?? "");
        setEditedText(cps[0]?.primary_text ?? "");
        setBudget(Math.round((c.daily_budget_cents ?? 35000) / 100));
        setAgeMin(c.age_min ?? 28);
        setAgeMax(c.age_max ?? 60);
        const ints = Array.isArray(c.interests) ? (c.interests as InterestItem[]) : [];
        setInterests(ints);
        setActiveInterestIds(ints.map((i) => i.id));
        setRecommendations(
          Array.isArray(data.recommendations) && data.recommendations.length > 0
            ? (data.recommendations as string[])
            : DEFAULT_RECOMMENDATIONS,
        );
      } catch (e) {
        if (cancelled) return;
        setGenerationError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property?.id, objective]);

  const coverImageUrl = useMemo(() => {
    if (!property) return null;
    return property.cover_image ?? null;
  }, [property]);

  const estimatedReach = Math.round(budget * 560);
  const estimatedLeads = Math.max(1, Math.round(budget * 0.2));
  const estimatedCPL = Math.round((budget / estimatedLeads) * 10) / 10;

  const toggleInterest = (id: string) => {
    setActiveInterestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectCopy = (i: number) => {
    setSelectedCopyIndex(i);
    setEditedHeadline(copies[i].headline);
    setEditedText(copies[i].primary_text);
  };

  const persistChanges = async (status?: MetaAdsCampaign["status"]) => {
    if (!campaign) return false;
    const selectedInterests = interests.filter((i) =>
      activeInterestIds.includes(i.id),
    );
    const payload: Record<string, unknown> = {
      headline: editedHeadline.slice(0, 40),
      primary_text: editedText.slice(0, 500),
      daily_budget_cents: budget * 100,
      age_min: ageMin,
      age_max: ageMax,
      facebook_page_id: facebookPageId.trim() || null,
      campaign_objective: objective,
      objective,
      interests: selectedInterests,
    };
    if (status) payload.status = status;
    const { error } = await supabase
      .from("meta_ads_campaigns")
      .update(payload)
      .eq("id", campaign.id);
    if (error) {
      toast.error("No se pudo guardar", { description: error.message });
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!campaign) return;
    setPublishing(true);
    try {
      const ok = await persistChanges();
      if (!ok) return;
      const { data, error } = await supabase.functions.invoke(
        "ai-meta-campaign-builder",
        { body: { action: "publish", campaign_id: campaign.id } },
      );
      if (error || !data?.success) {
        const msg = error
          ? await extractEdgeFunctionError(error)
          : data?.error || "Error al publicar";
        toast.error("Error al publicar", { description: msg });
        queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
        return;
      }
      toast.success("¡Campaña publicada en Meta Ads!");
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      onClose();
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    const ok = await persistChanges("draft");
    setSavingDraft(false);
    if (ok) {
      toast.success("Borrador guardado");
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      onClose();
    }
  };

  const missingPageId =
    objective === "MESSAGES" && facebookPageId.trim().length < 5;
  const canPublish = !!campaign && !missingPageId;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0 flex flex-col h-full"
      >
        <style>{`
          @keyframes campaignAIBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-8px); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Campaña Meta Ads con IA
              </SheetTitle>
              {property && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{property.title}</span>
                  {property.zone && (
                    <span className="shrink-0">· {property.zone}</span>
                  )}
                </div>
              )}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 relative"
                  aria-label="Configuración de campaña"
                >
                  <Settings2 className="h-4 w-4" />
                  {missingPageId && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de campaña</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setObjective("MESSAGES")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-md border text-sm transition-all flex items-center justify-center gap-1.5",
                        objective === "MESSAGES"
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setObjective("LEAD_GENERATION")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-md border text-sm transition-all flex items-center justify-center gap-1.5",
                        objective === "LEAD_GENERATION"
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Formulario
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {objective === "MESSAGES"
                      ? "El lead abre WhatsApp y la IA responde automáticamente."
                      : "Meta captura nombre, teléfono y email del lead."}
                  </p>
                </div>

                {objective === "MESSAGES" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fb-page" className="text-xs flex items-center gap-1">
                      ID de tu Página de Facebook
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fb-page"
                      value={facebookPageId}
                      onChange={(e) =>
                        setFacebookPageId(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="123456789012345"
                      className="h-9 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Requerido para publicar campañas de WhatsApp.{" "}
                      <a
                        href="https://developers.facebook.com/tools/explorer/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Obtener ID
                      </a>
                    </p>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {generationError ? (
            <div className="p-6">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {generationError}
              </div>
            </div>
          ) : generating && !campaign ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 px-6 py-16">
              <div className="flex items-end gap-2 h-8">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full bg-primary inline-block"
                    style={{
                      animation:
                        "campaignAIBounce 1.4s infinite ease-in-out both",
                      animationDelay: `${i * 0.16}s`,
                    }}
                  />
                ))}
              </div>
              <div className="text-center space-y-2 max-w-xs">
                <p className="text-sm font-medium text-foreground">
                  Generando tu campaña con IA
                </p>
                <AnimatedLoadingText />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 h-full lg:overflow-hidden">
              {/* LEFT COLUMN — Configuration (scrollable) */}
              <div className="lg:overflow-y-auto p-6 space-y-8">
                {/* Section A: Copies */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Copies generados</h3>
                  {copies.map((copy, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectCopy(i)}
                      className={cn(
                        "w-full text-left border rounded-xl p-4 cursor-pointer transition-all",
                        "hover:border-primary/50 hover:bg-primary/5",
                        selectedCopyIndex === i &&
                          "border-primary bg-primary/10 ring-1 ring-primary/20",
                      )}
                    >
                      <p className="text-sm font-semibold leading-snug">
                        {copy.headline}
                      </p>
                      <p
                        className={cn(
                          "text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line",
                          expandedCopyIdx !== i && "line-clamp-3",
                        )}
                      >
                        {copy.primary_text}
                      </p>
                      {copy.primary_text.length > 120 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCopyIdx(
                              expandedCopyIdx === i ? null : i,
                            );
                          }}
                          className="text-[10px] text-primary mt-1 hover:underline"
                        >
                          {expandedCopyIdx === i ? "Ver menos" : "Ver completo"}
                        </button>
                      )}
                    </button>
                  ))}

                  <div className="pt-4 mt-2 border-t-2 border-border space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Editar copy seleccionado
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label htmlFor="copy-headline" className="text-xs">
                          Título
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          {editedHeadline.length}/40
                        </span>
                      </div>
                      <Input
                        id="copy-headline"
                        value={editedHeadline}
                        maxLength={40}
                        onChange={(e) => setEditedHeadline(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label htmlFor="copy-text" className="text-xs">
                          Texto principal
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          {editedText.length}/500
                        </span>
                      </div>
                      <Textarea
                        id="copy-text"
                        value={editedText}
                        maxLength={500}
                        onChange={(e) => setEditedText(e.target.value)}
                        rows={7}
                        className="resize-none text-sm leading-relaxed whitespace-pre-line"
                      />
                    </div>
                  </div>
                </section>

                {/* Section B: Audience & budget */}
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">
                    Audiencia y presupuesto
                  </h3>

                  <div className="space-y-2">
                    <Label className="text-xs">Intereses</Label>
                    {interests.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Sin intereses sugeridos.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {interests.map((interest) => {
                          const active = activeInterestIds.includes(
                            interest.id,
                          );
                          return (
                            <button
                              key={interest.id}
                              type="button"
                              onClick={() => toggleInterest(interest.id)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-all",
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "text-muted-foreground border-border hover:bg-accent",
                              )}
                            >
                              {interest.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Rango de edad</Label>
                      <span className="text-xs text-muted-foreground">
                        {ageMin} – {ageMax} años
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="range"
                        min={18}
                        max={50}
                        value={ageMin}
                        onChange={(e) => setAgeMin(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <input
                        type="range"
                        min={40}
                        max={70}
                        value={ageMax}
                        onChange={(e) => setAgeMax(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Presupuesto diario</Label>
                      <span className="text-xs text-muted-foreground">
                        ${budget} MXN
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={1000}
                      step={50}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Inversión semanal estimada: $
                      {(budget * 7).toLocaleString("es-MX")} MXN
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <MetricCard
                      label="Alcance est."
                      value={estimatedReach.toLocaleString("es-MX")}
                    />
                    <MetricCard
                      label="Leads/sem"
                      value={`~${estimatedLeads}`}
                    />
                    <MetricCard label="CPL MXN" value={`$${estimatedCPL}`} />
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN — Preview + fixed launch footer */}
              <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-border lg:h-full lg:overflow-hidden">
                <div className="flex-1 lg:overflow-y-auto p-6 space-y-4">
                  <h3 className="text-sm font-semibold">Vista previa</h3>

                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="flex items-center gap-2 p-3 border-b border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {(tenant?.name ?? "Tu").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {tenant?.name ?? "Tu inmobiliaria"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Patrocinado
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <p
                        className={cn(
                          "text-xs leading-relaxed whitespace-pre-wrap",
                          !previewExpanded && "line-clamp-3",
                        )}
                      >
                        {editedText || "Texto del anuncio…"}
                      </p>
                      {editedText && editedText.length > 80 && (
                        <button
                          type="button"
                          onClick={() => setPreviewExpanded((v) => !v)}
                          className="text-[10px] text-primary mt-1 hover:underline"
                        >
                          {previewExpanded ? "Ver menos" : "Ver más"}
                        </button>
                      )}
                    </div>
                    {coverImageUrl ? (
                      <img
                        src={coverImageUrl}
                        alt=""
                        className="w-full aspect-video object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        Sin imagen
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 p-3 bg-muted/40">
                      <p className="text-sm font-semibold truncate">
                        {editedHeadline || "Título del anuncio"}
                      </p>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium shrink-0"
                      >
                        {objective === "MESSAGES"
                          ? "Enviar mensaje"
                          : "Más información"}
                      </button>
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-xs text-primary hover:underline w-full justify-center py-1"
                      >
                        <Lightbulb className="h-3.5 w-3.5" />
                        Ver recomendaciones IA (
                        {(recommendations.length > 0
                          ? recommendations
                          : DEFAULT_RECOMMENDATIONS
                        ).length}
                        )
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      side="top"
                      className="w-80"
                    >
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        Recomendaciones IA
                      </p>
                      <ul className="space-y-2">
                        {(recommendations.length > 0
                          ? recommendations
                          : DEFAULT_RECOMMENDATIONS
                        ).map((rec, i) => (
                          <li
                            key={i}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Fixed footer */}
                <div className="border-t border-border p-4 space-y-2 shrink-0 bg-background">
                  {missingPageId && campaign && (
                    <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                      <Settings2 className="h-3 w-3" />
                      Configura el ID de Página en ⚙ antes de publicar
                    </p>
                  )}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      if (missingPageId) {
                        toast.error(
                          "Configura el ID de tu Página de Facebook en el engrane ⚙ antes de publicar.",
                        );
                        return;
                      }
                      handlePublish();
                    }}
                    disabled={!canPublish || publishing}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Lanzar en Meta Ads
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || !campaign}
                  >
                    {savingDraft ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar como borrador"
                    )}
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