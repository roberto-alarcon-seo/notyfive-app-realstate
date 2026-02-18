import { useState, useRef, useEffect } from "react";
import { Send, AlertTriangle, Clock, Wallet, Loader2, RotateCcw, FileText, Sparkles, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSendMessage, isOutOfWindow, getHoursUntilWindowClose } from "@/hooks/useSendMessage";
import { useSendTemplate } from "@/hooks/useSendTemplate";
import { useWallet } from "@/hooks/useWallet";
import { useTemplates } from "@/hooks/useTemplates";
import { useRewriteText } from "@/hooks/useRewriteText";
import { useOperationStatus } from "@/hooks/useOperationStatus";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { EmojiPicker } from "./EmojiPicker";
import { TemplateSelectorSheet } from "./TemplateSelectorSheet";
import { MediaUploadButton, type MediaFile } from "./MediaUploadButton";
import { MediaPreviewOverlay } from "./MediaPreviewOverlay";
import { RewritePreviewModal, getStoredTone, type RewriteTone } from "./RewritePreviewModal";
import { useAuth } from "@/contexts/AuthContext";

interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
}

interface MessageComposerProps {
  conversationId: string;
  lastCustomerMessageAt: string | null;
  conversationStatus: string;
  contact?: Contact | null;
  onMessageSent?: () => void;
  aiEnabled?: boolean;
}

