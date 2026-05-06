import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Search, Clock, MessageSquare, Loader2, Ban, Check, CheckCheck, XCircle, Copy, Info, Megaphone, Bot, Archive, Trash2, UserX, AlertTriangle, ArrowLeft, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useConversations, useMarkConversationAsRead, useDeleteConversation, useArchiveContact, type Conversation, type Message } from "@/hooks/useConversations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePaginatedMessages } from "@/hooks/usePaginatedMessages";
import { formatDistanceToNow, format, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { MessageComposer } from "@/components/inbox/MessageComposer";
import { ContactProfilePanel } from "@/components/inbox/ContactProfilePanel";
import { MessageMediaRenderer } from "@/components/inbox/MessageMediaRenderer";
import { DateSeparator } from "@/components/inbox/DateSeparator";
import { PipelineHeaderSelect } from "@/components/inbox/PipelineHeaderSelect";
import { toast } from "sonner";
import { useNewLeadSound } from "@/hooks/useNewLeadSound";
import { useAuth } from "@/contexts/AuthContext";
import { useAllAssignableMembers } from "@/hooks/useAssignmentRules";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { profile, tenantRole, isSuperAdmin } = useAuth();
  const isManagerOrAdmin =
    isSuperAdmin || ["manager", "administrador"].includes(tenantRole || "");
  const { data: members = [] } = useAllAssignableMembers();
  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );
  const [inboxTab, setInboxTab] = useState<"mine" | "unassigned" | "team">(
    isManagerOrAdmin ? "team" : "mine",
  );

  // Play notification sound on new inbound messages
  useNewLeadSound();
  // Clear PWA badge when opening inbox (if supported)
  useEffect(() => {
    if ("clearAppBadge" in navigator) {
      (navigator as any).clearAppBadge?.().catch?.(() => {});
    }
  }, []);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNeedsHuman, setFilterNeedsHuman] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'profile'>('list');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const isLoadingMoreRef = useRef(false);

  // Paginated messages hook
  const { 
    messages, 
    isLoading: messagesLoading, 
    isLoadingMore, 
    hasMore, 
    loadMore 
  } = usePaginatedMessages(selectedConversation?.id || null);
  
  const markAsRead = useMarkConversationAsRead();
  const deleteConversation = useDeleteConversation();
  const archiveContact = useArchiveContact();
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch pipeline stage for header select
  const selectedContactId = selectedConversation?.contact_id || null;
  const { data: headerContactData } = useQuery({
    queryKey: ['contact-pipeline', selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return null;
      const { data } = await supabase
        .from('contacts')
        .select('pipeline_stage, assigned_agent_id')
        .eq('id', selectedContactId)
        .single();
      return data;
    },
    enabled: !!selectedContactId,
  });
  const [archiveContactDialogOpen, setArchiveContactDialogOpen] = useState(false);
  const [targetConversation, setTargetConversation] = useState<Conversation | null>(null);

  const handleDeleteConversation = (conv: Conversation) => {
    setTargetConversation(conv);
    setDeleteDialogOpen(true);
  };

  const handleArchiveContact = (conv: Conversation) => {
    setTargetConversation(conv);
    setArchiveContactDialogOpen(true);
  };

  const confirmDeleteConversation = () => {
    if (targetConversation) {
      deleteConversation.mutate(targetConversation.id, {
        onSuccess: () => {
          toast.success('Conversación eliminada');
          if (selectedConversation?.id === targetConversation.id) {
            setSelectedConversation(null);
          }
        },
        onError: () => toast.error('Error al eliminar conversación'),
      });
    }
    setDeleteDialogOpen(false);
    setTargetConversation(null);
  };

  const confirmArchiveContact = () => {
    if (targetConversation?.contact_id) {
      archiveContact.mutate(targetConversation.contact_id, {
        onSuccess: () => {
          toast.success('Contacto archivado');
          if (selectedConversation?.id === targetConversation.id) {
            setSelectedConversation(null);
          }
        },
        onError: () => toast.error('Error al archivar contacto'),
      });
    }
    setArchiveContactDialogOpen(false);
    setTargetConversation(null);
  };

  // Check if user is at bottom of scroll and handle lazy load
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const threshold = 100;
    const isBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    setIsAtBottom(isBottom);

    // Lazy load: detect scroll near top
    const scrollTopThreshold = 50;
    if (element.scrollTop <= scrollTopThreshold && hasMore && !isLoadingMore && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      previousScrollHeightRef.current = element.scrollHeight;
      
      loadMore().finally(() => {
        isLoadingMoreRef.current = false;
      });
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // Maintain scroll position after loading more messages
  useEffect(() => {
    if (!isLoadingMore && previousScrollHeightRef.current > 0 && scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const newScrollHeight = viewport.scrollHeight;
        const scrollDiff = newScrollHeight - previousScrollHeightRef.current;
        viewport.scrollTop = scrollDiff;
        previousScrollHeightRef.current = 0;
      }
    }
  }, [isLoadingMore, messages.length]);

  // Scroll to bottom on initial load
  const initialScrollDoneRef = useRef<string | null>(null);
  
  useEffect(() => {
    // When messages finish loading for a new conversation, scroll to bottom
    if (!messagesLoading && messages.length > 0 && selectedConversation?.id) {
      // Only do initial scroll once per conversation
      if (initialScrollDoneRef.current !== selectedConversation.id) {
        initialScrollDoneRef.current = selectedConversation.id;
        // Use a small delay to ensure DOM is updated
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
          setIsAtBottom(true);
        }, 100);
      }
    }
  }, [messagesLoading, messages.length, selectedConversation?.id]);

  // Auto-scroll for new messages only if at bottom
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current && !isLoadingMore && !messagesLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isAtBottom, isLoadingMore]);

  // On mobile, reset to list view when navigating to /inbox
  const resetKey = (location.state as any)?.resetKey;
  useEffect(() => {
    if (isMobile) {
      const hasConversationParam = searchParams.get('conversation');
      const hasContactParam = searchParams.get('contact_id');
      if (!hasConversationParam && !hasContactParam) {
        setMobileView('list');
        setSelectedConversation(null);
      }
    }
  }, [resetKey]); // Re-runs when resetKey changes (menu re-click)

  // Handle conversation selection: query params or auto-select first
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;
    
    const conversationId = searchParams.get('conversation');
    const contactId = searchParams.get('contact_id');
    
    if (conversationId) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
        if (isMobile) setMobileView('chat');
      }
      searchParams.delete('conversation');
      setSearchParams(searchParams, { replace: true });
    } else if (contactId) {
      const conv = conversations.find(c => c.contact_id === contactId);
      if (conv) {
        setSelectedConversation(conv);
        if (isMobile) setMobileView('chat');
      } else {
        // Create conversation for this contact
        (async () => {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id, phone, tenant_id')
            .eq('id', contactId)
            .single();
          
          if (contact?.phone && contact?.tenant_id) {
            const whatsapp = contact.phone.startsWith('whatsapp:') 
              ? contact.phone 
              : `whatsapp:${contact.phone}`;
            
            const { data: newConv, error } = await supabase
              .from('conversations')
              .insert({
                contact_id: contact.id,
                tenant_id: contact.tenant_id,
                customer_whatsapp: whatsapp,
                status: 'open',
              })
              .select()
              .single();
            
            if (newConv && !error) {
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              toast.success('Conversación creada');
            } else {
              toast.error('Error al crear conversación');
            }
          } else {
            toast.info('Este contacto no tiene teléfono registrado');
          }
        })();
      }
      searchParams.delete('contact_id');
      setSearchParams(searchParams, { replace: true });
    } else if (!selectedConversation) {
      // Auto-select first conversation only on desktop
      if (!isMobile) {
        setSelectedConversation(conversations[0]);
      }
    }
  }, [conversations, searchParams, setSearchParams]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markAsRead.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Sync selectedConversation with realtime updates from conversations query
  useEffect(() => {
    if (!selectedConversation || !conversations) return;
    
    const updatedConv = conversations.find(c => c.id === selectedConversation.id);
    if (updatedConv) {
      // Only update if there are actual changes to avoid unnecessary re-renders
      const hasChanges = 
        updatedConv.ai_enabled !== selectedConversation.ai_enabled ||
        updatedConv.needs_human !== selectedConversation.needs_human ||
        updatedConv.ai_state !== selectedConversation.ai_state ||
        updatedConv.ai_pause_reason !== selectedConversation.ai_pause_reason ||
        updatedConv.last_message_preview !== selectedConversation.last_message_preview ||
        updatedConv.unread_count !== selectedConversation.unread_count;
      
      if (hasChanges) {
        setSelectedConversation(updatedConv);
      }
    }
  }, [conversations]);

  // Default panel state based on screen size
  useEffect(() => {
    const handleResize = () => {
      setShowContactPanel(window.innerWidth >= 1280);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredConversations = conversations?.filter(conv => {
    const searchLower = searchQuery.toLowerCase();
    const contactName = conv.contact?.name?.toLowerCase() || '';
    const phone = conv.customer_whatsapp?.toLowerCase() || '';
    const matchesSearch = contactName.includes(searchLower) || phone.includes(searchLower);
    const needsHuman = conv.needs_human === true || conv.ai_state === 'escalated';
    const matchesFilter = filterNeedsHuman ? needsHuman : true;
    // Hide conversations where contact is in closed_lost stage
    const isClosedLost = conv.contact?.pipeline_stage === 'closed_lost';
    // Tab filter
    const assignee = conv.contact?.assigned_agent_id ?? null;
    let matchesTab = true;
    if (inboxTab === "mine") {
      matchesTab = assignee === profile?.id;
    } else if (inboxTab === "unassigned") {
      matchesTab = assignee === null;
    } else {
      matchesTab = true; // team: all visible
    }
    return matchesSearch && matchesFilter && !isClosedLost && matchesTab;
  }) || [];

  const tabCounts = useMemo(() => {
    const list = conversations || [];
    return {
      mine: list.filter(
        (c) =>
          c.contact?.assigned_agent_id === profile?.id &&
          c.contact?.pipeline_stage !== "closed_lost",
      ).length,
      unassigned: list.filter(
        (c) =>
          !c.contact?.assigned_agent_id &&
          c.contact?.pipeline_stage !== "closed_lost",
      ).length,
      team: list.filter(
        (c) => c.contact?.pipeline_stage !== "closed_lost",
      ).length,
    };
  }, [conversations, profile?.id]);

  const needsHumanCount = conversations?.filter(c => c.needs_human === true || c.ai_state === 'escalated').length || 0;

  const getTimeAgo = (date: string | null) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false, locale: es });
    } catch {
      return '';
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'WA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Mensaje copiado');
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    if (isMobile) setMobileView('chat');
  };

  return (
    <div className={cn("flex h-full", isMobile && "overflow-hidden relative bg-background")}>
      {/* Conversations List */}
      <div className={cn(
        "border-r border-border flex flex-col bg-card",
        isMobile
          ? cn(
              "absolute inset-0 z-10 w-full transition-transform duration-300 ease-in-out",
              mobileView === 'list' ? "translate-x-0" : "-translate-x-full pointer-events-none"
            )
          : "w-80"
      )}>
        {/* Search Header */}
        <div className="p-4 border-b border-border space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Conversaciones</h2>
          <Tabs value={inboxTab} onValueChange={(v) => setInboxTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="mine" className="text-xs px-1">
                Míos
                {tabCounts.mine > 0 && (
                  <span className="ml-1 text-[10px] opacity-70">
                    {tabCounts.mine}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="text-xs px-1">
                Sin asignar
                {tabCounts.unassigned > 0 && (
                  <span className="ml-1 text-[10px] opacity-70">
                    {tabCounts.unassigned}
                  </span>
                )}
              </TabsTrigger>
              {isManagerOrAdmin && (
                <TabsTrigger value="team" className="text-xs px-1">
                  Equipo
                  {tabCounts.team > 0 && (
                    <span className="ml-1 text-[10px] opacity-70">
                      {tabCounts.team}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-none"
            />
          </div>
          {/* Filter for needs human */}
          <button
            onClick={() => setFilterNeedsHuman(!filterNeedsHuman)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors",
              filterNeedsHuman
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            Atención
            {needsHumanCount > 0 && (
              <span className={cn(
                "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                filterNeedsHuman ? "bg-amber-500/30" : "bg-amber-500/20 text-amber-400"
              )}>
                {needsHumanCount}
              </span>
            )}
          </button>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay conversaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las conversaciones aparecerán aquí cuando recibas mensajes
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conv) => (
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      onClick={() => handleSelectConversation(conv)}
                      className={cn(
                        "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                        selectedConversation?.id === conv.id && "bg-muted",
                        selectedConversation?.id !== conv.id &&
                          conv.last_customer_message_at &&
                          (!conv.last_agent_message_at || new Date(conv.last_customer_message_at) > new Date(conv.last_agent_message_at)) &&
                          "bg-muted/40"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-12 h-12 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {getInitials(conv.contact?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <h4 className={cn(
                                  "text-foreground truncate",
                                  conv.unread_count > 0 ? "font-semibold" : "font-medium"
                                )}>
                                  {conv.contact?.name || conv.customer_whatsapp}
                                </h4>
                                {/* Unread dot indicator */}
                                {conv.unread_count > 0 && (
                                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                )}
                                {conv.status === 'blocked' && (
                                  <Ban className="h-3 w-3 text-destructive shrink-0" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {getTimeAgo(conv.last_customer_message_at || conv.updated_at)}
                              </span>
                            </div>
                            <p className={cn(
                              "text-sm truncate mt-1",
                              conv.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                            )}>
                              {conv.last_message_preview || 'Sin mensajes'}
                            </p>
                            {conv.contact?.assigned_agent_id && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <div className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[8px] font-semibold flex items-center justify-center">
                                  {(memberMap.get(conv.contact.assigned_agent_id)?.name || "?")
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </div>
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {conv.contact.assigned_agent_id === profile?.id
                                    ? "Asignado a ti"
                                    : memberMap.get(conv.contact.assigned_agent_id)?.name || "Asignado"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            {conv.unread_count > 0 && (
                              <span className="min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center px-1.5">
                                {conv.unread_count > 99 ? '99+' : conv.unread_count}
                              </span>
                            )}
                            {conv.needs_human && (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Requiere atención" />
                            )}
                            {conv.status === 'risk' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" title="En riesgo: timeout sin respuesta" />
                            )}
                          </div>
                        </div>
                      {conv.status === 'blocked' && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          Bloqueado por saldo
                        </Badge>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem 
                      onClick={() => handleDeleteConversation(conv)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar conversación
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleArchiveContact(conv)}>
                      <UserX className="mr-2 h-4 w-4" />
                      Archivar contacto
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        isMobile
          ? cn(
              "absolute inset-0 z-20 w-full bg-background transition-transform duration-300 ease-in-out",
              mobileView === 'chat' || mobileView === 'profile' ? "translate-x-0" : "translate-x-full pointer-events-none"
            )
          : ""
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {isMobile && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMobileView('list')}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {getInitials(selectedConversation.contact?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {selectedConversation.contact?.name || 'WhatsApp Lead'}
                    </h3>
                    {selectedConversation.status === 'blocked' && (
                      <Badge variant="destructive" className="text-xs shrink-0">Bloqueado</Badge>
                    )}
                    {selectedConversation.needs_human && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30 shrink-0">
                        <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                        Atención
                      </Badge>
                    )}
                    {!selectedConversation.ai_enabled && !selectedConversation.needs_human && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        IA off
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{selectedConversation.customer_whatsapp}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
              {/* Pipeline Stage Select - hide on mobile */}
              {!isMobile && selectedContactId && headerContactData?.pipeline_stage && (
                <PipelineHeaderSelect
                  contactId={selectedContactId}
                  currentStage={headerContactData.pipeline_stage}
                  conversationId={selectedConversation.id}
                  assignedAgentId={headerContactData.assigned_agent_id ?? null}
                />
              )}
                {isMobile ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMobileView('profile')}
                  >
                    <User className="w-4 h-4" />
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showContactPanel ? "secondary" : "ghost"} 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setShowContactPanel(!showContactPanel)}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {showContactPanel ? 'Ocultar perfil' : 'Ver perfil'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Foreign-assignment awareness banner */}
            {selectedConversation.contact?.assigned_agent_id &&
              selectedConversation.contact.assigned_agent_id !== profile?.id && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Esta conversación está asignada a{" "}
                    <strong>
                      {memberMap.get(selectedConversation.contact.assigned_agent_id)?.name ||
                        "otro asesor"}
                    </strong>
                    . Coordina antes de responder para evitar duplicar la atención.
                  </span>
                </div>
              )}

            {/* Messages */}
            <ScrollArea 
              className="flex-1 p-6" 
              ref={scrollAreaRef}
              onScroll={handleScroll}
            >
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-4 max-w-3xl mx-auto" ref={messagesContainerRef}>
                  {/* Loading more indicator */}
                  {isLoadingMore && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-xs text-muted-foreground">Cargando mensajes...</span>
                    </div>
                  )}
                  
                  {/* Start of conversation indicator */}
                  {!hasMore && !isLoadingMore && (
                    <div className="flex items-center justify-center py-3">
                      <Badge variant="secondary" className="text-xs bg-muted/50 text-muted-foreground">
                        <MessageSquare className="h-3 w-3 mr-1.5" />
                        Inicio de la conversación
                      </Badge>
                    </div>
                  )}
                  {messages.map((msg, index) => {
                    // Date separator logic
                    const msgDate = parseISO(msg.created_at);
                    const msgDayKey = format(startOfDay(msgDate), 'yyyy-MM-dd');
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const prevDayKey = prevMsg 
                      ? format(startOfDay(parseISO(prevMsg.created_at)), 'yyyy-MM-dd')
                      : null;
                    const showDateSeparator = !prevDayKey || msgDayKey !== prevDayKey;
                    
                    return (
                      <div key={msg.id}>
                        {showDateSeparator && <DateSeparator date={msgDate} />}
                        <div
                          className={cn(
                            "flex group",
                            msg.direction === 'inbound' ? "justify-start" : "justify-end"
                          )}
                        >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 relative",
                          isMobile ? "max-w-[85%]" : "max-w-[70%]",
                          msg.direction === 'inbound'
                            ? "bg-message-incoming rounded-bl-sm"
                            : msg.status === 'failed'
                              ? "bg-destructive/20 border border-destructive/30 rounded-br-sm"
                              : "bg-message-outgoing rounded-br-sm"
                        )}
                      >
                        {/* AI badge - top right corner */}
                        {msg.ai_generated && (
                          <Badge variant="secondary" className="absolute -top-2 -right-1 text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <Bot className="h-2.5 w-2.5 mr-0.5" />
                            IA
                          </Badge>
                        )}
                        <p className={cn(
                          "text-sm whitespace-pre-line",
                          msg.direction === 'outbound' && msg.status !== 'failed' ? "text-white" : "text-foreground"
                        )}>{msg.body}</p>
                        
                        {/* Media rendering */}
                        {(msg.media_type || (msg.media_urls && msg.media_urls.length > 0)) && (
                          <MessageMediaRenderer
                            media={{
                              type: msg.media_type || null,
                              url: msg.media_urls?.[0] || null,
                              mimeType: msg.media_mime_type || null,
                              filename: msg.media_filename || null,
                              sizeBytes: msg.media_size_bytes || null,
                              durationSec: msg.media_duration_sec || null,
                              locationLat: msg.location_lat || null,
                              locationLng: msg.location_lng || null,
                              mediaUrls: msg.media_urls,
                            }}
                            className="mt-2"
                          />
                        )}
                        
                        {/* Template buttons */}
                        {msg.template?.buttons && Array.isArray(msg.template.buttons) && (msg.template.buttons as Array<{type: string; text: string; url?: string}>).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/20 space-y-1.5">
                            {(msg.template.buttons as Array<{type: string; text: string; url?: string}>).map((btn, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "text-center text-sm font-medium py-1.5 rounded-md",
                                  msg.direction === 'outbound' ? "text-white/90 bg-white/10" : "text-primary bg-primary/10"
                                )}
                              >
                                {btn.text}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Campaign badge */}
                        {msg.source === 'campaign' && msg.campaign && (
                          <div className={cn(
                            "flex items-center gap-1 mt-1 text-xs",
                            msg.direction === 'outbound' ? "text-white/70" : "text-muted-foreground"
                          )}>
                            <Megaphone className="h-3 w-3" />
                            <span>Campaña: {msg.campaign.name}</span>
                          </div>
                        )}
                        <div className={cn(
                          "flex items-center gap-1.5 mt-1",
                          msg.direction === 'inbound' ? "justify-start" : "justify-end"
                        )}>
                          <span className={cn(
                            "text-xs",
                            msg.direction === 'outbound' && msg.status !== 'failed' ? "text-white/70" : "text-foreground/60"
                          )}>
                            {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.direction === 'outbound' && (
                            <span className="flex items-center text-xs">
                              {msg.status === 'queued' && (
                                <Clock className="h-3 w-3 text-white/60" />
                              )}
                              {msg.status === 'sent' && (
                                <Check className="h-3 w-3 text-white/70" />
                              )}
                              {msg.status === 'delivered' && (
                                <CheckCheck className="h-3 w-3 text-white" />
                              )}
                              {msg.status === 'read' && (
                                <CheckCheck className="h-3 w-3 text-white" />
                              )}
                              {msg.status === 'failed' && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <XCircle className="h-3 w-3" />
                                  <span>Falló</span>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        
                        {/* Copy button on hover for outbound */}
                        {msg.direction === 'outbound' && msg.body && (
                          <button
                            onClick={() => handleCopyMessage(msg.body || '')}
                            className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-muted hover:bg-muted/80"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-6 text-center">
                  <MessageSquare className="h-12 w-12 mb-3" />
                  <p className="font-medium text-foreground">Sin mensajes aún</p>
                  <p className="text-sm mt-2 max-w-md">
                    Para iniciar la conversación con este cliente es necesario enviar una <strong>plantilla de WhatsApp</strong> aprobada. Usa el botón de plantillas en el compositor de abajo.
                  </p>
                </div>
              )}
            </ScrollArea>

            {/* Message Composer */}
            <MessageComposer
              conversationId={selectedConversation.id}
              lastCustomerMessageAt={selectedConversation.last_customer_message_at}
              conversationStatus={selectedConversation.status}
              contact={selectedConversation.contact ? {
                id: selectedConversation.contact.id || '',
                name: selectedConversation.contact.name || 'WhatsApp Lead',
                phone: selectedConversation.contact.phone || selectedConversation.customer_whatsapp,
                email: selectedConversation.contact.email,
                country: selectedConversation.contact.country,
              } : null}
              aiEnabled={selectedConversation.ai_enabled}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4" />
            <p className="text-lg">Selecciona una conversación</p>
            <p className="text-sm">para ver los mensajes</p>
          </div>
        )}
      </div>

      {/* Contact Info Panel - Desktop: collapsible sidebar, Mobile: full-screen overlay */}
      {selectedConversation && (isMobile ? mobileView === 'profile' : showContactPanel) && (
        <div className={cn(
          "border-l border-border bg-card animate-in slide-in-from-right-5 duration-200",
          isMobile 
            ? "fixed inset-0 z-50 w-full border-l-0 overflow-auto" 
            : "w-72 pr-3"
        )}>
          <ContactProfilePanel 
            conversation={selectedConversation}
            onClose={() => isMobile ? setMobileView('chat') : setShowContactPanel(false)}
          />
        </div>
      )}

      {/* Delete Conversation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la conversación y todos sus mensajes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Contact Dialog */}
      <AlertDialog open={archiveContactDialogOpen} onOpenChange={setArchiveContactDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              El contacto "{targetConversation?.contact?.name || 'Sin nombre'}" será archivado y ya no aparecerá en la lista de conversaciones activas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchiveContact}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
