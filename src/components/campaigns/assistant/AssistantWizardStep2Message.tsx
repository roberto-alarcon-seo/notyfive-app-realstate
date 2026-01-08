import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Check, 
  Sparkles, 
  Pencil, 
  Lock, 
  Copy as CopyIcon,
  AlertCircle,
  MessageSquare,
  Image,
  Video,
  Star,
  X,
  Wand2,
  Loader2,
  Send,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyProposal, MediaAttachment } from '@/hooks/useCampaignCopilot';
import { toast } from 'sonner';
import { TemplateMediaUpload, MediaFile } from '@/components/templates/TemplateMediaUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AssistantWizardStep2MessageProps {
  proposals: CopyProposal[];
  selectedCopy?: CopyProposal;
  templateBody?: string;
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected' | 'editing';
  templateId?: string;
  twilioSid?: string;
  media?: MediaAttachment;
  isSaving?: boolean;
  isSubmitting?: boolean;
  isSyncing?: boolean;
  onSelectCopy: (copy: CopyProposal) => void;
  onUpdateBody: (body: string) => void;
  onSaveTemplate: () => Promise<void>;
  onSubmitApproval: () => Promise<void>;
  onSyncStatus: () => Promise<void>;
  onRequestEdit: () => void;
  onMediaChange?: (media: MediaAttachment | undefined) => void;
  onAdaptCopyToMedia?: (mediaType: 'image' | 'video') => Promise<string | undefined>;
}

// Extract variables from template
function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{[^}]+\}\}/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

// Intent label mapping
const intentLabels: Record<string, { label: string; icon: string }> = {
  conversacional: { label: 'Conversacional', icon: '💬' },
  urgencia: { label: 'Urgencia', icon: '⚡' },
  beneficio: { label: 'Beneficio', icon: '🎁' },
};

// Approval status display
const statusDisplay: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon?: React.ReactNode }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  pending: { label: 'En revisión', variant: 'outline' },
  approved: { label: 'Aprobada', variant: 'default' },
  rejected: { label: 'Rechazada', variant: 'destructive' },
  editing: { label: 'Editando', variant: 'secondary' },
};

