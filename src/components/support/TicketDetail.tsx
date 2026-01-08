import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, Loader2, CheckCircle2, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSupportTickets,
  getStatusLabel,
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  getCategoryLabel,
  SupportMessage,
  SupportAttachment,
} from '@/hooks/useSupportTickets';
import {
  useSupportRealtimeMessages,
  useOptimisticMessages,
  OptimisticMessage,
} from '@/hooks/useSupportRealtimeMessages';
import { cn } from '@/lib/utils';
import { AttachImageButton } from './SupportImageUploader';
import { AttachmentGrid } from './AttachmentThumbnail';
import { ImageLightbox } from './ImageLightbox';

interface TicketDetailProps {
  ticketId: string;
}

interface PendingFile {
  file: File;
  preview: string;
}

export function TicketDetail({ ticketId }: TicketDetailProps) {
  const { profile, isSuperAdmin } = useAuth();
  const { useTicketDetail, addMessage, isAddingMessage, updateStatus, closeTicket } = useSupportTickets();
  const { data, isLoading } = useTicketDetail(ticketId);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; name?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
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
      // Scroll to bottom on new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, []),
  });

  // Scroll to bottom on load and new messages
  useEffect(() => {
    if (data?.messages?.length) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [data?.messages?.length]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { ticket, attachments } = data;
  const canClose = ticket.status === 'resolved' && !isSuperAdmin;
  const canReply = ticket.status !== 'closed';

  const handleSendMessage = async (retryTempId?: string) => {
    const messageText = newMessage.trim() || '(Imagen adjunta)';
    const files = pendingFiles.map(pf => pf.file);
    
    // Get retry message if retrying
    if (retryTempId) {
      const retryMsg = retryOptimisticMessage(retryTempId);
      if (retryMsg) {
        try {
          await addMessage({ 
            ticketId, 
            message: retryMsg.message,
          });
          resolveOptimisticMessage(retryTempId);
        } catch {
          markOptimisticError(retryTempId);
        }
      }
      return;
    }

    if (!newMessage.trim() && pendingFiles.length === 0) return;
    
    // Create optimistic message
    const tempId = addOptimisticMessage({
      ticket_id: ticketId,
      sender_type: isSuperAdmin ? 'admin' : 'owner',
      sender_id: profile?.id || '',
      message: messageText,
      is_internal: false,
      has_attachments: files.length > 0,
      sender: { name: profile?.name || 'Tú', email: profile?.email || '' },
    });

    // Clear input immediately for optimistic feel
    pendingFiles.forEach(pf => URL.revokeObjectURL(pf.preview));
    setPendingFiles([]);
    setNewMessage('');

    // Scroll to show pending message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    try {
      await addMessage({ 
        ticketId, 
        message: messageText,
        attachments: files.length > 0 ? files : undefined,
      });
      resolveOptimisticMessage(tempId);
    } catch {
      markOptimisticError(tempId);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    const newPending = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingFiles(prev => [...prev, ...newPending].slice(0, 5));
  };

  const removePendingFile = (index: number) => {
    const file = pendingFiles[index];
    URL.revokeObjectURL(file.preview);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStatusChange = async (newStatus: 'in_progress' | 'waiting_customer' | 'resolved') => {
    await updateStatus({ ticketId, status: newStatus });
  };

  const openLightbox = (images: { url: string; name?: string }[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Get attachments for a specific message
  const getMessageAttachments = (messageId: string): SupportAttachment[] => {
    return attachments.filter(a => a.message_id === messageId);
  };

  // Get attachments not linked to any message (initial ticket attachments)
  const initialAttachments = attachments.filter(a => !a.message_id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-muted-foreground">
                #{ticket.id.slice(0, 8)}
              </span>
              <Badge className={cn('text-xs', getStatusColor(ticket.status))}>
                {getStatusLabel(ticket.status)}
              </Badge>
              <Badge className={cn('text-xs', getPriorityColor(ticket.priority))}>
                {getPriorityLabel(ticket.priority)}
              </Badge>
            </div>
            <h2 className="text-xl font-semibold text-foreground">{ticket.subject}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>Categoría: {getCategoryLabel(ticket.category)}</span>
              <span>•</span>
              <span>
                Creado: {format(new Date(ticket.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
              </span>
            </div>
          </div>

          {/* Admin actions */}
          {isSuperAdmin && ticket.status !== 'closed' && (
            <div className="flex items-center gap-2">
              {ticket.status === 'open' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange('in_progress')}
                >
                  Tomar ticket
                </Button>
              )}
              {ticket.status === 'in_progress' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange('waiting_customer')}
                  >
                    Esperar cliente
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleStatusChange('resolved')}
                    className="gap-1"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Resolver
                  </Button>
                </>
              )}
              {ticket.status === 'waiting_customer' && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleStatusChange('in_progress')}
                >
                  En progreso
                </Button>
              )}
            </div>
          )}

          {/* Owner close action */}
          {canClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => closeTicket(ticketId)}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Cerrar ticket
            </Button>
          )}
        </div>
      </div>

      {/* Messages timeline */}
      <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
        <div className="space-y-6 max-w-3xl">
          {allMessages.map((message, idx) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              currentUserId={profile?.id}
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

      {/* Reply input */}
      {canReply && (
        <>
          <Separator />
          <div className="p-4">
            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {pendingFiles.map((pf, index) => (
                  <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={pf.preview} alt="" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5"
                      onClick={() => removePendingFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Escribe tu respuesta..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[80px] resize-none pr-12"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSendMessage();
                    }
                  }}
                />
                <div className="absolute bottom-2 right-2">
                  <AttachImageButton 
                    onFilesSelected={handleFilesSelected}
                    disabled={isAddingMessage || pendingFiles.length >= 5}
                  />
                </div>
              </div>
              <Button
                onClick={() => handleSendMessage()}
                disabled={(!newMessage.trim() && pendingFiles.length === 0) || isAddingMessage}
                className="self-end"
              >
                {isAddingMessage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Presiona Cmd/Ctrl + Enter para enviar • Haz clic en 📎 para adjuntar imágenes
            </p>
          </div>
        </>
      )}

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
  currentUserId,
  attachments,
  initialAttachments,
  onImageClick,
  isPending,
  isError,
  onRetry,
}: {
  message: SupportMessage;
  currentUserId?: string;
  attachments: SupportAttachment[];
  initialAttachments: SupportAttachment[];
  onImageClick: (images: { url: string; name?: string }[], index: number) => void;
  isPending?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const isOwn = message.sender_id === currentUserId;
  const isSystem = message.sender_type === 'system';
  const isAdmin = message.sender_type === 'admin';

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

  const handleImageClick = (images: { url: string; name?: string }[], index: number) => {
    onImageClick(images, index);
  };

  return (
    <div className={cn(
      'flex gap-3 animate-in fade-in duration-300',
      isOwn ? 'flex-row-reverse' : '',
      isPending && 'opacity-70'
    )}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          'text-xs',
          isAdmin ? 'bg-primary text-primary-foreground' : 'bg-secondary'
        )}>
          {message.sender?.name?.slice(0, 2).toUpperCase() || '??'}
        </AvatarFallback>
      </Avatar>
      <div className={cn('max-w-[70%]', isOwn ? 'text-right' : '')}>
        <div className={cn('flex items-center gap-2 mb-1', isOwn && 'justify-end')}>
          <span className="text-sm font-medium text-foreground">
            {message.sender?.name || 'Usuario'}
          </span>
          {isAdmin && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Soporte
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
            'p-4 rounded-lg',
            isOwn
              ? 'bg-primary text-primary-foreground'
              : isAdmin
              ? 'bg-blue-500/10 border border-blue-500/20'
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