import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PIPELINE_STAGES } from "./PipelineStepper";
import { usePipelineStageChange } from "@/hooks/usePipelineStageChange";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
  conversationId?: string;
  assignedAgentId?: string | null;
}

export function PipelineHeaderSelect({ contactId, currentStage, conversationId, assignedAgentId }: PipelineHeaderSelectProps) {
  const [localStage, setLocalStage] = useState(currentStage);
  const [isUpdating, setIsUpdating] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const { handlePipelineStageChange } = usePipelineStageChange();
  const queryClient = useQueryClient();
  const { user, tenantRole, isSuperAdmin } = useAuth();

  useEffect(() => {
    setLocalStage(currentStage);
  }, [currentStage]);

  const isClosed = localStage === 'closed_won';
  const isLost = localStage === 'closed_lost';

  const isAsesor = tenantRole === 'asesor' && !isSuperAdmin;
  const isUnassigned = !assignedAgentId;
  const isOwnedByOther = !!assignedAgentId && assignedAgentId !== user?.id;

  const performStageUpdate = async (newStage: string) => {
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
      
      // Log pipeline_stage_changed activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user?.id ?? '')
          .single();

        if (profile?.tenant_id) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv) {
            await supabase.from('conversation_activity').insert({
              tenant_id: profile.tenant_id,
              conversation_id: conv.id,
              contact_id: contactId,
              actor_user_id: user?.id ?? null,
              actor_type: 'user',
              event_type: 'pipeline_stage_changed',
              payload: {
                old_stage: oldStage,
                new_stage: newStage,
                old_label: PIPELINE_STAGES.find(s => s.value === oldStage)?.label,
                new_label: PIPELINE_STAGES.find(s => s.value === newStage)?.label,
              },
            });
          }
        }
      } catch (e) {
        console.warn('Failed to log pipeline_stage_changed activity:', e);
      }

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

  const handleChange = async (newStage: string) => {
    if (isUpdating || newStage === localStage) return;

    // Asesor trying to change a lead owned by another asesor → block
    if (isAsesor && isOwnedByOther) {
      toast.error("Este lead pertenece a otro asesor. Pídele que haga el cambio o escala a tu manager.");
      return;
    }

    // Asesor on unassigned lead → ask to claim first
    if (isAsesor && isUnassigned && conversationId) {
      setPendingStage(newStage);
      setClaimDialogOpen(true);
      return;
    }

    await performStageUpdate(newStage);
  };

  const handleConfirmClaim = async () => {
    if (!conversationId || !pendingStage) return;
    setClaimDialogOpen(false);
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.rpc('fn_claim_conversation', {
        p_conversation_id: conversationId,
        p_reason: 'manual_claim_pipeline_change',
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.success) {
        const code = row?.error_code || 'CLAIM_FAILED';
        if (code === 'ALREADY_ASSIGNED') {
          toast.error("Otro asesor tomó este lead primero.");
        } else {
          toast.error(`No se pudo tomar el lead (${code})`);
        }
        setIsUpdating(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['contact-pipeline', contactId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success("Lead asignado a ti");
    } catch (e) {
      console.error('claim error', e);
      toast.error("Error al tomar el lead");
      setIsUpdating(false);
      return;
    } finally {
      setIsUpdating(false);
    }
    // Now apply stage change
    const stage = pendingStage;
    setPendingStage(null);
    await performStageUpdate(stage);
  };

  const currentLabel = PIPELINE_STAGES.find(s => s.value === localStage)?.short || localStage;
  const currentIndex = PIPELINE_STAGES.findIndex(s => s.value === localStage);

  return (
    <>
    <Select value={localStage} onValueChange={handleChange} disabled={isUpdating}>
      <SelectTrigger 
        className={cn(
          "h-7 w-auto min-w-[120px] max-w-[160px] text-xs font-medium border-0 gap-1 px-2.5 rounded-full",
          isLost && "bg-destructive/15 text-destructive hover:bg-destructive/20",
          isClosed && "bg-green-500/15 text-green-400 hover:bg-green-500/20",
          !isClosed && !isLost && "bg-primary/15 text-primary hover:bg-primary/20"
        )}
        title={isAsesor && isOwnedByOther ? "Lead asignado a otro asesor" : undefined}
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

    <AlertDialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tomar este lead</AlertDialogTitle>
          <AlertDialogDescription>
            Este lead aún no tiene asesor asignado. Para cambiar la etapa a{" "}
            <strong>{PIPELINE_STAGES.find(s => s.value === pendingStage)?.label}</strong>{" "}
            primero se te asignará a ti. ¿Continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingStage(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmClaim}>Tomar y continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