export function AssistantWizardStep2Message({
  proposals,
  selectedCopy,
  templateBody,
  approvalStatus,
  templateId,
  twilioSid,
  media,
  isSaving = false,
  isSubmitting = false,
  isSyncing = false,
  onSelectCopy,
  onUpdateBody,
  onSaveTemplate,
  onSubmitApproval,
  onSyncStatus,
  onRequestEdit,
  onMediaChange,
  onAdaptCopyToMedia,
}: AssistantWizardStep2MessageProps) {
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editedBody, setEditedBody] = useState(templateBody || '');
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>(
    media?.type || 'none'
  );
  const [showAdaptSuggestion, setShowAdaptSuggestion] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  
  // Sync editedBody when templateBody changes
  useEffect(() => {
    if (templateBody && approvalStatus !== 'editing') {
      setEditedBody(templateBody);
    }
  }, [templateBody, approvalStatus]);
  
  const variables = templateBody ? extractVariables(templateBody) : [];
  const isApproved = approvalStatus === 'approved';
  const isEditing = approvalStatus === 'editing';
  const isPending = approvalStatus === 'pending';
  const isRejected = approvalStatus === 'rejected';
  const isDraft = approvalStatus === 'draft';

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const handleEditRequest = () => {
    if (isApproved || isPending) {
      setShowEditConfirm(true);
    } else {
      onRequestEdit();
      setEditedBody(templateBody || '');
    }
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    onRequestEdit();
    setEditedBody(templateBody || '');
  };

  const handleSaveEdit = () => {
    onUpdateBody(editedBody);
  };

  const handleMediaTypeChange = (type: 'none' | 'image' | 'video') => {
    setMediaType(type);
    if (type === 'none') {
      onMediaChange?.(undefined);
    } else if (templateBody) {
      setShowAdaptSuggestion(true);
    }
  };

  const handleMediaUploaded = (file: MediaFile | null) => {
    if (file && mediaType !== 'none') {
      onMediaChange?.({
        type: mediaType as 'image' | 'video',
        url: file.url,
        filename: file.filename,
        mimeType: file.mimeType,
      });
      if (templateBody) {
        setShowAdaptSuggestion(true);
      }
    } else {
      onMediaChange?.(undefined);
    }
  };

  const handleAdaptCopy = async () => {
    if (!onAdaptCopyToMedia || mediaType === 'none') return;
    
    setIsAdapting(true);
    try {
      const adaptedCopy = await onAdaptCopyToMedia(mediaType as 'image' | 'video');
      if (adaptedCopy) {
        onUpdateBody(adaptedCopy);
        toast.success('Copy adaptado al contenido visual');
      }
    } catch (error) {
      console.error('Error adapting copy:', error);
      toast.error('Error al adaptar el copy');
    } finally {
      setIsAdapting(false);
      setShowAdaptSuggestion(false);
    }
  };

  // Sort proposals: recommended first
  const sortedProposals = [...proposals].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return 0;
  });

  const statusInfo = statusDisplay[approvalStatus] || statusDisplay.draft;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Selecciona y aprueba tu mensaje</h3>
        <p className="text-sm text-muted-foreground">
          Elige una de las variantes sugeridas, guárdala y envía a aprobación de WhatsApp
        </p>
      </div>

      {/* Main layout: copies list + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Copy proposals */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            Variantes de copy ({proposals.length})
          </h4>
          
          {proposals.length === 0 ? (
            <Card className="p-6 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Describe tu campaña al Copiloto para obtener sugerencias de mensajes.
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {sortedProposals.map((copy, idx) => {
                const isSelected = selectedCopy?.id === copy.id || 
                  (selectedCopy?.content === copy.content) ||
                  (selectedCopy?.main === copy.main);
                const intentInfo = intentLabels[copy.intent] || { label: copy.intent, icon: '📝' };
                
                return (
                  <Card
                    key={copy.id || idx}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md relative',
                      isSelected && 'ring-2 ring-primary bg-primary/5',
                      copy.recommended && !isSelected && 'border-primary/30'
                    )}
                    onClick={() => !isApproved && !isPending && onSelectCopy(copy)}
                  >
                    {copy.recommended && (
                      <div className="absolute -top-2 -right-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                                <Star className="w-3 h-3 fill-current" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-sm font-medium">Recomendado por IA</p>
                              {copy.recommendation_reason && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {copy.recommendation_reason}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                    
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {intentInfo.icon} {intentInfo.label}
                            </Badge>
                            {copy.recommended && (
                              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Recomendado
                              </Badge>
                            )}
                            {copy.editedByUser && (
                              <Badge variant="outline" className="text-xs">
                                <Pencil className="w-3 h-3 mr-1" />
                                Editado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-line line-clamp-4">
                            {copy.content || copy.main}
                          </p>
                        </div>
                        
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Preview & Edit */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">Vista previa</h4>
              {templateId && (
                <Badge variant={statusInfo.variant} className="text-xs">
                  {statusInfo.label}
                </Badge>
              )}
            </div>
            {templateBody && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToClipboard(templateBody)}
                >
                  <CopyIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditRequest}
                  disabled={isEditing || isSaving}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </div>
            )}
          </div>

          {/* WhatsApp-style preview */}
          <Card className="bg-[#e5ddd5] dark:bg-[#0b141a]">
            <CardContent className="p-4">
              {templateBody ? (
                <div className="max-w-[85%]">
                  <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg rounded-tl-none shadow-sm overflow-hidden">
                    {/* Media preview */}
                    {media && (
                      <div className="relative bg-muted/50">
                        {media.type === 'image' ? (
                          <img 
                            src={media.url} 
                            alt="Preview" 
                            className="w-full h-32 object-cover"
                          />
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center bg-black/20">
                            <Video className="w-10 h-10 text-white/70" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="p-3">
                      {isEditing ? (
                        <Textarea
                          value={editedBody}
                          onChange={(e) => setEditedBody(e.target.value)}
                          className="min-h-[120px] bg-white/80 dark:bg-black/20 border-0 text-sm resize-none"
                          placeholder="Escribe tu mensaje..."
                        />
                      ) : (
                        <p className="text-sm text-[#111b21] dark:text-white whitespace-pre-line">
                          {templateBody}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Variables detected */}
                  {variables.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">Variables:</span>
                      {variables.map((v, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-background">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Selecciona un copy para ver la vista previa
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Media attachment section */}
          {templateBody && !isApproved && !isPending && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium">Contenido multimedia (opcional)</h5>
                  {media && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMediaType('none');
                        onMediaChange?.(undefined);
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Quitar
                    </Button>
                  )}
                </div>
                
                <RadioGroup
                  value={mediaType}
                  onValueChange={(v) => handleMediaTypeChange(v as 'none' | 'image' | 'video')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="media-none" />
                    <Label htmlFor="media-none" className="text-sm cursor-pointer">
                      Sin media
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="image" id="media-image" />
                    <Label htmlFor="media-image" className="text-sm cursor-pointer flex items-center gap-1">
                      <Image className="w-4 h-4" />
                      Imagen
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="video" id="media-video" />
                    <Label htmlFor="media-video" className="text-sm cursor-pointer flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      Video
                    </Label>
                  </div>
                </RadioGroup>

                {mediaType !== 'none' && (
                  <TemplateMediaUpload
                    mediaType={mediaType}
                    value={media ? {
                      url: media.url,
                      filename: media.filename || 'media',
                      mimeType: media.mimeType || '',
                      sizeBytes: 0
                    } : null}
                    onChange={handleMediaUploaded}
                    disabled={isApproved || isPending}
                  />
                )}

                {/* Adapt copy suggestion */}
                {showAdaptSuggestion && media && onAdaptCopyToMedia && (
                  <Alert className="bg-primary/5 border-primary/20">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <span className="block mb-2">
                        La IA puede adaptar el mensaje al contenido visual para mejorar resultados
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAdaptCopy}
                          disabled={isAdapting}
                        >
                          {isAdapting ? 'Adaptando...' : 'Adaptar copy'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAdaptSuggestion(false)}
                        >
                          Mantener copy
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions based on status */}
          {templateBody && (
            <div className="space-y-3">
              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditedBody(templateBody);
                      onUpdateBody(templateBody);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveEdit}
                    disabled={!editedBody.trim()}
                  >
                    Guardar cambios
                  </Button>
                </div>
              )}

              {/* Save & Submit actions for draft status */}
              {isDraft && !isEditing && (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={onSaveTemplate}
                    disabled={isSaving}
                    size="lg"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Guardar plantilla
                      </>
                    )}
                  </Button>
                  
                  {templateId && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={onSubmitApproval}
                      disabled={isSubmitting || !templateId}
                      size="lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar a aprobación WhatsApp
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Pending status */}
              {isPending && (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <RefreshCw className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>Plantilla en revisión por WhatsApp</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSyncStatus}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span className="ml-1">Actualizar</span>
                      </Button>
                    </div>
                    {twilioSid && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        SID: {twilioSid}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Approved status */}
              {isApproved && (
                <Alert className="bg-success/10 border-success/30">
                  <Lock className="h-4 w-4 text-success" />
                  <AlertDescription className="text-sm text-success">
                    Plantilla aprobada por WhatsApp. Puedes continuar al siguiente paso.
                  </AlertDescription>
                </Alert>
              )}

              {/* Rejected status */}
              {isRejected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <p className="font-medium">Plantilla rechazada por WhatsApp</p>
                    <p className="text-xs mt-1">Edita el mensaje e intenta nuevamente.</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Variable info */}
              {variables.length > 0 && (isDraft || isEditing) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Este mensaje contiene {variables.length} variable(s) que se personalizarán automáticamente al enviar.
                  </AlertDescription>
                </Alert>
              )}

              {/* Media approval note */}
              {media && (isDraft || isEditing) && (
                <Alert>
                  <Image className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    La plantilla incluye {media.type === 'image' ? 'imagen' : 'video'}. 
                    Esto puede requerir aprobación adicional de WhatsApp.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit confirmation dialog */}
      <Dialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Editar plantilla {isApproved ? 'aprobada' : 'en revisión'}?</DialogTitle>
            <DialogDescription>
              {isApproved 
                ? 'Si editas la plantilla, deberás enviarla nuevamente a aprobación.'
                : 'Si editas la plantilla mientras está en revisión, se cancelará el proceso actual.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEdit}>
              Sí, editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
