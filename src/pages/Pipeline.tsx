import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Loader2, Users, 
  Calendar, TrendingUp, AlertTriangle,
  Filter, Search, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Contact } from "@/hooks/useContacts";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Pipeline stages configuration
const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'Nuevo lead', color: 'bg-slate-500' },
  { value: 'interest_confirmed', label: 'Interés confirmado', color: 'bg-blue-500' },
  { value: 'financial_validation', label: 'Validación financiera', color: 'bg-indigo-500' },
  { value: 'searching', label: 'Búsqueda activa', color: 'bg-purple-500' },
  { value: 'visit_done', label: 'Visita realizada', color: 'bg-pink-500' },
  { value: 'follow_up', label: 'Seguimiento', color: 'bg-orange-500' },
  { value: 'negotiation', label: 'Negociación', color: 'bg-amber-500' },
  { value: 'closed_won', label: 'Cerrado ✓', color: 'bg-green-500' },
  { value: 'closed_lost', label: 'Perdido', color: 'bg-red-500' },
];

// Temperature badge styles
const getTemperatureBadge = (temp: string) => {
  if (temp === 'hot') return { label: '🔥', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (temp === 'warm') return { label: '🌡️', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  return { label: '❄️', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
};

interface ContactCardProps {
  contact: Contact;
  onMoveToStage: (contactId: string, newStage: string) => void;
  onClick: () => void;
}

function ContactCard({ contact, onMoveToStage, onClick }: ContactCardProps) {
  const tempBadge = getTemperatureBadge(contact.lead_temperature);
  const hasBlockReason = !!contact.re_block_reason;
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div 
      className={cn(
        "group p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 cursor-pointer transition-all",
        "hover:shadow-md hover:border-primary/30",
        hasBlockReason && "border-l-2 border-l-amber-500"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {getInitials(contact.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{contact.name}</h4>
          <p className="text-xs text-muted-foreground truncate">
            {contact.phone || contact.email || 'Sin contacto'}
          </p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5", tempBadge.className)}>
          {tempBadge.label}
        </Badge>
      </div>

      {/* Metadata */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {contact.lead_score > 0 && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>Score: {contact.lead_score}</span>
          </div>
        )}
        {contact.last_interaction_at && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(contact.last_interaction_at), { addSuffix: true, locale: es })}
            </span>
          </div>
        )}
        {hasBlockReason && (
          <div className="flex items-center gap-1 text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            <span className="truncate">Bloqueado</span>
          </div>
        )}
      </div>

      {/* Quick actions on hover */}
      <div className="mt-2 pt-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Mover a:</span>
          <Select onValueChange={(value) => onMoveToStage(contact.id, value)}>
            <SelectTrigger className="h-6 w-24 text-[10px]">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value} className="text-xs">
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  stage: typeof PIPELINE_STAGES[0];
  contacts: Contact[];
  onMoveToStage: (contactId: string, newStage: string) => void;
  onContactClick: (contact: Contact) => void;
}

function KanbanColumn({ stage, contacts, onMoveToStage, onContactClick }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg border border-border/50">
      {/* Column Header */}
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", stage.color)} />
          <h3 className="font-medium text-sm">{stage.label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {contacts.length}
        </Badge>
      </div>
      
      {/* Column Content */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {contacts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Sin contactos
            </div>
          ) : (
            contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onMoveToStage={onMoveToStage}
                onClick={() => onContactClick(contact)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const tenantId = useEffectiveTenantId();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch contacts using react-query
  const { data: contacts = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['pipeline-contacts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Contact[];
    },
    enabled: !!tenantId,
  });

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let result = contacts.filter(c => c.status === 'active');
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
      );
    }
    
    if (temperatureFilter !== 'all') {
      result = result.filter(c => c.lead_temperature === temperatureFilter);
    }
    
    return result;
  }, [contacts, searchQuery, temperatureFilter]);

  // Group contacts by pipeline stage
  const contactsByStage = useMemo(() => {
    const grouped: Record<string, Contact[]> = {};
    PIPELINE_STAGES.forEach(stage => {
      grouped[stage.value] = [];
    });
    
    filteredContacts.forEach(contact => {
      const stage = contact.pipeline_stage || 'new_lead';
      if (grouped[stage]) {
        grouped[stage].push(contact);
      } else {
        grouped['new_lead'].push(contact);
      }
    });
    
    // Sort each stage by lead_score descending
    Object.keys(grouped).forEach(stage => {
      grouped[stage].sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
    });
    
    return grouped;
  }, [filteredContacts]);

  // Calculate totals
  const totalInPipeline = filteredContacts.filter(
    c => c.pipeline_stage !== 'closed_won' && c.pipeline_stage !== 'closed_lost'
  ).length;
  const totalClosed = filteredContacts.filter(c => c.pipeline_stage === 'closed_won').length;
  const totalLost = filteredContacts.filter(c => c.pipeline_stage === 'closed_lost').length;

  const handleMoveToStage = async (contactId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ pipeline_stage: newStage })
        .eq('id', contactId);

      if (error) throw error;
      
      toast.success('Etapa actualizada');
      refetch();
    } catch (error) {
      console.error('Error moving contact:', error);
      toast.error('Error al mover contacto');
    }
  };

  const handleContactClick = (contact: Contact) => {
    navigate(`/contacts/${contact.id}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Pipeline actualizado');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline de Ventas</h1>
            <p className="text-sm text-muted-foreground">
              Vista Kanban de tus leads por etapa
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{totalInPipeline}</strong> en proceso
            </span>
          </div>
          <div className="flex items-center gap-2 text-green-500">
            <span className="text-sm">
              <strong>{totalClosed}</strong> cerrados
            </span>
          </div>
          <div className="flex items-center gap-2 text-destructive">
            <span className="text-sm">
              <strong>{totalLost}</strong> perdidos
            </span>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contacto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="hot">🔥 Caliente</SelectItem>
              <SelectItem value="warm">🌡️ Tibio</SelectItem>
              <SelectItem value="cold">❄️ Frío</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-max h-full">
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.value}
              stage={stage}
              contacts={contactsByStage[stage.value] || []}
              onMoveToStage={handleMoveToStage}
              onContactClick={handleContactClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}