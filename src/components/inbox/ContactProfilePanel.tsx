import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, Clock, MessageSquare, Mail, Calendar, 
  Activity, Megaphone, StickyNote, Check, CheckCheck,
  ArrowDownLeft, ArrowUpRight, Bot, Ban, AlertCircle,
  Loader2, XCircle, Pencil, AlertTriangle, CheckCircle2,
  CalendarClock, RefreshCw, Building, DollarSign, Globe,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Conversation } from "@/hooks/useConversations";
import { useResolveNeedsHuman } from "@/hooks/useConversations";
import { useCampaignDeliveriesForContact, type CampaignDelivery } from "@/hooks/useCampaignDeliveries";
import { useAISettings } from "@/hooks/useAISettings";
import { useConversationFollowup, useCreateFollowup, useCompleteFollowup, useCancelFollowup, useRescheduleFollowup } from "@/hooks/useFollowups";
import { useConversationActivity } from "@/hooks/useConversationActivity";
import { useMarkAttended } from "@/hooks/useMarkAttended";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScheduleFollowupModal } from "./ScheduleFollowupModal";
import { FollowupCard } from "./FollowupCard";
import { MarkAttendedModal } from "./MarkAttendedModal";
import { CompleteFollowupModal } from "./CompleteFollowupModal";
import { PipelineStepper } from "./PipelineStepper";
import { PipelineSuggestionBadge } from "./PipelineSuggestionBadge";
import { ScheduleVisitModal } from "./ScheduleVisitModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProperties } from "@/hooks/useProperties";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContactProfilePanelProps {
  conversation: Conversation;
  onClose?: () => void;
}

interface ActivityEvent {
  id: string;
  type: 'inbound' | 'outbound' | 'campaign' | 'ai' | 'blocked' | 'window_expired' | 'followup_scheduled' | 'followup_completed' | 'followup_rescheduled' | 'human_marked_attended' | 'ai_escalated' | 'ai_reactivated';
  description: string;
  timestamp: string;
}

const SOURCE_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  instagram: {
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
    label: 'Instagram',
    className: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0',
  },
  facebook: {
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    label: 'Facebook',
    className: 'bg-blue-600 text-white border-0',
  },
  google_ads: {
    icon: <Globe className="h-3 w-3" />,
    label: 'Google Ads',
    className: 'bg-emerald-600 text-white border-0',
  },
  whatsapp: {
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    label: 'WhatsApp',
    className: 'bg-green-600 text-white border-0',
  },
  website: {
    icon: <Globe className="h-3 w-3" />,
    label: 'Sitio web',
    className: 'bg-muted text-muted-foreground',
  },
  referral: {
    icon: <User className="h-3 w-3" />,
    label: 'Referido',
    className: 'bg-muted text-muted-foreground',
  },
  tiktok: {
    icon: <Globe className="h-3 w-3" />,
    label: 'TikTok',
    className: 'bg-black text-white border-0',
  },
};

