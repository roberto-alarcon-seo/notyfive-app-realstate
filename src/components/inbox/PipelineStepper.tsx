import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePipelineStageChange } from "@/hooks/usePipelineStageChange";

// Pipeline stages with labels and short labels
const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'Nuevo lead', short: 'Nuevo' },
  { value: 'interest_confirmed', label: 'Interés confirmado', short: 'Interés' },
  { value: 'financial_validation', label: 'Validación financiera', short: 'Finanzas' },
  { value: 'searching', label: 'En búsqueda', short: 'Búsqueda' },
  { value: 'visit_scheduled', label: 'Visita agendada', short: 'Agendada' },
  { value: 'visit_done', label: 'Visita realizada', short: 'Visita' },
  { value: 'follow_up', label: 'Seguimiento', short: 'Seguimiento' },
  { value: 'negotiation', label: 'Oferta / Negociación', short: 'Negociación' },
  { value: 'closed_won', label: 'Cerrado', short: 'Cerrado' },
  { value: 'closed_lost', label: 'Perdido', short: 'Perdido' },
];

interface PipelineStepperProps {
  contactId: string;
  currentStage: string;
  onStageChange?: (newStage: string) => void;
  compact?: boolean;
}

export function PipelineStepper({ 
  contactId, 
  currentStage, 
  onStageChange,
  compact = false 
}: PipelineStepperProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localStage, setLocalStage] = useState(currentStage);
  const { handlePipelineStageChange } = usePipelineStageChange();

  // Sync local state when prop changes (e.g. from accepted AI suggestion)
  useEffect(() => {
    setLocalStage(currentStage);
  }, [currentStage]);

  const currentIndex = PIPELINE_STAGES.findIndex(s => s.value === localStage);
  
  // For display purposes, closed_won and closed_lost are both at the end
  const getDisplayIndex = (stageValue: string) => {
    const idx = PIPELINE_STAGES.findIndex(s => s.value === stageValue);
    // Both closed stages count as the final step
    if (stageValue === 'closed_won' || stageValue === 'closed_lost') {
      return 8; // Index of closed stages for progress calculation
    }
    return idx;
  };

  const displayCurrentIndex = getDisplayIndex(localStage);
  const isClosed = localStage === 'closed_won' || localStage === 'closed_lost';
  const isLost = localStage === 'closed_lost';

  const handleStageClick = async (stageValue: string) => {
    if (isUpdating || stageValue === localStage) return;

    const oldStage = localStage;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ pipeline_stage: stageValue })
        .eq('id', contactId);

      if (error) throw error;

      setLocalStage(stageValue);
      onStageChange?.(stageValue);
      
      // Trigger conversion tracking and Meta events
      await handlePipelineStageChange(contactId, oldStage, stageValue);
      
      toast.success(`Etapa actualizada: ${PIPELINE_STAGES.find(s => s.value === stageValue)?.label}`);
    } catch (error) {
      console.error('Error updating pipeline stage:', error);
      toast.error('Error al actualizar etapa');
    } finally {
      setIsUpdating(false);
    }
  };

  // Compact mode: shows only a horizontal progress bar with current stage
  if (compact) {
    const progressPercent = Math.round((displayCurrentIndex / 8) * 100);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pipeline</span>
          <span className={cn(
            "font-medium",
            isLost ? "text-destructive" : isClosed ? "text-green-500" : "text-foreground"
          )}>
            {PIPELINE_STAGES.find(s => s.value === localStage)?.label}
          </span>
        </div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
              isLost ? "bg-destructive" : isClosed ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Full mode: clickable stepper
  // We'll show stages 0-8 (first 9, excluding closed_lost from display but handling it)
  const displayStages = PIPELINE_STAGES.slice(0, 9); // Show all except closed_lost in stepper

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Etapa del pipeline</span>
        {isUpdating && <span className="text-primary text-xs">Actualizando...</span>}
      </div>
      
      {/* Stepper */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted" />
        <div 
          className={cn(
            "absolute top-3 left-3 h-0.5 transition-all duration-300",
            isLost ? "bg-destructive" : "bg-primary"
          )}
          style={{ 
            width: `calc(${(Math.min(displayCurrentIndex, 8) / 8) * 100}% - 12px)` 
          }}
        />
        
        {/* Steps */}
        <div className="relative flex justify-between">
          {displayStages.map((stage, index) => {
            const isCompleted = index < displayCurrentIndex;
            const isCurrent = stage.value === localStage || 
              (isLost && stage.value === 'closed_won'); // Show closed_won as current if lost
            const isClickable = !isUpdating;
            
            return (
              <Tooltip key={stage.value} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleStageClick(stage.value)}
                    disabled={!isClickable}
                    className={cn(
                      "relative flex flex-col items-center group transition-all",
                      isClickable && "cursor-pointer",
                      !isClickable && "cursor-not-allowed"
                    )}
                  >
                    {/* Circle indicator */}
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all border-2",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && !isLost && "bg-primary border-primary text-primary-foreground ring-2 ring-primary/30",
                      isCurrent && isLost && "bg-destructive border-destructive text-destructive-foreground ring-2 ring-destructive/30",
                      !isCompleted && !isCurrent && "bg-background border-muted-foreground/30 text-muted-foreground",
                      isClickable && !isCurrent && "group-hover:border-primary/50 group-hover:scale-110"
                    )}>
                      {isCompleted ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="text-[10px]">{index + 1}</span>
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {stage.label}
                  {stage.value === 'closed_won' && isLost && (
                    <span className="block text-destructive">(Actualmente: Perdido)</span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Current stage label */}
      <div className="text-center">
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          isLost ? "bg-destructive/20 text-destructive" : 
          isClosed ? "bg-green-500/20 text-green-500" : 
          "bg-primary/20 text-primary"
        )}>
          {PIPELINE_STAGES.find(s => s.value === localStage)?.label}
        </span>
      </div>

      {/* Quick action for lost */}
      {!isLost && !isClosed && (
        <button
          onClick={() => handleStageClick('closed_lost')}
          disabled={isUpdating}
          className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
        >
          Marcar como perdido
        </button>
      )}
    </div>
  );
}