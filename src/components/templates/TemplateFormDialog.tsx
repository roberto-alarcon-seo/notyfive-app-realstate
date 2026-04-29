import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, X, Save, Send, AlertCircle, Loader2 } from "lucide-react";
import { Template, TemplateFormData, TemplateButton, TemplateMedia, getAllVariables, useCreateTemplate, useUpdateTemplate, useSubmitTemplateForApproval, useTwilioStatus } from "@/hooks/useTemplates";
import { TemplatePreview } from "./TemplatePreview";
import { VariableSelector } from "./VariableSelector";
import { TemplateEmojiPicker } from "./TemplateEmojiPicker";
import { TemplateMediaUpload, MediaFile } from "./TemplateMediaUpload";

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
}

const categories = [
  { value: 'utility', label: 'Utility' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'authentication', label: 'Authentication' },
];

const labels = [
  'Onboarding',
  'Cobranza',
  'Promoción',
  'Servicio',
  'E-commerce',
  'Feedback',
  'Alertas',
  'Recordatorio',
];

const headerTypes = [
  { value: 'none', label: 'Sin encabezado' },
  { value: 'text', label: 'Texto' },
  { value: 'image', label: 'Media: Imagen' },
  { value: 'video', label: 'Media: Video' },
  { value: 'document', label: 'Media: Documento' },
];

