import { useState } from "react";
import { Search, Plus, FileText, MoreHorizontal, Copy, Eye, RefreshCw, CheckCircle2, Clock, XCircle, Trash2, Pencil, Send, AlertTriangle, Loader2, Sparkles, User, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTemplates, useDeleteTemplate, useDuplicateTemplate, useSubmitTemplateForApproval, useSyncTemplates, useTwilioStatus, Template } from "@/hooks/useTemplates";
import { useForceApproveTemplate } from "@/hooks/useForceApproveTemplate";
import { TemplateFormDialog } from "@/components/templates/TemplateFormDialog";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { PremiumGate } from "@/components/settings/PremiumGate";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig = {
  approved: { 
    label: "Aprobada", 
    className: "bg-success/10 text-success",
    icon: CheckCircle2,
    canSend: true
  },
  pending: { 
    label: "En revisión", 
    className: "bg-warning/10 text-warning",
    icon: Clock,
    canSend: false
  },
  rejected: { 
    label: "Rechazada", 
    className: "bg-destructive/10 text-destructive",
    icon: XCircle,
    canSend: false
  },
  draft: { 
    label: "Borrador", 
    className: "bg-muted text-muted-foreground",
    icon: FileText,
    canSend: false
  },
};

export default function Templates() {
  const { tenantRole, isSuperAdmin } = useAuth();
  const { enabled: customTemplatesEnabled } = useFeatureFlag('custom_templates_management');
  // Role-based gating (RBAC) AND feature-flag gating ('custom_templates_management').
  // Both must be true for tenant users to CRUD templates. Super admin always can.
  const hasManageRole =
    isSuperAdmin || tenantRole === 'administrador' || tenantRole === 'manager';
  const canManage = isSuperAdmin || (hasManageRole && customTemplatesEnabled);
  const { data: templates = [], isLoading } = useTemplates();
  const { data: twilioStatus } = useTwilioStatus();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  const submitForApproval = useSubmitTemplateForApproval();
  const syncTemplates = useSyncTemplates();
  const forceApprove = useForceApproveTemplate();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };
  
  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };
  
  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (templateToDelete) {
      await deleteTemplate.mutateAsync(templateToDelete.id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };
  
  const handleDuplicate = async (template: Template) => {
    await duplicateTemplate.mutateAsync(template);
  };
  
  const handleSubmitForApproval = async (template: Template) => {
    setSubmittingId(template.id);
    try {
      await submitForApproval.mutateAsync(template.id);
    } finally {
      setSubmittingId(null);
    }
  };
  
  const handleSync = async () => {
    await syncTemplates.mutateAsync();
  };
  
  const canSubmitToTwilio = twilioStatus?.connected && twilioStatus?.hasPhone;

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.label && t.label.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSource = sourceFilter === 'all' || 
      (sourceFilter === 'ai' && t.created_source === 'ai') ||
      (sourceFilter === 'manual' && t.created_source === 'manual');
    
    return matchesSearch && matchesSource;
  });

  const aiCount = templates.filter(t => t.created_source === 'ai').length;
  const manualCount = templates.filter(t => t.created_source === 'manual').length;

  const approvedCount = templates.filter(t => t.approval_status === 'approved').length;
  const pendingCount = templates.filter(t => t.approval_status === 'pending').length;
  const rejectedCount = templates.filter(t => t.approval_status === 'rejected').length;

  return (
    <SettingsLayout
      title="Librería de Plantillas"
      description="Gestiona tus plantillas de mensajes aprobadas por WhatsApp"
      icon={FileText}
    >
      <PremiumGate
        requiredFlags={["templates_library"]}
        featureName="Librería de Plantillas"
        description="Activa este módulo para crear, gestionar y aprobar plantillas de WhatsApp HSM. Contacta a ventas o actualiza tu plan para habilitarlo."
      >
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div />
        <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncTemplates.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncTemplates.isPending ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            {hasManageRole && customTemplatesEnabled && (
              <Button onClick={handleNewTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva plantilla
              </Button>
            )}
            {hasManageRole && !customTemplatesEnabled && !isSuperAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled variant="outline">
                        <Sparkles className="w-4 h-4 mr-2 text-primary" />
                        Nueva plantilla · Pro
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Función Pro: contacta a soporte para habilitar la gestión de plantillas personalizadas.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

        {/* Stats, Filters and Search */}
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar plantillas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            {/* Source Filter */}
            <ToggleGroup 
              type="single" 
              value={sourceFilter} 
              onValueChange={(v) => v && setSourceFilter(v)}
              className="bg-muted/50 rounded-lg p-1"
            >
              <ToggleGroupItem value="all" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                Todas ({templates.length})
              </ToggleGroupItem>
              <ToggleGroupItem value="ai" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                <Sparkles className="w-3 h-3 mr-1" />
                IA ({aiCount})
              </ToggleGroupItem>
              <ToggleGroupItem value="manual" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                <User className="w-3 h-3 mr-1" />
                Manual ({manualCount})
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">{approvedCount} aprobadas</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-muted-foreground">{pendingCount} en revisión</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">{rejectedCount} rechazadas</span>
            </div>
          </div>
        </div>

      {/* Info Banner */}
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Envío solo con plantillas aprobadas</p>
            <p className="text-sm text-muted-foreground">
              Solo puedes enviar mensajes usando plantillas con estado "Aprobada" y con saldo disponible en tu wallet.
              Las plantillas en revisión o rechazadas no pueden usarse para campañas.
            </p>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-xl border p-5">
                <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/4 mb-3" />
                <Skeleton className="h-16 w-full mb-4" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              {searchQuery ? 'No se encontraron plantillas' : 'Sin plantillas'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery 
                ? 'Prueba con otros términos de búsqueda' 
                : 'Crea tu primera plantilla para empezar a enviar mensajes'}
            </p>
            {!searchQuery && canManage && (
              <Button onClick={handleNewTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Crear plantilla
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const status = statusConfig[template.approval_status];
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={template.id}
                  className={`bg-card rounded-xl border p-5 transition-all duration-300 group ${
                    status.canSend ? 'border-border hover:border-primary/30' : 'border-border/50 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      status.canSend ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <FileText className={`w-5 h-5 ${status.canSend ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewTemplate(template)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Vista previa
                        </DropdownMenuItem>
                        {canManage && (
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                        )}
                        {canManage && (template.approval_status === 'draft' || template.approval_status === 'rejected') && canSubmitToTwilio && (
                          <DropdownMenuItem 
                            onClick={() => handleSubmitForApproval(template)}
                            disabled={submittingId === template.id}
                          >
                            {submittingId === template.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4 mr-2" />
                            )}
                            Enviar a aprobación
                          </DropdownMenuItem>
                        )}
                        {isSuperAdmin && template.approval_status === 'pending' && (
                          <DropdownMenuItem 
                            onClick={() => forceApprove.mutate(template.id)}
                            disabled={forceApprove.isPending}
                          >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Marcar como aprobada
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuSeparator />
                            {/* System templates can only be deleted when the tenant has the
                                premium 'custom_templates_management' flag (or super admin).
                                Otherwise, keep the predefined library intact. */}
                            {template.is_system && !customTemplatesEnabled && !isSuperAdmin ? (
                              <DropdownMenuItem disabled className="text-muted-foreground">
                                <Lock className="w-4 h-4 mr-2" />
                                Plantilla del sistema
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteClick(template)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate" title={template.display_name || template.name}>
                        {template.display_name || template.name}
                      </h3>
                      {/* Source Badge */}
                      {template.created_source === 'ai' ? (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0">
                          <Sparkles className="w-3 h-3 mr-1" />
                          IA
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground shrink-0">
                          <User className="w-3 h-3 mr-1" />
                          Manual
                        </Badge>
                      )}
                      {/* System Badge: predefined templates seeded automatically per tenant */}
                      {template.is_system && (
                        <Badge variant="outline" className="text-xs bg-accent/15 text-accent border-accent/30 shrink-0">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Sistema
                        </Badge>
                      )}
                    </div>
                    {/* Show snake_case name below if display_name exists */}
                    {template.display_name && (
                      <p className="text-xs text-muted-foreground font-mono mb-2 truncate" title={template.name}>
                        {template.name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs capitalize">{template.category}</Badge>
                      {template.label && (
                        <Badge variant="secondary" className="text-xs">{template.label}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{template.body}</p>
                  </div>

                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.variables.map((variable) => (
                        <span
                          key={variable}
                          className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent"
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Twilio SID */}
                  {template.twilio_template_sid && (
                    <div className="mb-3 px-2 py-1.5 bg-muted/50 rounded text-xs font-mono text-muted-foreground truncate">
                      SID: {template.twilio_template_sid}
                    </div>
                  )}

                  {/* Rejection reason */}
                  {template.approval_status === 'rejected' && template.rejection_reason && (
                    <div className="mb-3 px-2 py-1.5 bg-destructive/10 rounded text-xs text-destructive">
                      {template.rejection_reason}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${status.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {template.used_count > 0 ? `Usada ${template.used_count} veces` : 'Sin usar'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Form Dialog */}
      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla "{templateToDelete?.name}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate?.name}
              {previewTemplate?.created_source === 'ai' && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Creada por IA
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <TemplatePreview
                headerType={previewTemplate.header_type}
                headerText={previewTemplate.header_text || undefined}
                body={previewTemplate.body}
                footer={previewTemplate.footer || undefined}
                buttons={previewTemplate.buttons}
              />
              
              {/* Source info */}
              <div className="pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origen:</span>
                  <span className="font-medium">
                    {previewTemplate.created_source === 'ai' ? 'Inteligencia Artificial' : 'Creación manual'}
                  </span>
                </div>
                {previewTemplate.created_by_module && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Módulo:</span>
                    <span className="font-medium capitalize">
                      {previewTemplate.created_by_module === 'campaign_ai' ? 'Asistente de campañas' : 
                       previewTemplate.created_by_module === 'templates' ? 'Plantillas' : 
                       previewTemplate.created_by_module}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
      </PremiumGate>
    </SettingsLayout>
  );
}
