import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2, Pause, Play, Trash2, MoreHorizontal, ImageIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import type { MetaAdsCampaign } from "@/hooks/useMetaAdsCampaigns";
import type { CampaignInsights } from "@/hooks/useMetaAdsInsights";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<MetaAdsCampaign["status"], string> = {
  draft: "Borrador",
  review: "En revisión",
  publishing: "Publicando",
  active: "Activa",
  paused: "Pausada",
  error: "Error",
};

function statusClass(s: MetaAdsCampaign["status"]) {
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

export function CampaignsList({
  campaigns,
  canManage,
  insightsByCampaign,
}: {
  campaigns: MetaAdsCampaign[];
  canManage: boolean;
  insightsByCampaign?: Record<string, CampaignInsights | null>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const togglePause = async (c: MetaAdsCampaign) => {
    setPendingId(c.id);
    const action = c.status === "active" ? "pause" : "resume";
    const { data, error } = await supabase.functions.invoke(
      "ai-meta-campaign-builder",
      { body: { action, campaign_id: c.id } },
    );
    setPendingId(null);
    if (error || !data?.success) {
      const msg = error
        ? await extractEdgeFunctionError(error)
        : data?.error || "No se pudo actualizar la campaña";
      toast.error("Error", { description: msg });
      return;
    }
    toast.success(action === "pause" ? "Campaña pausada" : "Campaña reanudada");
    queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
  };

  const deleteDraft = async (id: string) => {
    const { error } = await supabase
      .from("meta_ads_campaigns")
      .delete()
      .eq("id", id);
    setDeleteId(null);
    if (error) {
      toast.error("No se pudo eliminar", { description: error.message });
      return;
    }
    toast.success("Borrador eliminado");
    queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
  };

  return (
    <>
      <div className="space-y-2">
        {campaigns.map((c) => {
          const cover =
            c.properties?.property_images?.find((i) => i.is_cover)?.file_url ??
            c.properties?.property_images?.[0]?.file_url ??
            c.image_url ??
            null;
          const budget = (c.daily_budget_cents ?? 0) / 100;
          const isPending = pendingId === c.id;
          const canPauseResume =
            canManage && (c.status === "active" || c.status === "paused");
          const canDelete =
            canManage && (c.status === "draft" || c.status === "review" || c.status === "error");
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/meta-ads/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/meta-ads/${c.id}`);
                }
              }}
              className="flex items-center gap-3 rounded-md border border-border p-3 bg-card cursor-pointer hover:bg-accent/40 transition-colors"
            >
              <div className="w-14 h-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {cover ? (
                  <img src={cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {c.campaign_objective === "MESSAGES" ? "💬 WhatsApp" : "📋 Formulario"}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", statusClass(c.status))}>
                    {c.status === "publishing" && (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    {STATUS_LABEL[c.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.properties?.title ?? "—"}
                  {c.properties?.zone ? ` · ${c.properties.zone}` : ""}
                </p>
                <div className="text-xs text-muted-foreground mt-0.5">
                  MXN ${budget.toLocaleString("es-MX")}/día
                  {c.published_at && (
                    <> · Publicada {new Date(c.published_at).toLocaleDateString("es-MX")}</>
                  )}
                </div>
                {c.meta_campaign_id &&
                  c.status === "active" &&
                  insightsByCampaign &&
                  (() => {
                    const ins = insightsByCampaign[c.id];
                    if (!ins) return null;
                    const result =
                      c.campaign_objective === "MESSAGES"
                        ? ins.messages_started
                        : ins.leads;
                    const resultLabel =
                      c.campaign_objective === "MESSAGES" ? "convs" : "leads";
                    return (
                      <p className="text-xs text-muted-foreground mt-1">
                        {ins.impressions.toLocaleString("es-MX")} impresiones ·{" "}
                        {result} {resultLabel} · $
                        {ins.spend.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN gastado
                      </p>
                    );
                  })()}
                {c.status === "error" && c.publish_error && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {c.publish_error}
                  </p>
                )}
              </div>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {canPauseResume && (
                      <DropdownMenuItem onClick={() => togglePause(c)}>
                        {c.status === "active" ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" /> Pausar
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" /> Reanudar
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteDraft(deleteId)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}