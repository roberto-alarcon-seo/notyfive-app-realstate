import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Pause,
  Play,
  Trash2,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { useMetaAdsCampaigns } from "@/hooks/useMetaAdsCampaigns";
import {
  useCampaignInsights,
  type DateRange,
} from "@/hooks/useMetaAdsInsights";
import { DateRangePicker } from "@/components/meta-ads/DateRangePicker";
import { InsightsCard } from "@/components/meta-ads/InsightsCard";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  review: "En revisión",
  publishing: "Publicando",
  active: "Activa",
  paused: "Pausada",
  error: "Error",
};

function statusClass(s: string) {
  switch (s) {
    case "active":
      return "bg-green-500/15 text-green-600 border-green-500/30";
    case "paused":
      return "bg-orange-500/15 text-orange-600 border-orange-500/30";
    case "publishing":
      return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "error":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function MetaAdsCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useMetaAdsCampaigns();
  const campaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) ?? null,
    [campaigns, campaignId],
  );
  const [dateRange, setDateRange] = useState<DateRange>({ preset: "last_7d" });
  const [pending, setPending] = useState<"pause" | "resume" | "delete" | null>(
    null,
  );

  const { data: insightsData, isLoading: loadingInsights } =
    useCampaignInsights(
      campaign?.meta_campaign_id ? campaignId ?? null : null,
      dateRange,
    );

  const runAction = async (action: "pause" | "resume") => {
    if (!campaign) return;
    setPending(action);
    const { data, error } = await supabase.functions.invoke(
      "ai-meta-campaign-builder",
      { body: { action, campaign_id: campaign.id } },
    );
    setPending(null);
    if (error || !data?.success) {
      const msg = error
        ? await extractEdgeFunctionError(error)
        : data?.error || "No se pudo actualizar la campaña";
      toast.error("Error", { description: msg });
      return;
    }
    toast.success(action === "pause" ? "Campaña pausada" : "Campaña reanudada");
    queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["meta-ads-insights"] });
  };

  const handleDelete = async () => {
    if (!campaign) return;
    setPending("delete");
    const { error } = await supabase
      .from("meta_ads_campaigns")
      .delete()
      .eq("id", campaign.id);
    setPending(null);
    if (error) {
      toast.error("No se pudo eliminar", { description: error.message });
      return;
    }
    toast.success("Borrador eliminado");
    queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
    navigate("/meta-ads");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/meta-ads")}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Campaña no encontrada.
          </CardContent>
        </Card>
      </div>
    );
  }

  const cover =
    campaign.properties?.property_images?.find((i) => i.is_cover)?.file_url ??
    campaign.properties?.property_images?.[0]?.file_url ??
    campaign.image_url ??
    null;
  const budget = (campaign.daily_budget_cents ?? 0) / 100;
  const isDraft =
    campaign.status === "draft" ||
    campaign.status === "review" ||
    campaign.status === "error";
  const insightsError = (insightsData as any)?.error as string | undefined;

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-5 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/meta-ads")}
          className="mb-3 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground truncate">
                {campaign.name}
              </h1>
              <Badge
                variant="outline"
                className={cn("text-xs", statusClass(campaign.status))}
              >
                {STATUS_LABEL[campaign.status] ?? campaign.status}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {campaign.campaign_objective === "MESSAGES"
                  ? "💬 WhatsApp"
                  : "📋 Formulario"}
              </Badge>
            </div>
            {campaign.properties?.title && (
              <p className="text-sm text-muted-foreground mt-1">
                {campaign.properties.title}
                {campaign.properties.zone ? ` · ${campaign.properties.zone}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {campaign.status === "active" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={!!pending}>
                    {pending === "pause" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    Pausar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Pausar campaña?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dejará de mostrarse y de generar gasto hasta que la reanudes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => runAction("pause")}>
                      Pausar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {campaign.status === "paused" && (
              <Button
                onClick={() => runAction("resume")}
                disabled={!!pending}
              >
                {pending === "resume" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Reanudar
              </Button>
            )}
            {isDraft && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={!!pending}>
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-semibold">Métricas</h2>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
            {!campaign.meta_campaign_id ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  La campaña aún no se publica en Meta. Las métricas estarán
                  disponibles cuando esté activa.
                </p>
              </Card>
            ) : insightsError ? (
              <Card className="p-6">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {insightsError}
                </p>
              </Card>
            ) : (
              <InsightsCard
                insights={insightsData?.insights ?? null}
                objective={campaign.campaign_objective}
                isLoading={loadingInsights}
              />
            )}
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Propiedad vinculada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {campaign.properties?.title ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {campaign.properties?.zone ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Copy del anuncio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Headline" value={campaign.headline} />
              <Field label="Texto principal" value={campaign.primary_text} />
              {campaign.description && (
                <Field label="Descripción" value={campaign.description} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audiencia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field
                label="Edad"
                value={`${campaign.age_min ?? "—"} - ${campaign.age_max ?? "—"}`}
              />
              <Field
                label="Géneros"
                value={
                  campaign.genders?.length
                    ? campaign.genders.join(", ")
                    : "Todos"
                }
              />
              <Field
                label="Ubicación"
                value={JSON.stringify(campaign.geo_locations ?? {}, null, 0)}
                mono
              />
              <Field
                label="Intereses"
                value={JSON.stringify(campaign.interests ?? [], null, 0)}
                mono
              />
              <Field
                label="Presupuesto diario"
                value={`$${budget.toLocaleString("es-MX")} MXN`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">IDs de Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              <Field label="Campaign" value={campaign.meta_campaign_id ?? "—"} mono />
              <Field label="Ad Set" value={campaign.meta_adset_id ?? "—"} mono />
              <Field label="Ad" value={campaign.meta_ad_id ?? "—"} mono />
              <Field label="Form" value={campaign.meta_form_id ?? "—"} mono />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
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
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-foreground text-right break-all",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}