export function TemplateFormDialog({ open, onOpenChange, template }: TemplateFormDialogProps) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const submitForApproval = useSubmitTemplateForApproval();
  const { data: twilioStatus, isLoading: isTwilioLoading } = useTwilioStatus();
  
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const headerTextRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    category: 'utility',
    label: '',
    header_type: 'none',
    header_text: '',
    body: '',
    footer: '',
    buttons: [],
    media: null,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invalidateConfirmOpen, setInvalidateConfirmOpen] = useState(false);
  const [pendingSubmitApproval, setPendingSubmitApproval] = useState(false);
  
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        category: template.category,
        label: template.label || '',
        header_type: template.header_type,
        header_text: template.header_text || '',
        body: template.body,
        footer: template.footer || '',
        buttons: template.buttons,
        media: template.media_url ? {
          url: template.media_url,
          filename: template.media_filename || '',
          mimeType: template.media_mime_type || '',
          sizeBytes: template.media_size_bytes || 0,
        } : null,
      });
    } else {
      setFormData({
        name: '',
        category: 'utility',
        label: '',
        header_type: 'none',
        header_text: '',
        body: '',
        footer: '',
        buttons: [],
        media: null,
      });
    }
    setErrors({});
  }, [template, open]);
  
  const variables = getAllVariables(formData);
  
  const isMediaHeader = ['image', 'video', 'document'].includes(formData.header_type);
  
  const insertAtCursor = (ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, text: string, field: keyof TemplateFormData) => {
    const element = ref.current;
    if (element) {
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const currentValue = (formData[field] as string) || '';
      const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
      setFormData(prev => ({ ...prev, [field]: newValue }));
      
      setTimeout(() => {
        element.focus();
        const newPos = start + text.length;
        element.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setFormData(prev => ({ ...prev, [field]: ((prev[field] as string) || '') + text }));
    }
  };
  
  const handleInsertVariable = (variable: string) => {
    insertAtCursor(bodyRef, variable, 'body');
  };
  
  const handleBodyEmoji = (emoji: string) => {
    insertAtCursor(bodyRef, emoji, 'body');
  };
  
  const handleHeaderEmoji = (emoji: string) => {
    insertAtCursor(headerTextRef, emoji, 'header_text');
  };
  
  const handleFooterEmoji = (emoji: string) => {
    insertAtCursor(footerRef, emoji, 'footer');
  };
  
  const handleMediaChange = (media: MediaFile | null) => {
    setFormData(prev => ({
      ...prev,
      media: media ? {
        url: media.url,
        filename: media.filename,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
      } : null
    }));
  };
  
  const handleAddButton = () => {
    if ((formData.buttons?.length || 0) >= 3) return;
    setFormData(prev => ({
      ...prev,
      buttons: [...(prev.buttons || []), { type: 'quick_reply', text: '' }]
    }));
  };
  
  const handleRemoveButton = (index: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons?.filter((_, i) => i !== index) || []
    }));
  };
  
  const handleButtonChange = (index: number, field: keyof TemplateButton, value: string) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons?.map((btn, i) => 
        i === index ? { ...btn, [field]: value } : btn
      ) || []
    }));
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }
    
    if (!formData.body.trim()) {
      newErrors.body = 'El cuerpo del mensaje es obligatorio';
    }
    
    if (formData.body.length > 1024) {
      newErrors.body = 'El cuerpo no puede exceder 1024 caracteres';
    }
    
    // Validate media for media headers
    if (isMediaHeader && !formData.media) {
      newErrors.media = 'Debes subir un archivo para el encabezado';
    }
    
    // Validate buttons
    formData.buttons?.forEach((btn, i) => {
      if (btn.type === 'url' && btn.text && !btn.url) {
        newErrors[`button_${i}`] = 'La URL es obligatoria para botones de enlace';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const performUpdate = async (
    submitApproval: boolean,
    confirmInvalidateApproval: boolean
  ) => {
    if (!template) return;
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        ...formData,
        confirmInvalidateApproval,
      });
      if (submitApproval && (template.approval_status === 'draft' || confirmInvalidateApproval)) {
        await submitForApproval.mutateAsync(template.id);
      }
      onOpenChange(false);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err?.code === 'APPROVED_EDIT_REQUIRES_CONFIRMATION') {
        setPendingSubmitApproval(submitApproval);
        setInvalidateConfirmOpen(true);
        return;
      }
      // Other errors are toasted by the hook.
    }
  };

  const handleSave = async (submitApproval: boolean = false) => {
    if (!validate()) return;
    
    if (template) {
      await performUpdate(submitApproval, false);
      return;
    } else {
      const created = await createTemplate.mutateAsync(formData);
      if (submitApproval && created) {
        await submitForApproval.mutateAsync(created.id);
      }
    }
    
    onOpenChange(false);
  };
  
  const isLoading = createTemplate.isPending || updateTemplate.isPending || submitForApproval.isPending;
  const isEditing = !!template;
  const canSubmitForApproval = !template || template.approval_status === 'draft' || template.approval_status === 'rejected';
  const hasMediaError = isMediaHeader && !formData.media;
  const canSubmitToTwilio = twilioStatus?.connected && twilioStatus?.hasPhone;
  const twilioNotConfigured = !isTwilioLoading && !canSubmitToTwilio;
  
  // Count characters (emojis count as 1)
  const bodyCharCount = [...formData.body].length;
  
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>
            {isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
          {/* Form Column */}
          <ScrollArea className="h-full border-r border-border">
            <div className="p-6 space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la plantilla *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Bienvenida nuevo cliente"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              
              {/* Category and Label */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría WhatsApp *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Etiqueta funcional</Label>
                  <Select 
                    value={formData.label || ''} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, label: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {labels.map((label) => (
                        <SelectItem key={label} value={label}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Header Type */}
              <div className="space-y-2">
                <Label>Tipo de encabezado</Label>
                <Select 
                  value={formData.header_type} 
                  onValueChange={(v) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      header_type: v,
                      // Clear media when changing away from media type
                      media: ['image', 'video', 'document'].includes(v) ? prev.media : null,
                      // Clear header_text when switching to media
                      header_text: v === 'text' ? prev.header_text : ''
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {headerTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Text Header */}
              {formData.header_type === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="header_text">Texto del encabezado</Label>
                  <div className="relative">
                    <Input
                      ref={headerTextRef}
                      id="header_text"
                      value={formData.header_text || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, header_text: e.target.value }))}
                      placeholder="Ej: ¡Oferta especial! 🎉"
                      className="pr-10"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <TemplateEmojiPicker onEmojiSelect={handleHeaderEmoji} />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Media Upload */}
              {isMediaHeader && (
                <div className="space-y-2">
                  <Label>
                    Archivo del encabezado (Media) *
                  </Label>
                  <TemplateMediaUpload
                    mediaType={formData.header_type as 'image' | 'video' | 'document'}
                    value={formData.media ? {
                      url: formData.media.url,
                      filename: formData.media.filename,
                      mimeType: formData.media.mimeType,
                      sizeBytes: formData.media.sizeBytes,
                    } : null}
                    onChange={handleMediaChange}
                  />
                  {errors.media && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {errors.media}
                    </div>
                  )}
                </div>
              )}
              
              {/* Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Cuerpo del mensaje *</Label>
                  <span className="text-xs text-muted-foreground">
                    {bodyCharCount}/1024
                  </span>
                </div>
                <div className="relative">
                  <Textarea
                    ref={bodyRef}
                    id="body"
                    value={formData.body}
                    onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Escribe tu mensaje aquí. Usa {{nombre}} para variables dinámicas. 😊"
                    rows={6}
                    className={`pr-10 ${errors.body ? 'border-destructive' : ''}`}
                  />
                  <div className="absolute right-2 top-2">
                    <TemplateEmojiPicker onEmojiSelect={handleBodyEmoji} />
                  </div>
                </div>
                {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
                
                <div className="flex items-center gap-2">
                  <VariableSelector onSelect={handleInsertVariable} />
                </div>
                
                {/* Variables preview */}
                {variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {variables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="space-y-2">
                <Label htmlFor="footer">Pie de página</Label>
                <div className="relative">
                  <Input
                    ref={footerRef}
                    id="footer"
                    value={formData.footer || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, footer: e.target.value }))}
                    placeholder="Ej: Responde STOP para darte de baja 👋"
                    className="pr-10"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <TemplateEmojiPicker onEmojiSelect={handleFooterEmoji} />
                  </div>
                </div>
              </div>
              
              {/* Buttons */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Botones interactivos</Label>
                  <span className="text-xs text-muted-foreground">
                    {formData.buttons?.length || 0}/3
                  </span>
                </div>
                
                {formData.buttons?.map((button, index) => (
                  <div key={index} className="p-3 border border-border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Botón {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveButton(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Select 
                        value={button.type} 
                        onValueChange={(v) => handleButtonChange(index, 'type', v as 'quick_reply' | 'url')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick_reply">Respuesta rápida</SelectItem>
                          <SelectItem value="url">Enlace URL</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input
                        value={button.text}
                        onChange={(e) => handleButtonChange(index, 'text', e.target.value)}
                        placeholder="Texto del botón"
                      />
                    </div>
                    
                    {button.type === 'url' && (
                      <Input
                        value={button.url || ''}
                        onChange={(e) => handleButtonChange(index, 'url', e.target.value)}
                        placeholder="https://ejemplo.com"
                        className={errors[`button_${index}`] ? 'border-destructive' : ''}
                      />
                    )}
                    {errors[`button_${index}`] && (
                      <p className="text-xs text-destructive">{errors[`button_${index}`]}</p>
                    )}
                  </div>
                ))}
                
                {(formData.buttons?.length || 0) < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddButton}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar botón
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
          
          {/* Preview Column */}
          <div className="h-full bg-muted/30 flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-medium text-sm">Vista previa</h3>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <TemplatePreview
                headerType={formData.header_type}
                headerText={formData.header_text}
                body={formData.body}
                footer={formData.footer}
                buttons={formData.buttons}
                media={formData.media}
                className="max-w-sm mx-auto"
              />
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
          {/* Twilio Warning */}
          {twilioNotConfigured && canSubmitForApproval && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay cuenta de Twilio/WhatsApp conectada. Configúrala desde el panel de administración para enviar plantillas a aprobación.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => handleSave(false)} 
              disabled={isLoading}
            >
              {isLoading && !submitForApproval.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar borrador
            </Button>
            {canSubmitForApproval && (
              <Button 
                onClick={() => handleSave(true)} 
                disabled={isLoading || hasMediaError || twilioNotConfigured}
                title={
                  twilioNotConfigured 
                    ? 'No hay cuenta de Twilio conectada' 
                    : hasMediaError 
                      ? 'Debes subir un archivo para el encabezado' 
                      : ''
                }
              >
                {submitForApproval.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Guardar y enviar a aprobación
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={invalidateConfirmOpen} onOpenChange={setInvalidateConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Invalidar la aprobación de WhatsApp?</AlertDialogTitle>
          <AlertDialogDescription>
            Editar una plantilla aprobada invalidará su estado y requerirá nueva aprobación
            por parte de WhatsApp. La plantilla pasará a borrador y deberá volver a enviarse
            a revisión antes de poder usarla.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              setInvalidateConfirmOpen(false);
              await performUpdate(pendingSubmitApproval, true);
            }}
          >
            Sí, editar e invalidar aprobación
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