function SourceBadge({ source }: { source: string }) {
  const key = source.toLowerCase().replace(/[\s-]+/g, '_');
  const config = SOURCE_CONFIG[key];
  
  if (!config) {
    return (
      <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5">
        <Globe className="h-3 w-3" />
        {source}
      </Badge>
    );
  }

  return (
    <Badge className={cn("text-xs gap-1 px-2 py-0.5", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function ContactProfilePanel({ conversation, onClose }: ContactProfilePanelProps) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [contactName, setContactName] = useState(conversation.contact?.name || "");
  const [aiEnabled, setAiEnabled] = useState(conversation.ai_enabled ?? true);
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  const queryClient = useQueryClient();
  const contactId = conversation.contact?.id || null;
  const { data: campaignDeliveries = [], isLoading: isLoadingCampaigns, refetch: refetchDeliveries } = useCampaignDeliveriesForContact(contactId);
  
  // Fetch contact's pipeline stage and real estate info
  const { data: contactData } = useQuery({
    queryKey: ['contact-pipeline', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data } = await supabase
        .from('contacts')
        .select(`
          pipeline_stage,
          re_credit_type,
          re_credit_preapproved,
          re_property_interest_id,
          re_budget_estimated_mxn,
          source
        `)
        .eq('id', contactId)
        .single();
      return data;
    },
    enabled: !!contactId,
  });

  // Fetch property of interest if exists
  const { data: propertyOfInterest } = useQuery({
    queryKey: ['property-of-interest', contactData?.re_property_interest_id],
    queryFn: async () => {
      if (!contactData?.re_property_interest_id) return null;
      const { data } = await supabase
        .from('properties')
        .select('id, title, property_code, zone')
        .eq('id', contactData.re_property_interest_id)
        .single();
      return data;
    },
    enabled: !!contactData?.re_property_interest_id,
  });
  
  // Fetch active properties for the selector
  const { data: activeProperties = [], isLoading: isLoadingProperties } = useProperties();
  const filteredActiveProperties = activeProperties.filter(p => p.is_active);

  // Handler to update property of interest
  const [isUpdatingProperty, setIsUpdatingProperty] = useState(false);
  const handlePropertyInterestChange = async (propertyId: string) => {
    if (!contactId) return;
    setIsUpdatingProperty(true);
    try {
      const newValue = propertyId === "none" ? null : propertyId;
      const { error } = await supabase
        .from('contacts')
        .update({ re_property_interest_id: newValue })
        .eq('id', contactId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['contact-pipeline', contactId] });
      queryClient.invalidateQueries({ queryKey: ['property-of-interest'] });
      toast.success(newValue ? 'Propiedad de interés asignada' : 'Propiedad de interés removida');
    } catch (error) {
      console.error('Error updating property interest:', error);
      toast.error('Error al actualizar propiedad de interés');
    } finally {
      setIsUpdatingProperty(false);
    }
  };

  // Get global AI settings to check if AI is enabled at tenant level
  const { data: aiSettings, isLoading: isLoadingAISettings } = useAISettings();
  const isAiGloballyEnabled = aiSettings?.enabled === true;
  
  // Hook to resolve needs_human status
  const resolveNeedsHuman = useResolveNeedsHuman();
  
  // Hook to mark attended with activity
  const markAttended = useMarkAttended();
  const [showAttendedModal, setShowAttendedModal] = useState(false);
  
  // Followup hooks
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const { data: activeFollowup, isLoading: isLoadingFollowup } = useConversationFollowup(conversation.id);
  const createFollowup = useCreateFollowup();
  const completeFollowup = useCompleteFollowup();
  const cancelFollowup = useCancelFollowup();
  const rescheduleFollowup = useRescheduleFollowup();
  
  // Activity timeline
  const { data: activityEvents = [] } = useConversationActivity(conversation.id);
  
  const handleEditContact = () => {
    if (contactId) {
      navigate(`/contacts/${contactId}?from_conversation=${conversation.id}`);
    }
  };
  
  const handleScheduleFollowup = (data: { due_at: string; note: string }) => {
    if (!contactId) return;
    
    createFollowup.mutate(
      {
        conversation_id: conversation.id,
        contact_id: contactId,
        due_at: data.due_at,
        note: data.note || null,
      },
      {
        onSuccess: () => {
          toast.success('Seguimiento programado');
          setShowFollowupModal(false);
        },
        onError: () => {
          toast.error('Error al programar seguimiento');
        },
      }
    );
  };
  
  const handleCompleteFollowup = () => {
    if (!activeFollowup) return;
    completeFollowup.mutate(activeFollowup.id, {
      onSuccess: () => toast.success('Seguimiento completado'),
      onError: () => toast.error('Error al completar seguimiento'),
    });
  };
  
  const handleCancelFollowup = () => {
    if (!activeFollowup) return;
    cancelFollowup.mutate(activeFollowup.id, {
      onSuccess: () => toast.success('Seguimiento cancelado'),
      onError: () => toast.error('Error al cancelar seguimiento'),
    });
  };
  
  const handleRescheduleFollowup = (data: { newDueAt: string; note: string | null }) => {
    if (!activeFollowup) return;
    rescheduleFollowup.mutate(
      {
        followupId: activeFollowup.id,
        newDueAt: data.newDueAt,
        note: data.note,
      },
      {
        onSuccess: () => {
          toast.success('Seguimiento reagendado');
          setShowRescheduleModal(false);
        },
        onError: () => {
          toast.error('Error al reagendar seguimiento');
        },
      }
    );
  };

  // Sync AI enabled state when conversation changes
  useEffect(() => {
    setAiEnabled(conversation.ai_enabled ?? true);
  }, [conversation.ai_enabled]);

  const handleToggleAi = async (enabled: boolean) => {
    setIsTogglingAi(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ ai_enabled: enabled })
        .eq('id', conversation.id);

      if (error) throw error;

      setAiEnabled(enabled);
      toast.success(enabled ? 'IA activada para esta conversación' : 'IA desactivada para esta conversación');
    } catch (error) {
      console.error('Error toggling AI:', error);
      toast.error('Error al cambiar estado de IA');
    } finally {
      setIsTogglingAi(false);
    }
  };

  const handleResolveNeedsHuman = (reactivateAi: boolean) => {
    resolveNeedsHuman.mutate(
      { conversationId: conversation.id, reactivateAi },
      {
        onSuccess: () => {
          toast.success('IA reactivada');
        },
        onError: () => {
          toast.error('Error al reactivar IA');
        },
      }
    );
  };
  
  const handleMarkAttended = (data: { 
    note: string | null; 
    scheduleFollowup: boolean; 
    followupDueAt?: string;
    followupNote?: string;
  }) => {
    if (!contactId) return;
    
    // First mark as attended
    markAttended.mutate(
      {
        conversationId: conversation.id,
        contactId,
        note: data.note,
      },
      {
        onSuccess: () => {
          // If scheduling follow-up, create it after marking attended
          if (data.scheduleFollowup && data.followupDueAt) {
            createFollowup.mutate(
              {
                conversation_id: conversation.id,
                contact_id: contactId,
                due_at: data.followupDueAt,
                note: data.followupNote || null,
              },
              {
                onSuccess: () => {
                  toast.success('Conversación atendida y seguimiento programado');
                  setShowAttendedModal(false);
                },
                onError: () => {
                  toast.success('Conversación atendida');
                  toast.error('Error al programar seguimiento');
                  setShowAttendedModal(false);
                },
              }
            );
          } else {
            toast.success('Conversación marcada como atendida');
            setShowAttendedModal(false);
          }
        },
        onError: () => {
          toast.error('Error al marcar como atendida');
        },
      }
    );
  };

  // Subscribe to real-time updates for campaign_deliveries
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`campaign-deliveries-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_deliveries',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          refetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, refetchDeliveries]);

  const getInitials = (name: string | undefined) => {
    if (!name) return 'WA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Build activity from conversation data and activity events
  const activities: ActivityEvent[] = [];
  
  // Add conversation-based events
  if (conversation.last_customer_message_at) {
    activities.push({
      id: 'last-inbound',
      type: 'inbound',
      description: 'Último mensaje recibido',
      timestamp: conversation.last_customer_message_at,
    });
  }
  
  if (conversation.last_agent_message_at) {
    activities.push({
      id: 'last-outbound', 
      type: 'outbound',
      description: 'Último mensaje enviado',
      timestamp: conversation.last_agent_message_at,
    });
  }
  
  // Add activity events from conversation_activity
  activityEvents.forEach(event => {
    if (event.event_type === 'followup_scheduled') {
      activities.push({
        id: event.id,
        type: 'followup_scheduled',
        description: 'Seguimiento programado',
        timestamp: event.created_at,
      });
    } else if (event.event_type === 'followup_completed') {
      activities.push({
        id: event.id,
        type: 'followup_completed',
        description: 'Seguimiento completado',
        timestamp: event.created_at,
      });
    } else if (event.event_type === 'followup_rescheduled') {
      activities.push({
        id: event.id,
        type: 'followup_rescheduled',
        description: 'Seguimiento reagendado',
        timestamp: event.created_at,
      });
    } else if (event.event_type === 'human_marked_attended') {
      const payload = event.payload as Record<string, unknown> | null;
      activities.push({
        id: event.id,
        type: 'human_marked_attended',
        description: payload?.note ? `Atendido: ${payload.note}` : 'Marcado como atendido',
        timestamp: event.created_at,
      });
    } else if (event.event_type === 'ai_escalated') {
      activities.push({
        id: event.id,
        type: 'ai_escalated',
        description: 'Escalado a humano',
        timestamp: event.created_at,
      });
    } else if (event.event_type === 'ai_reactivated') {
      activities.push({
        id: event.id,
        type: 'ai_reactivated',
        description: 'IA reactivada',
        timestamp: event.created_at,
      });
    }
  });
  
  // Sort by timestamp descending and limit
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'inbound': return <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />;
      case 'outbound': return <ArrowUpRight className="h-3.5 w-3.5 text-primary" />;
      case 'campaign': return <Megaphone className="h-3.5 w-3.5 text-accent" />;
      case 'ai': return <Bot className="h-3.5 w-3.5 text-purple-500" />;
      case 'blocked': return <Ban className="h-3.5 w-3.5 text-destructive" />;
      case 'window_expired': return <AlertCircle className="h-3.5 w-3.5 text-warning" />;
      case 'followup_scheduled': return <CalendarClock className="h-3.5 w-3.5 text-primary" />;
      case 'followup_completed': return <Check className="h-3.5 w-3.5 text-green-500" />;
      case 'followup_rescheduled': return <RefreshCw className="h-3.5 w-3.5 text-primary" />;
      case 'human_marked_attended': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'ai_escalated': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'ai_reactivated': return <Bot className="h-3.5 w-3.5 text-purple-500" />;
      default: return <Activity className="h-3.5 w-3.5" />;
    }
  };

  const getCampaignStatusIcon = (status: CampaignDelivery['status']) => {
    switch (status) {
      case 'queued': return <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />;
      case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-accent" />;
      case 'failed': return <XCircle className="h-3 w-3 text-destructive" />;
      case 'skipped': return <AlertCircle className="h-3 w-3 text-warning" />;
      default: return null;
    }
  };

  const getCampaignStatusLabel = (status: CampaignDelivery['status']) => {
    switch (status) {
      case 'queued': return 'En cola';
      case 'sent': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'failed': return 'Fallido';
      case 'skipped': return 'Omitido';
      default: return status;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Close / Back button */}
        {onClose && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
        {/* Contact Header */}
        <div className="text-center">
          <Avatar className="w-16 h-16 mx-auto mb-3">
            <AvatarFallback className="bg-primary/20 text-primary text-xl">
              {getInitials(conversation.contact?.name)}
            </AvatarFallback>
          </Avatar>
          
          {isEditingName ? (
            <div className="flex items-center gap-2 justify-center mb-2">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-8 w-40 text-center text-sm"
                autoFocus
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              />
            </div>
          ) : (
            <h3 
              className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
              title="Click para editar"
            >
              {conversation.contact?.name || 'WhatsApp Lead'}
            </h3>
          )}
          
          <p className="text-sm text-muted-foreground">{conversation.customer_whatsapp}</p>
          
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge 
              variant={conversation.status === 'blocked' ? 'destructive' : 'secondary'}
            >
              {conversation.status === 'open' ? 'Activo' : 
               conversation.status === 'closed' ? 'Cerrado' : 'Bloqueado'}
            </Badge>
            
            {contactData?.source && (
              <SourceBadge source={contactData.source} />
            )}
          </div>

          {/* Edit Contact Button */}
          {contactId && (
           <div className="mt-3 flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleEditContact}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="flex-1">
                    Acciones
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowVisitModal(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar cita
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowFollowupModal(true)}>
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Programar seguimiento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* AI Pipeline Suggestion */}
        {contactId && (
          <PipelineSuggestionBadge conversationId={conversation.id} />
        )}

        {/* Needs Human Alert Section */}
        {conversation.needs_human && (
          <div className="space-y-3 overflow-hidden">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 p-3 overflow-hidden">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 truncate">Requiere atención humana</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300/80 break-words">
                    {conversation.ai_pause_reason === 'human_request' ? 'El cliente solicitó hablar con una persona.' :
                     conversation.ai_pause_reason === 'frustration' ? 'Se detectó frustración en el cliente.' :
                     conversation.ai_pause_reason === 'no_answer' ? 'La IA no encontró una respuesta adecuada.' :
                     conversation.ai_pause_reason === 'no_balance' ? 'Sin saldo disponible para responder.' :
                     conversation.ai_pause_reason === 'error' ? 'Ocurrió un error en el servicio de IA.' :
                     'Esta conversación requiere atención manual.'}
                  </p>
                </div>
              </div>

              {/* Actions: stack to avoid horizontal overflow in the sidebar */}
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-primary/30 hover:bg-primary/20 text-primary"
                  onClick={() => setShowFollowupModal(true)}
                  disabled={createFollowup.isPending}
                >
                  <CalendarClock className="h-3.5 w-3.5 mr-1" />
                  <span className="truncate">Programar seguimiento</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-amber-500/30 hover:bg-amber-500/20"
                  onClick={() => setShowAttendedModal(true)}
                  disabled={markAttended.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  <span className="truncate">Marcar atendido</span>
                </Button>

                {isAiGloballyEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-purple-500/30 hover:bg-purple-500/20 text-purple-300"
                    onClick={() => handleResolveNeedsHuman(true)}
                    disabled={resolveNeedsHuman.isPending}
                  >
                    <Bot className="h-3.5 w-3.5 mr-1" />
                    <span className="truncate">Reactivar IA</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Followup Card - Show when there's an active followup and NOT in human mode */}
        {!conversation.needs_human && activeFollowup && (
          <>
            <FollowupCard
              followup={activeFollowup}
              onComplete={handleCompleteFollowup}
              onReschedule={() => setShowRescheduleModal(true)}
              isLoading={completeFollowup.isPending || rescheduleFollowup.isPending}
            />
            <Separator />
          </>
        )}

        {/* AI Toggle Section - Only show when NOT in human mode */}
        {!(conversation.needs_human === true || conversation.ai_state === 'escalated') && (
          <>
            <Separator />
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                Asistente IA
              </h4>

              {!isAiGloballyEnabled ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-foreground">IA desactivada</span>
                    <p className="text-xs text-muted-foreground">
                      Actívala en Configuración para usar respuestas automáticas
                    </p>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-medium text-primary underline shrink-0"
                    onClick={() => navigate('/settings/ai-config')}
                  >
                    Activar IA
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="ai-toggle" className="text-sm font-medium cursor-pointer">
                      Respuestas automáticas
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {aiEnabled 
                        ? 'La IA responderá mensajes'
                        : 'Solo agentes humanos'}
                    </p>
                  </div>
                  <Switch
                    id="ai-toggle"
                    checked={aiEnabled}
                    onCheckedChange={handleToggleAi}
                    disabled={isTogglingAi}
                    className="data-[state=checked]:bg-purple-600"
                  />
                </div>
              )}
            </div>

            <Separator />
          </>
        )}

        {/* Basic Info Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Información
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teléfono</span>
              <span className="text-foreground font-mono text-xs">
                {conversation.customer_whatsapp}
              </span>
            </div>
            {conversation.contact?.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground text-xs truncate max-w-[150px]">
                  {conversation.contact.email}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creado</span>
              <span className="text-foreground">
                {format(new Date(conversation.created_at), 'dd MMM yyyy', { locale: es })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última interacción</span>
              <span className="text-foreground">
                {conversation.last_customer_message_at 
                  ? formatDistanceToNow(new Date(conversation.last_customer_message_at), { addSuffix: true, locale: es })
                  : 'Sin mensajes'}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Real Estate Context Section - Always visible for property assignment */}
        {contactId && (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Contexto inmobiliario
              </h4>
              <div className="space-y-3 text-sm">
                {/* Property Interest Selector */}
                <div>
                  <Select
                    value={contactData?.re_property_interest_id || "none"}
                    onValueChange={handlePropertyInterestChange}
                    disabled={isUpdatingProperty}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar propiedad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Sin propiedad asignada</span>
                      </SelectItem>
                      {isLoadingProperties ? (
                        <SelectItem value="loading" disabled>Cargando...</SelectItem>
                      ) : (
                        filteredActiveProperties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            <span className="font-medium">{property.property_code}</span>
                            <span className="text-muted-foreground ml-1">— {property.title}</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected property preview */}
                {propertyOfInterest && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                    <p className="font-medium text-foreground text-sm">{propertyOfInterest.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {propertyOfInterest.property_code}
                      </Badge>
                      <span>{propertyOfInterest.zone}</span>
                    </div>
                  </div>
                )}

                {contactData?.re_credit_type && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      Tipo de crédito
                    </span>
                    <Badge variant="secondary" className="font-medium">
                      {contactData.re_credit_type === 'INFONAVIT' ? 'Infonavit' :
                       contactData.re_credit_type === 'COFINAVIT' ? 'Cofinavit' :
                       contactData.re_credit_type === 'BANK' ? 'Bancario' :
                       contactData.re_credit_type === 'CASH' ? 'Contado' :
                       contactData.re_credit_type === 'FOVISSSTE' ? 'Fovissste' :
                       contactData.re_credit_type === 'ISFAM' ? 'ISFAM' :
                       contactData.re_credit_type === 'CFE' ? 'CFE' :
                       contactData.re_credit_type}
                    </Badge>
                  </div>
                )}
                {contactData?.re_credit_preapproved && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Crédito preaprobado</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Sí
                    </Badge>
                  </div>
                )}
                {contactData?.re_budget_estimated_mxn && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Presupuesto</span>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        maximumFractionDigits: 0,
                      }).format(contactData.re_budget_estimated_mxn)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Activity Timeline */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Actividad
          </h4>
          <div className="space-y-2">
            {activities.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30"
              >
                {getActivityIcon(activity.type)}
                <span className="flex-1 text-muted-foreground">{activity.description}</span>
                <span className="text-muted-foreground/60 shrink-0">
                  {format(new Date(activity.timestamp), 'HH:mm', { locale: es })}
                </span>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Sin actividad registrada
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Campaigns Section - Now using real data */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            Campañas
          </h4>
          <div className="space-y-2">
            {isLoadingCampaigns ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : campaignDeliveries.length > 0 ? (
              campaignDeliveries.map((delivery) => (
                <div 
                  key={delivery.id}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getCampaignStatusIcon(delivery.status)}
                    <span className="text-foreground truncate">
                      {delivery.campaign?.name || 'Campaña'}
                    </span>
                    <Badge 
                      variant={delivery.status === 'failed' ? 'destructive' : delivery.status === 'skipped' ? 'secondary' : 'outline'} 
                      className="text-[10px] px-1.5 py-0"
                    >
                      {getCampaignStatusLabel(delivery.status)}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground/60 shrink-0 ml-2">
                    {format(new Date(delivery.created_at), 'dd/MM HH:mm', { locale: es })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Sin campañas
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Internal Notes */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            Notas internas
          </h4>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agrega notas sobre este contacto..."
            className="min-h-[80px] text-sm resize-none bg-muted/30 border-muted"
          />
          <p className="text-xs text-muted-foreground">
            Solo visible para agentes
          </p>
        </div>
      </div>
      
      {/* Schedule Followup Modal */}
      <ScheduleFollowupModal
        open={showFollowupModal}
        onOpenChange={setShowFollowupModal}
        onSchedule={handleScheduleFollowup}
        isLoading={createFollowup.isPending}
      />
      
      {/* Mark Attended Modal */}
      <MarkAttendedModal
        open={showAttendedModal}
        onOpenChange={setShowAttendedModal}
        onConfirm={handleMarkAttended}
        isLoading={markAttended.isPending || createFollowup.isPending}
      />
      
      {/* Reschedule Followup Modal */}
      <CompleteFollowupModal
        open={showRescheduleModal}
        onOpenChange={setShowRescheduleModal}
        onComplete={handleCompleteFollowup}
        onReschedule={handleRescheduleFollowup}
        isLoading={completeFollowup.isPending || rescheduleFollowup.isPending}
      />

      {/* Schedule Visit Modal */}
      {contactId && (
        <ScheduleVisitModal
          open={showVisitModal}
          onOpenChange={setShowVisitModal}
          contactId={contactId}
          contactName={conversation.contact?.name || 'Contacto'}
          conversationId={conversation.id}
          propertyInterestId={contactData?.re_property_interest_id}
          contactCreditType={contactData?.re_credit_type}
        />
      )}
    </ScrollArea>
  );
}
