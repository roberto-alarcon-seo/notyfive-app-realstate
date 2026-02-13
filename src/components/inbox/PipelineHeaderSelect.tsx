import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PIPELINE_STAGES } from "./PipelineStepper";
import { usePipelineStageChange } from "@/hooks/usePipelineStageChange";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PipelineHeaderSelectProps {
  contactId: string;
  currentStage: string;
}

export function PipelineHeaderSelect({ contactId, currentStage }: PipelineHeaderSelectProps) {
  const [localStage, setLocalStage] = useState(currentStage);
  const [isUpdating, setIsUpdating] = useState(false);
  const { handlePipelineStageChange } = usePipelineStageChange();
  const queryClient = useQueryClient();

  useEffect(() => {
    setLocalStage(currentStage);
  }, [currentStage]);

  const isClosed = localStage === 'closed_won';
  const isLost = localStage === 'closed_lost';

  const handleChange = async (newStage: string) => {
    if (isUpdating || newStage === localStage) return;

    const oldStage = localStage;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ pipeline_stage: newStage })
        .eq('id', contactId);

      if (error) throw error;

      setLocalStage(newStage);
      await handlePipelineStageChange(contactId, oldStage, newStage);
      
      // Invalidate queries to sync UI
      queryClient.invalidateQueries({ queryKey: ['contact-pipeline', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      
      toast.success(`Etapa: ${PIPELINE_STAGES.find(s => s.value === newStage)?.label}`);
    } catch (error) {
      console.error('Error updating pipeline stage:', error);
      toast.error('Error al actualizar etapa');
    } finally {
      setIsUpdating(false);
    }
  };

  const currentLabel = PIPELINE_STAGES.find(s => s.value === localStage)?.short || localStage;
  const currentIndex = PIPELINE_STAGES.findIndex(s => s.value === localStage);

  return (
    <Select value={localStage} onValueChange={handleChange} disabled={isUpdating}>
      <SelectTrigger 
        className={cn(
          "h-7 w-auto min-w-[120px] max-w-[160px] text-xs font-medium border-0 gap-1 px-2.5 rounded-full",
          isLost && "bg-destructive/15 text-destructive hover:bg-destructive/20",
          isClosed && "bg-green-500/15 text-green-400 hover:bg-green-500/20",
          !isClosed && !isLost && "bg-primary/15 text-primary hover:bg-primary/20"
        )}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isLost ? "bg-destructive" : isClosed ? "bg-green-500" : "bg-primary"
        )} />
        <SelectValue>{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border z-50">
        {PIPELINE_STAGES.map((stage, index) => (
          <SelectItem 
            key={stage.value} 
            value={stage.value}
            className="text-xs"
          >
            <span className="flex items-center gap-2">
              <span className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                index < currentIndex && "bg-primary text-primary-foreground",
                index === currentIndex && "bg-primary text-primary-foreground ring-1 ring-primary/50",
                index > currentIndex && "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </span>
              {stage.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
