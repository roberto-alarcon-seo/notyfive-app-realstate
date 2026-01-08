import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SegmentProposal {
  name: string;
  description: string;
  rules: { field: string; operator: string; value: string }[];
  estimatedCount: number;
  saturationRisk: 'bajo' | 'medio' | 'alto';
  recommended: boolean;
}

export interface CopyProposal {
  id: string;
  segmentName: string;
  content: string;
  main: string; // Deprecated: use content instead
  intent: 'conversacional' | 'urgencia' | 'beneficio';
  recommended: boolean;
  recommendation_reason?: string;
  requiresTemplate: boolean;
  templateSuggestion?: string;
  editedByUser?: boolean;
}

export interface MediaAttachment {
  type: 'image' | 'video';
  url: string;
  filename?: string;
  mimeType?: string;
}

export interface CampaignProposal {
  phase: 'proposal' | 'update_copy';
  segments: SegmentProposal[];
  copies: CopyProposal[];
  validation: {
    whatsappCompliant: boolean;
    cooldownRespected: boolean;
    notes: string[];
  };
  message: string;
  copyUpdate?: {
    accion: string;
    copy_id: string;
    nuevo_contenido: string;
    cambios: {
      tipo: string;
      descripcion: string;
    };
  };
}

export interface CampaignContext {
  objective?: string;
  clientType?: string;
  timePeriod?: string;
  promotionType?: string;
  promotionDetails?: string; // e.g. "25% descuento en corte de pelo"
  tone?: string;
  urgency?: string;
}

interface DataStats {
  totalContacts: number;
  segmentsCount: number;
  templatesCount: number;
  campaignsCount: number;
}

export type UiPhase = 'discovery' | 'generation' | 'proposal_partial' | 'ready' | 'update_copy';

