import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  User,
  Building2,
  Mail,
  MessageSquare,
  Lock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSupportTickets,
  getStatusLabel,
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  getCategoryLabel,
  SupportMessage,
  SupportAttachment,
  TicketStatus,
} from '@/hooks/useSupportTickets';
import {
  useSupportRealtimeMessages,
  useOptimisticMessages,
  OptimisticMessage,
} from '@/hooks/useSupportRealtimeMessages';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { AttachmentGrid } from '@/components/support/AttachmentThumbnail';
import { ImageLightbox } from '@/components/support/ImageLightbox';

interface AdminTicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

export function AdminTicketDetail({ ticketId, onBack }: AdminTicketDetailProps) {
  const { profile } = useAuth();
  const { useTicketDetail, addMessage, isAddingMessage, updateStatus } = useSupportTickets();
  const { data, isLoading } = useTicketDetail(ticketId);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; name?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Optimistic messages
  const {
    allMessages,
    addOptimisticMessage,
    resolveOptimisticMessage,
    markOptimisticError,
    retryOptimisticMessage,
  } = useOptimisticMessages(data?.messages || [], profile?.id);

  // Realtime subscription
  const { isConnected } = useSupportRealtimeMessages({
    ticketId,
    enabled: !!ticketId && !!data,
    onNewMessage: useCallback(() => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, []),
  });

  // Scroll to bottom on load
  useEffect(() => {
    if (data?.messages?.length) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [data?.messages?.length]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { ticket, attachments } = data;

  // Get attachments for a specific message
  const getMessageAttachments = (messageId: string): SupportAttachment[] => {
    return attachments.filter(a => a.message_id === messageId);
  };

  // Get attachments not linked to any message (initial ticket attachments)
  const initialAttachments = attachments.filter(a => !a.message_id);

  const openLightbox = (images: { url: string; name?: string }[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleSendMessage = async (retryTempId?: string) => {
    // Handle retry
    if (retryTempId) {
      const retryMsg = retryOptimisticMessage(retryTempId);
      if (retryMsg) {
        try {
          await addMessage({ 
            ticketId, 
            message: retryMsg.message,
            isInternal: retryMsg.is_internal,
          });
          resolveOptimisticMessage(retryTempId);
        } catch {
          markOptimisticError(retryTempId);
        }
      }
      return;
    }

    if (!newMessage.trim()) return;
    
    // Create optimistic message
    const tempId = addOptimisticMessage({
      ticket_id: ticketId,
      sender_type: 'admin',
      sender_id: profile?.id || '',
      message: newMessage.trim(),
      is_internal: isInternal,
      sender: { name: profile?.name || 'Admin', email: profile?.email || '' },
    });

    const messageToSend = newMessage.trim();
    const wasInternal = isInternal;
    setNewMessage('');

    // Scroll to show pending message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      await addMessage({ ticketId, message: messageToSend, isInternal: wasInternal });
      resolveOptimisticMessage(tempId);
    } catch {
      markOptimisticError(tempId);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    await updateStatus({ ticketId, status: newStatus });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">
              #{ticket.id.slice(0, 8)}
            </span>
            <Badge className={cn('text-xs', getStatusColor(ticket.status))}>
              {getStatusLabel(ticket.status)}
            </Badge>
            <Badge className={cn('text-xs', getPriorityColor(ticket.priority))}>
              {getPriorityLabel(ticket.priority)}
            </Badge>
          </div>
          <h2 className="text-xl font-semibold mt-1">{ticket.subject}</h2>
        </div>

        {/* Status selector */}
        {ticket.status !== 'closed' && (
          <Select value={ticket.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abierto</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="waiting_customer">Esperando cliente</SelectItem>
              <SelectItem value="resolved">Resuelto</SelectItem>
              <SelectItem value="closed">Cerrado</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content - Messages */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {allMessages.map((message, idx) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      attachments={getMessageAttachments(message.id)}
                      initialAttachments={idx === 0 ? initialAttachments : []}
                      onImageClick={openLightbox}
                      isPending={(message as OptimisticMessage)._pending}
                      isError={(message as OptimisticMessage)._error}
                      onRetry={() => handleSendMessage((message as OptimisticMessage)._tempId)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              {/* Reply */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="internal"
                    checked={isInternal}
                    onCheckedChange={setIsInternal}
                  />
                  <Label htmlFor="internal" className="flex items-center gap-1.5 text-sm">
                    <Lock className="h-3.5 w-3.5" />
                    Nota interna (no visible para el cliente)
                  </Label>
                </div>
                <div className="flex gap-3">
                  <Textarea
                    placeholder={isInternal ? 'Escribe una nota interna...' : 'Escribe tu respuesta...'}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!newMessage.trim() || isAddingMessage}
                    className="self-end"
                  >
                    {isAddingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Metadata */}
        <div className="space-y-4">
          {/* Tenant info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Tenant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">
                  {(ticket.tenant as { name: string } | undefined)?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ID</p>
                <p className="font-mono text-xs">{ticket.tenant_id}</p>
              </div>
            </CardContent>
          </Card>

          {/* User info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Creado por
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">
                  {(ticket.creator as { name: string; email: string } | undefined)?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-sm flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {(ticket.creator as { name: string; email: string } | undefined)?.email || '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Ticket details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Detalles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Categoría</p>
                <p className="font-medium">{getCategoryLabel(ticket.category)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Creado</p>
                <p className="text-sm">
                  {format(new Date(ticket.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última actualización</p>
                <p className="text-sm">
                  {format(new Date(ticket.updated_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

function MessageBubble({
  message,
  attachments,
  initialAttachments,
  onImageClick,
  isPending,
  isError,
  onRetry,
}: {
  message: SupportMessage;
  attachments: SupportAttachment[];
  initialAttachments: SupportAttachment[];
  onImageClick: (images: { url: string; name?: string }[], index: number) => void;
  isPending?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const isSystem = message.sender_type === 'system';
  const isAdmin = message.sender_type === 'admin';
  const isInternal = message.is_internal;

  const allAttachments = [...initialAttachments, ...attachments];

  if (isSystem) {
    return (
      <div className="flex justify-center animate-in fade-in duration-300">
        <div className="px-4 py-2 bg-muted rounded-full text-xs text-muted-foreground">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex gap-3 animate-in fade-in duration-300',
      isPending && 'opacity-70'
    )}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs',
            isAdmin ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          )}
        >
          {message.sender?.name?.slice(0, 2).toUpperCase() || '??'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {message.sender?.name || 'Usuario'}
          </span>
          {isAdmin && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Soporte
            </Badge>
          )}
          {isInternal && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Lock className="h-2.5 w-2.5 mr-1" />
              Interno
            </Badge>
          )}
          {isPending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Enviando...
            </span>
          )}
          {isError && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Error
            </span>
          )}
          {!isPending && !isError && (
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.created_at), 'HH:mm', { locale: es })}
            </span>
          )}
        </div>
        <div
          className={cn(
            'p-3 rounded-lg',
            isInternal
              ? 'bg-yellow-500/10 border border-yellow-500/20'
              : isAdmin
              ? 'bg-primary/10 border border-primary/20'
              : 'bg-secondary',
            isError && 'border border-destructive/50'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          
          {/* Attachments grid with proper signed URLs */}
          {allAttachments.length > 0 && (
            <AttachmentGrid
              attachments={allAttachments}
              onImageClick={onImageClick}
            />
          )}
          
          {/* Retry button for failed messages */}
          {isError && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-7 text-xs gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Reintentar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}