export function MessageComposer({ 
  conversationId, 
  lastCustomerMessageAt,
  conversationStatus,
  contact,
  onMessageSent,
  aiEnabled = true,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const [rewriteOriginalText, setRewriteOriginalText] = useState("");
  const [rewriteSuggestedText, setRewriteSuggestedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const { data: wallet, refetch: refetchWallet } = useWallet();
  const { data: templates } = useTemplates();
  const sendMessage = useSendMessage();
  const sendTemplate = useSendTemplate();
  const rewriteText = useRewriteText();
  const { canOperate } = useOperationStatus();

  const walletBalance = wallet?.balance_messages || 0;
  const isWalletBlocked = walletBalance <= 0 || !canOperate;
  const outOfWindow = isOutOfWindow(lastCustomerMessageAt);
  const hoursRemaining = getHoursUntilWindowClose(lastCustomerMessageAt);
  const isConversationBlocked = conversationStatus === 'blocked';

  const isDisabled = isWalletBlocked || outOfWindow || isConversationBlocked || sendMessage.isPending;

  // AI Copilot visibility conditions:
  // - AI auto-reply is OFF (aiEnabled === false)
  // - Text has at least 10 characters
  const canShowRewrite = !aiEnabled && text.trim().length >= 10;

  // Check if there are approved templates
  const approvedTemplates = templates?.filter(t => t.approval_status === 'approved') || [];
  const hasApprovedTemplates = approvedTemplates.length > 0;
  const canSendTemplates = !isWalletBlocked && hasApprovedTemplates;

  // Get dynamic placeholder based on state
  const getPlaceholder = () => {
    if (isWalletBlocked) return "Saldo agotado";
    if (outOfWindow) return "Fuera de ventana, usa una plantilla";
    return "Escribe un mensaje...";
  };

  // Clear error when conditions change
  useEffect(() => {
    setLocalError(null);
  }, [conversationId, walletBalance, outOfWindow]);

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText(prev => prev + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setText(newText);
    
    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSend = async (mediaCaption?: string) => {
    const messageText = mediaCaption !== undefined ? mediaCaption : text.trim();
    if ((!messageText && !selectedMedia) || isDisabled) return;

    setLocalError(null);

    try {
      await sendMessage.mutateAsync({
        conversationId,
        text: messageText || undefined,
        media: selectedMedia ? {
          url: selectedMedia.url,
          type: selectedMedia.type,
          mimeType: selectedMedia.mimeType,
          filename: selectedMedia.filename,
          sizeBytes: selectedMedia.sizeBytes,
        } : undefined,
      });
      setText("");
      setSelectedMedia(null);
      setShowMediaPreview(false);
      refetchWallet();
      onMessageSent?.();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      
      if (err.code === 'INSUFFICIENT_BALANCE') {
        setLocalError('Saldo agotado. Recarga mensajes para continuar.');
        refetchWallet();
      } else if (err.code === 'OUT_OF_WINDOW') {
        setLocalError('Fuera de ventana de 24h. Solo puedes enviar plantillas aprobadas.');
      } else if (err.code === 'SEND_FAILED') {
        toast.error('Error al enviar', { description: err.message });
      } else {
        toast.error('Error al enviar mensaje', { description: err.message });
      }
    }
  };

  const handleMediaSelected = (media: MediaFile) => {
    setSelectedMedia(media);
    setShowMediaPreview(true);
  };

  const handleMediaPreviewClose = () => {
    setShowMediaPreview(false);
    setSelectedMedia(null);
  };

  const handleSendTemplate = async (templateId: string, variables: Record<string, string>) => {
    try {
      await sendTemplate.mutateAsync({
        conversationId,
        templateId,
        variables,
      });
      setShowTemplates(false);
      refetchWallet();
      onMessageSent?.();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      
      if (err.code === 'INSUFFICIENT_BALANCE') {
        setLocalError('Saldo agotado. Recarga mensajes para continuar.');
        refetchWallet();
      }
      // Other errors are handled by the hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRewriteClick = async () => {
    const currentText = text.trim();
    if (currentText.length < 10) return;

    setRewriteOriginalText(currentText);
    setRewriteSuggestedText("");
    setShowRewriteModal(true);

    try {
      const result = await rewriteText.mutateAsync({
        originalText: currentText,
        contactName: contact?.name,
        tone: getStoredTone(),
      });
      setRewriteSuggestedText(result.improved_text);
    } catch (error) {
      const err = error as { message?: string };
      toast.error('Error al mejorar el texto', { description: err.message });
      setShowRewriteModal(false);
    }
  };

  const handleUseSuggestion = (suggestedText: string) => {
    setText(suggestedText);
    setShowRewriteModal(false);
    // Focus textarea after using suggestion
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleToneChange = async (tone: RewriteTone) => {
    if (!rewriteOriginalText) return;
    setRewriteSuggestedText("");
    try {
      const result = await rewriteText.mutateAsync({
        originalText: rewriteOriginalText,
        contactName: contact?.name,
        tone,
      });
      setRewriteSuggestedText(result.improved_text);
    } catch (error) {
      const err = error as { message?: string };
      toast.error('Error al mejorar el texto', { description: err.message });
    }
  };

  // Render wallet blocked / no credits state
  if (isWalletBlocked) {
    return (
      <div className="p-4 border-t border-border bg-card">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-destructive">Envío deshabilitado</h4>
              <p className="text-sm text-muted-foreground">
                {!canOperate 
                  ? 'Necesitas activar un plan o recargar créditos para enviar mensajes.'
                  : 'Recarga mensajes para continuar enviando.'
                }
              </p>
            </div>
            <Button 
              size="sm"
              onClick={() => navigate('/settings/billing')}
              className="shrink-0 gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {!canOperate ? 'Activar plan' : 'Recargar'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render out of window state (but with template option)
  if (outOfWindow) {
    return (
      <div className="p-4 border-t border-border bg-card">
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-warning">Fuera de ventana de 24h</h4>
              <p className="text-sm text-muted-foreground">
                Solo puedes enviar plantillas aprobadas después de 24h sin respuesta del cliente.
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="shrink-0 border-warning/30 text-warning hover:bg-warning/10"
                    disabled={!canSendTemplates}
                    onClick={() => setShowTemplates(true)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Usar plantilla
                  </Button>
                </TooltipTrigger>
                {!hasApprovedTemplates && (
                  <TooltipContent>
                    No tienes plantillas aprobadas
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Template Selector Sheet */}
        <TemplateSelectorSheet
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          contact={contact ? {
            id: contact.id,
            name: contact.name,
            phone: contact.phone || undefined,
            email: contact.email || undefined,
            country: contact.country || undefined,
          } : null}
          lastCustomerMessageAt={lastCustomerMessageAt}
          onSendTemplate={handleSendTemplate}
          isSending={sendTemplate.isPending}
        />
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-t border-border bg-card space-y-2">
        {/* Error message */}
        {localError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {/* Composer */}
        {isMobile ? (
          /* Mobile layout: action bar on top, input + send below */
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <MediaUploadButton
                onMediaSelected={handleMediaSelected}
                onMediaRemoved={() => setSelectedMedia(null)}
                selectedMedia={null}
                disabled={isDisabled}
                tenantId={profile?.tenant_id || undefined}
              />
              <EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={isDisabled} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={!canSendTemplates}
                      onClick={() => setShowTemplates(true)}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!hasApprovedTemplates 
                      ? 'No hay plantillas aprobadas' 
                      : 'Enviar plantilla'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={getPlaceholder()}
                  disabled={isDisabled}
                  className={cn(
                    "min-h-[40px] max-h-[120px] resize-none",
                    "bg-muted border-none focus-visible:ring-1 focus-visible:ring-primary",
                    canShowRewrite && "pr-10"
                  )}
                  rows={1}
                />
                {canShowRewrite && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-primary hover:bg-primary/10"
                    onClick={handleRewriteClick}
                    disabled={rewriteText.isPending}
                  >
                    {rewriteText.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
              <Button
                size="icon"
                onClick={() => handleSend()}
                disabled={!text.trim() || isDisabled}
                className="h-10 w-10 shrink-0 rounded-full"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Desktop layout: inline */
          <div className="flex items-end gap-2">
            <MediaUploadButton
              onMediaSelected={handleMediaSelected}
              onMediaRemoved={() => setSelectedMedia(null)}
              selectedMedia={null}
              disabled={isDisabled}
              tenantId={profile?.tenant_id || undefined}
            />
            
            <EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={isDisabled} />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    disabled={!canSendTemplates}
                    onClick={() => setShowTemplates(true)}
                  >
                    <FileText className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!hasApprovedTemplates 
                    ? 'No hay plantillas aprobadas' 
                    : 'Enviar plantilla'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                disabled={isDisabled}
                className={cn(
                  "min-h-[44px] max-h-[200px] resize-none pr-4",
                  "bg-muted border-none focus-visible:ring-1 focus-visible:ring-primary",
                  canShowRewrite && "pr-12"
                )}
                rows={1}
              />
              
              {canShowRewrite && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:bg-primary/10"
                        onClick={handleRewriteClick}
                        disabled={rewriteText.isPending}
                      >
                        {rewriteText.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Mejorar redacción con IA
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!text.trim() || isDisabled}
              className="h-11 w-11 shrink-0"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}

        {/* Window status indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>Ventana activa: {hoursRemaining}h restantes</span>
          </div>
        </div>

        {/* Retry option for failed messages */}
        {sendMessage.isError && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>El mensaje no se pudo enviar.</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleSend()}
              className="h-auto py-1 px-2 text-primary"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reintentar
            </Button>
          </div>
        )}

        {/* Template Selector Sheet */}
        <TemplateSelectorSheet
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
          contact={contact ? {
            id: contact.id,
            name: contact.name,
            phone: contact.phone || undefined,
            email: contact.email || undefined,
            country: contact.country || undefined,
          } : null}
          lastCustomerMessageAt={lastCustomerMessageAt}
          onSendTemplate={handleSendTemplate}
          isSending={sendTemplate.isPending}
        />
      </div>

      {/* Media Preview Overlay */}
      {showMediaPreview && selectedMedia && (
        <MediaPreviewOverlay
          media={selectedMedia}
          onClose={handleMediaPreviewClose}
          onSend={handleSend}
          isSending={sendMessage.isPending}
        />
      )}

      {/* AI Rewrite Preview Modal */}
      <RewritePreviewModal
        open={showRewriteModal}
        onClose={() => setShowRewriteModal(false)}
        originalText={rewriteOriginalText}
        suggestedText={rewriteSuggestedText}
        onUseSuggestion={handleUseSuggestion}
        onToneChange={handleToneChange}
        isLoading={rewriteText.isPending}
      />
    </>
  );
}