export function useCampaignCopilot() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<CampaignContext>({});
  const [proposal, setProposal] = useState<CampaignProposal | null>(null);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<SegmentProposal | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<CopyProposal | null>(null);

  // Derived state: check if context has enough info
  const contextComplete = Boolean(
    context.objective && context.clientType
  );

  // Derived UI phase with proposal_partial support
  const uiPhase: UiPhase = (() => {
    if (isLoading) return 'generation';
    if (proposal?.phase === 'update_copy') return 'update_copy';
    if (proposal && !contextComplete) return 'proposal_partial';
    if (proposal && contextComplete) return 'ready';
    return 'discovery';
  })();

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!profile?.tenant_id || !userMessage.trim()) return;

    const newUserMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Build conversation history for API
      const conversationHistory = [...messages, newUserMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Extract context from user message
      const updatedContext = extractContextFromMessage(userMessage, context);
      setContext(updatedContext);

      const { data, error } = await supabase.functions.invoke('ai-campaign-copilot', {
        body: {
          tenant_id: profile.tenant_id,
          messages: conversationHistory,
          context: updatedContext,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error === 'rate_limit') {
          toast.error('Límite de solicitudes excedido', { description: 'Por favor, espera un momento e intenta de nuevo.' });
        } else if (data.error === 'payment_required') {
          toast.error('Créditos de IA agotados', { description: 'Contacta al administrador para recargar.' });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      const assistantMessage: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.proposal) {
        if (data.proposal.phase === 'update_copy' && data.proposal.copyUpdate) {
          // Update existing copy in the current proposal
          setProposal(prev => {
            if (!prev) return prev;
            const updatedCopies = prev.copies.map((copy, index) => {
              // Match by copy_id or index
              if (`copy_${index + 1}` === data.proposal.copyUpdate.copy_id || index === 0) {
                return {
                  ...copy,
                  main: data.proposal.copyUpdate.nuevo_contenido,
                };
              }
              return copy;
            });
            return { ...prev, copies: updatedCopies };
          });
        } else {
          setProposal(data.proposal);
        }
      }

      if (data.dataStats) {
        setDataStats(data.dataStats);
      }

    } catch (err) {
      console.error('Copilot error:', err);
      toast.error('Error al comunicarse con el copiloto', { 
        description: err instanceof Error ? err.message : 'Error desconocido' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, messages, context]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setContext({});
    setProposal(null);
    setSelectedSegment(null);
    setSelectedCopy(null);
  }, []);

  const selectSegment = useCallback((segment: SegmentProposal) => {
    setSelectedSegment(segment);
  }, []);

  const selectCopy = useCallback((copy: CopyProposal) => {
    setSelectedCopy(copy);
  }, []);

  return {
    messages,
    isLoading,
    context,
    proposal,
    dataStats,
    selectedSegment,
    selectedCopy,
    uiPhase,
    contextComplete,
    sendMessage,
    resetConversation,
    selectSegment,
    selectCopy,
    setContext,
  };
}

// Helper to extract campaign context from user messages
function extractContextFromMessage(message: string, currentContext: CampaignContext): CampaignContext {
  const lowerMessage = message.toLowerCase();
  const newContext = { ...currentContext };

  // Objective detection
  if (lowerMessage.includes('vender') || lowerMessage.includes('promoción') || lowerMessage.includes('promocion') || lowerMessage.includes('oferta')) {
    newContext.objective = 'venta';
  } else if (lowerMessage.includes('informar') || lowerMessage.includes('notificar') || lowerMessage.includes('comunicar')) {
    newContext.objective = 'informativo';
  } else if (lowerMessage.includes('reactivar') || lowerMessage.includes('inactivo') || lowerMessage.includes('recuperar')) {
    newContext.objective = 'reactivacion';
  } else if (lowerMessage.includes('recordar') || lowerMessage.includes('recordatorio') || lowerMessage.includes('pago')) {
    newContext.objective = 'recordatorio';
  }

  // Client type detection
  if (lowerMessage.includes('vip') || lowerMessage.includes('premium')) {
    newContext.clientType = 'vip';
  } else if (lowerMessage.includes('nuevo') || lowerMessage.includes('lead')) {
    newContext.clientType = 'nuevos';
  } else if (lowerMessage.includes('inactivo') || lowerMessage.includes('dormido')) {
    newContext.clientType = 'inactivos';
  } else if (lowerMessage.includes('moroso') || lowerMessage.includes('deuda')) {
    newContext.clientType = 'morosos';
  } else if (lowerMessage.includes('todos') || lowerMessage.includes('general')) {
    newContext.clientType = 'todos';
  }

  // Time period detection
  if (lowerMessage.includes('navidad') || lowerMessage.includes('diciembre')) {
    newContext.timePeriod = 'navidad';
  } else if (lowerMessage.includes('año nuevo') || lowerMessage.includes('enero')) {
    newContext.timePeriod = 'ano_nuevo';
  } else if (lowerMessage.includes('buen fin') || lowerMessage.includes('black friday')) {
    newContext.timePeriod = 'temporada_ofertas';
  } else if (lowerMessage.includes('urgente') || lowerMessage.includes('inmediato') || lowerMessage.includes('hoy')) {
    newContext.timePeriod = 'inmediato';
  }

  // Tone detection
  if (lowerMessage.includes('formal') || lowerMessage.includes('profesional')) {
    newContext.tone = 'formal';
  } else if (lowerMessage.includes('casual') || lowerMessage.includes('amigable') || lowerMessage.includes('cercano')) {
    newContext.tone = 'casual';
  } else if (lowerMessage.includes('urgente') || lowerMessage.includes('importante')) {
    newContext.tone = 'urgente';
  }

  // Urgency detection
  if (lowerMessage.includes('urgente') || lowerMessage.includes('ya') || lowerMessage.includes('hoy') || lowerMessage.includes('inmediato')) {
    newContext.urgency = 'alta';
  } else if (lowerMessage.includes('próxima semana') || lowerMessage.includes('pronto')) {
    newContext.urgency = 'media';
  } else if (lowerMessage.includes('cuando pueda') || lowerMessage.includes('sin prisa')) {
    newContext.urgency = 'baja';
  }

  // Promotion type and details detection
  if (lowerMessage.includes('descuento') || lowerMessage.includes('oferta') || lowerMessage.includes('promoción')) {
    newContext.promotionType = 'promocional';
    
    // Extract specific discount percentage
    const discountMatch = message.match(/(\d+)\s*%/);
    if (discountMatch) {
      newContext.promotionDetails = `${discountMatch[1]}% de descuento`;
    }
    
    // Extract specific service/product mentioned with discount
    const serviceMatch = message.match(/(?:descuento|oferta|promoción)\s+(?:en|de|para)\s+([^,.]+)/i);
    if (serviceMatch) {
      newContext.promotionDetails = newContext.promotionDetails 
        ? `${newContext.promotionDetails} en ${serviceMatch[1].trim()}`
        : serviceMatch[1].trim();
    }
  } else if (lowerMessage.includes('información') || lowerMessage.includes('aviso') || lowerMessage.includes('noticia')) {
    newContext.promotionType = 'informativo';
  }

  return newContext;
}
