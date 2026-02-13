import { Sparkles, Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  usePipelineSuggestion, 
  useAcceptPipelineSuggestion, 
  useDismissPipelineSuggestion 
} from "@/hooks/usePipelineSuggestion";

const PIPELINE_LABELS: Record<string, string> = {
  new_lead: 'Nuevo lead',
  interest_confirmed: 'Interés confirmado',
  financial_validation: 'Validación financiera',
  searching: 'En búsqueda',
  visit_done: 'Visita realizada',
  follow_up: 'Seguimiento',
  negotiation: 'Negociación',
  closed_won: 'Cerrado',
  closed_lost: 'Perdido',
};

interface PipelineSuggestionBadgeProps {
  conversationId: string;
}

export function PipelineSuggestionBadge({ conversationId }: PipelineSuggestionBadgeProps) {
  const { data: suggestion } = usePipelineSuggestion(conversationId);
  const acceptMutation = useAcceptPipelineSuggestion();
  const dismissMutation = useDismissPipelineSuggestion();

  if (!suggestion) return null;

  const handleAccept = () => {
    acceptMutation.mutate(
      { suggestion },
      {
        onSuccess: () => {
          toast.success(`Etapa actualizada a: ${PIPELINE_LABELS[suggestion.suggested_stage] || suggestion.suggested_stage}`);
        },
        onError: () => toast.error('Error al actualizar etapa'),
      }
    );
  };

  const handleDismiss = () => {
    dismissMutation.mutate(
      { suggestionId: suggestion.id },
      {
        onSuccess: () => toast.info('Sugerencia descartada'),
        onError: () => toast.error('Error al descartar'),
      }
    );
  };

  const isLoading = acceptMutation.isPending || dismissMutation.isPending;
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary">
            Sugerencia de IA
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
              {confidencePercent}% confianza
            </span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-muted-foreground truncate">
              {PIPELINE_LABELS[suggestion.current_stage] || suggestion.current_stage}
            </span>
            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-foreground truncate">
              {PIPELINE_LABELS[suggestion.suggested_stage] || suggestion.suggested_stage}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
            {suggestion.reasoning}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1"
          onClick={handleAccept}
          disabled={isLoading}
        >
          <Check className="h-3 w-3 mr-1" />
          Aceptar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={handleDismiss}
          disabled={isLoading}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
