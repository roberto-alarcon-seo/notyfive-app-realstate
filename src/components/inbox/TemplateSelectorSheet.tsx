import { useState, useMemo } from "react";
import { Search, FileText, Image, Video, File, Clock, Loader2, X, AlertTriangle, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTemplates, Template, extractVariables } from "@/hooks/useTemplates";
import { isOutOfWindow } from "@/hooks/useSendMessage";

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  country?: string;
}

interface TemplateSelectorSheetProps {
  open: boolean;
  onClose: () => void;
  contact: Contact | null;
  lastCustomerMessageAt: string | null;
  onSendTemplate: (templateId: string, variables: Record<string, string>) => void;
  isSending?: boolean;
}

export function TemplateSelectorSheet({
  open,
  onClose,
  contact,
  lastCustomerMessageAt,
  onSendTemplate,
  isSending = false,
}: TemplateSelectorSheetProps) {
  const { data: templates, isLoading } = useTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Filter only approved templates
  const approvedTemplates = useMemo(() => {
    return (templates || []).filter(t => t.approval_status === 'approved');
  }, [templates]);

  // Apply search and category filters
  const filteredTemplates = useMemo(() => {
    return approvedTemplates.filter(t => {
      const matchesSearch = !searchQuery || 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.label?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = !categoryFilter || t.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [approvedTemplates, searchQuery, categoryFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(approvedTemplates.map(t => t.category));
    return Array.from(cats);
  }, [approvedTemplates]);

  // Auto-fill variables with contact data
  const initializeVariables = (template: Template) => {
    const vars = template.variables || [];
    const values: Record<string, string> = {};
    
    vars.forEach(variable => {
      const varLower = variable.toLowerCase();
      
      if (varLower === 'nombre' || varLower === 'name') {
        values[variable] = contact?.name || '';
      } else if (varLower === 'email' || varLower === 'correo') {
        values[variable] = contact?.email || '';
      } else if (varLower === 'telefono' || varLower === 'phone') {
        values[variable] = contact?.phone || '';
      } else if (varLower === 'pais' || varLower === 'country') {
        values[variable] = contact?.country || '';
      } else {
        values[variable] = '';
      }
    });
    
    return values;
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setVariableValues(initializeVariables(template));
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setVariableValues({});
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    onSendTemplate(selectedTemplate.id, variableValues);
  };

  // Check if all required variables are filled
  const allVariablesFilled = useMemo(() => {
    if (!selectedTemplate) return true;
    const vars = selectedTemplate.variables || [];
    return vars.every(v => variableValues[v]?.trim());
  }, [selectedTemplate, variableValues]);

  // Preview body with variables replaced
  const previewBody = useMemo(() => {
    if (!selectedTemplate) return '';
    let body = selectedTemplate.body;
    
    Object.entries(variableValues).forEach(([key, value]) => {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    });
    
    return body;
  }, [selectedTemplate, variableValues]);

  const outOfWindow = isOutOfWindow(lastCustomerMessageAt);

  const getMediaIcon = (headerType: string) => {
    switch (headerType) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'document': return <File className="h-4 w-4" />;
      default: return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      marketing: 'Marketing',
      utility: 'Utilidad',
      authentication: 'Autenticación',
    };
    return labels[category] || category;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {selectedTemplate && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="flex-1">
              {selectedTemplate ? 'Completar variables' : 'Seleccionar plantilla'}
            </SheetTitle>
          </div>
        </SheetHeader>

        {!selectedTemplate ? (
          // Template List View
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search and filters */}
            <div className="p-4 space-y-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar plantilla..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={categoryFilter === null ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCategoryFilter(null)}
                  >
                    Todas
                  </Badge>
                  {categories.map(cat => (
                    <Badge
                      key={cat}
                      variant={categoryFilter === cat ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {getCategoryLabel(cat)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Out of window indicator */}
            {outOfWindow && (
              <div className="px-4 py-2 bg-warning/10 border-b border-warning/20">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <Clock className="h-4 w-4" />
                  <span>Fuera de ventana 24h - Solo plantillas disponibles</span>
                </div>
              </div>
            )}

            {/* Template list */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No hay plantillas aprobadas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crea y aprueba plantillas en el módulo de Plantillas
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        "p-4 rounded-lg border border-border cursor-pointer transition-colors",
                        "hover:bg-muted/50 hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground truncate">{template.name}</h4>
                            {getMediaIcon(template.header_type)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.body}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {getCategoryLabel(template.category)}
                            </Badge>
                            {template.label && (
                              <Badge variant="outline" className="text-xs">
                                {template.label}
                              </Badge>
                            )}
                            {template.variables.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {template.variables.length} variable{template.variables.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          // Variable Editor View
          <div className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {/* Template info */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-foreground mb-1">{selectedTemplate.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryLabel(selectedTemplate.category)}
                  </Badge>
                </div>

                {/* Variables form */}
                {selectedTemplate.variables.length > 0 && (
                  <div className="space-y-4">
                    <h5 className="font-medium text-foreground text-sm">Variables</h5>
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable} className="space-y-1.5">
                        <Label htmlFor={`var-${variable}`} className="text-sm">
                          {variable} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`var-${variable}`}
                          value={variableValues[variable] || ''}
                          onChange={(e) => setVariableValues(prev => ({
                            ...prev,
                            [variable]: e.target.value
                          }))}
                          placeholder={`Valor para {{${variable}}}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                <div className="space-y-2">
                  <h5 className="font-medium text-foreground text-sm">Vista previa</h5>
                  <div className="p-4 rounded-lg bg-message-outgoing text-white">
                    {/* Media preview */}
                    {selectedTemplate.header_type === 'image' && selectedTemplate.media_url && (
                      <img 
                        src={selectedTemplate.media_url} 
                        alt="Header" 
                        className="max-w-full rounded-lg mb-2"
                      />
                    )}
                    {selectedTemplate.header_type === 'video' && (
                      <div className="aspect-video bg-background/50 rounded-lg mb-2 flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {selectedTemplate.header_type === 'document' && (
                      <div className="flex items-center gap-2 p-3 bg-background/50 rounded-lg mb-2">
                        <File className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm truncate">{selectedTemplate.media_filename || 'Documento'}</span>
                      </div>
                    )}
                    
                    {/* Header text */}
                    {selectedTemplate.header_type === 'text' && selectedTemplate.header_text && (
                      <p className="font-medium text-white mb-2">{selectedTemplate.header_text}</p>
                    )}
                    
                    {/* Body */}
                    <p className="text-sm text-white whitespace-pre-line">{previewBody}</p>
                    
                    {/* Footer */}
                    {selectedTemplate.footer && (
                      <p className="text-xs text-white/70 mt-2">{selectedTemplate.footer}</p>
                    )}
                  </div>
                </div>

                {/* Validation warning */}
                {!allVariablesFilled && (
                  <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Completa todas las variables para enviar</span>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Send button */}
            <div className="p-4 border-t border-border">
              <Button
                className="w-full"
                onClick={handleSend}
                disabled={!allVariablesFilled || isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar plantilla
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
