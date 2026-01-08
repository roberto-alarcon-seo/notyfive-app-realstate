import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Play, 
  Clock, 
  Lock, 
  Zap, 
  HandHelping, 
  Settings,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  MessageSquare,
  GripVertical,
  Trash2,
  FileText,
  Tag,
  StickyNote,
  AlertTriangle,
  UserCog,
  Webhook,
  CalendarClock,
  UserPen,
  Bot,
  BotOff,
  Tags,
  RefreshCw,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useAutomation,
  useCreateAutomation,
  useUpdateAutomation,
  type AutomationFormData,
  type AutomationAction,
  type AutomationActionType,
} from '@/hooks/useAutomations';
import { useTemplates } from '@/hooks/useTemplates';
import { useCustomFields } from '@/hooks/useCustomFields';
import { AutomationTemplates, type AutomationTemplate } from '@/components/automations/AutomationTemplates';
import { 
  TRIGGER_CATEGORIES, 
  TriggerSelector as TriggerSelectorInline,
  getTriggerSummary,
  isTriggerConfigValid 
} from '@/components/automations/TriggerSelector';
import { CONDITION_OPTIONS } from '@/components/automations/ConditionsSelector';
import { AutomationFlowSummary, getActionStepType, getStepTypeStyle } from '@/components/automations/AutomationFlowSummary';
import { AllActionsGrid } from '@/components/automations/SuggestedActions';
import { DelayActionEditor } from '@/components/automations/DelayActionEditor';

const DAYS_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

interface ActionOption {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  category: 'messaging' | 'contact' | 'workflow' | 'ai';
}

const ACTION_OPTIONS: ActionOption[] = [
  // Messaging
  { value: 'send_template', label: 'Enviar plantilla WhatsApp', icon: FileText, color: 'text-green-500 bg-green-500/10', category: 'messaging' },
  { value: 'send_message', label: 'Enviar mensaje de texto', icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', category: 'messaging' },
  // Contact
  { value: 'update_field', label: 'Actualizar campo', icon: UserPen, color: 'text-cyan-500 bg-cyan-500/10', category: 'contact' },
  { value: 'add_tag', label: 'Agregar tag', icon: Tag, color: 'text-purple-500 bg-purple-500/10', category: 'contact' },
  { value: 'remove_tag', label: 'Eliminar tag', icon: Tags, color: 'text-pink-500 bg-pink-500/10', category: 'contact' },
  { value: 'update_tag', label: 'Actualizar tag', icon: RefreshCw, color: 'text-indigo-500 bg-indigo-500/10', category: 'contact' },
  { value: 'create_note', label: 'Agregar nota', icon: StickyNote, color: 'text-yellow-500 bg-yellow-500/10', category: 'contact' },
  // Workflow
  { value: 'delay', label: 'Esperar', icon: Clock, color: 'text-amber-500 bg-amber-500/10', category: 'workflow' },
  { value: 'update_event_status', label: 'Cambiar estado evento', icon: Calendar, color: 'text-purple-500 bg-purple-500/10', category: 'workflow' },
  { value: 'create_followup', label: 'Crear seguimiento', icon: CalendarClock, color: 'text-teal-500 bg-teal-500/10', category: 'workflow' },
  { value: 'send_webhook', label: 'Enviar a webhook', icon: Webhook, color: 'text-rose-500 bg-rose-500/10', category: 'workflow' },
  // AI
  { value: 'pause_ai', label: 'Pausar IA', icon: BotOff, color: 'text-orange-500 bg-orange-500/10', category: 'ai' },
  { value: 'enable_ai', label: 'Activar IA', icon: Bot, color: 'text-emerald-500 bg-emerald-500/10', category: 'ai' },
  { value: 'escalate', label: 'Escalar a humano', icon: UserCog, color: 'text-red-500 bg-red-500/10', category: 'ai' },
];

const STANDARD_FIELDS = [
  { key: 'name', name: 'Nombre' },
  { key: 'email', name: 'Email' },
  { key: 'phone', name: 'Teléfono' },
  { key: 'status', name: 'Estado' },
  { key: 'country', name: 'País' },
  { key: 'notes', name: 'Notas' },
];

export default function AutomationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  // /automations/new does NOT provide an :id param, so treat missing id as "new"
  const isNew = !id || id === 'new';

  const [showTemplates, setShowTemplates] = useState(isNew);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [conditionsDialogOpen, setConditionsDialogOpen] = useState(false);
  const [actionsDialogOpen, setActionsDialogOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  
  const { data: automation, isLoading } = useAutomation(isNew ? null : id || null);
  const { data: templates } = useTemplates();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  
  const approvedTemplates = templates?.filter(t => t.approval_status === 'approved') || [];

  const [formData, setFormData] = useState<AutomationFormData>({
    name: '',
    description: '',
    status: 'draft',
    trigger_type: 'event.upcoming' as any,
    trigger_config: { hours_before: 24 },
    conditions: [],
    actions: [],
    rate_limits: { per_minute: 10, per_hour: 200, per_contact_day: 3 },
    cooldown_hours: 24,
    allowed_hours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5], timezone: 'America/Mexico_City' },
  });

  const [fallbackOption, setFallbackOption] = useState<'none' | 'reminder' | 'escalate'>('none');

  useEffect(() => {
    if (automation) {
      setFormData({
        name: automation.name,
        description: automation.description || '',
        status: automation.status,
        trigger_type: automation.trigger_type,
        trigger_config: automation.trigger_config || {},
        conditions: automation.conditions || [],
        actions: automation.actions || [],
        rate_limits: automation.rate_limits || { per_minute: 10, per_hour: 200, per_contact_day: 3 },
        cooldown_hours: automation.cooldown_hours || 24,
        allowed_hours: automation.allowed_hours || { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5], timezone: 'America/Mexico_City' },
      });
      setShowTemplates(false);
    }
  }, [automation]);

  const handleSelectTemplate = (template: AutomationTemplate) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      trigger_type: template.triggerType as any,
      trigger_config: template.triggerConfig,
      conditions: template.conditions,
      actions: template.actions as AutomationAction[],
    }));
    setShowTemplates(false);
  };

  const handleSave = async (activate = false) => {
    const data = { ...formData, status: activate ? 'active' as const : formData.status };
    if (isNew) {
      await createAutomation.mutateAsync(data);
    } else {
      await updateAutomation.mutateAsync({ id: id!, ...data });
    }
    navigate('/automations');
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      allowed_hours: {
        ...prev.allowed_hours,
        days: prev.allowed_hours.days.includes(day)
          ? prev.allowed_hours.days.filter(d => d !== day)
          : [...prev.allowed_hours.days, day].sort(),
      },
    }));
  };

  const toggleCondition = (conditionId: string) => {
    const condition = CONDITION_OPTIONS.find(c => c.id === conditionId);
    if (!condition) return;
    const isActive = formData.conditions.some(
      ac => ac.field === condition.field && ac.operator === condition.operator
    );
    if (isActive) {
      setFormData(prev => ({
        ...prev,
        conditions: prev.conditions.filter(
          ac => !(ac.field === condition.field && ac.operator === condition.operator)
        ),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        conditions: [
          ...prev.conditions,
          { field: condition.field, operator: condition.operator, value: condition.value },
        ],
      }));
    }
  };

  const addAction = (type: AutomationActionType) => {
    const newAction: AutomationAction = { id: crypto.randomUUID(), type, config: {} };
    setFormData(prev => ({ ...prev, actions: [...prev.actions, newAction] }));
    setActionsDialogOpen(false);
    setEditingActionIndex(formData.actions.length);
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === index ? { ...a, ...updates } : a)),
    }));
  };

  const removeAction = (index: number) => {
    setFormData(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }));
    setEditingActionIndex(null);
  };

  // Get current trigger info
  const allTriggers = TRIGGER_CATEGORIES.flatMap(c => c.triggers);
  const currentTrigger = allTriggers.find(t => t.value === formData.trigger_type);
  
  // Build dynamic subtitle using new helper
  const dynamicSubtitle = useMemo(() => {
    return `Se ejecuta ${getTriggerSummary(formData.trigger_type, formData.trigger_config).toLowerCase()}`;
  }, [formData.trigger_type, formData.trigger_config]);

  // Build conditions summary
  const conditionsSummary = useMemo(() => {
    if (formData.conditions.length === 0) return [];
    return formData.conditions.map(c => {
      const cond = CONDITION_OPTIONS.find(opt => opt.field === c.field && opt.operator === c.operator);
      return cond?.label.replace('Solo si ', '') || '';
    }).filter(Boolean);
  }, [formData.conditions]);

  const canSave = formData.name.trim().length > 0 && formData.actions.length > 0;

  if (isLoading && !isNew) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (showTemplates && isNew) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Nueva automatización</h1>
            <p className="text-sm text-muted-foreground">Elige una plantilla o comienza desde cero</p>
          </div>
        </div>
        <AutomationTemplates onSelect={handleSelectTemplate} />
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => setShowTemplates(false)}>
            Crear desde cero
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/automations')} className="mt-1 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="group relative">
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la automatización"
                className="text-xl font-semibold bg-transparent border border-dashed border-muted-foreground/30 hover:border-primary/50 focus:border-primary focus:bg-secondary/30 h-auto py-2 px-3 pr-10 rounded-lg transition-all"
              />
              <Edit3 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-hover:text-primary/70 transition-colors pointer-events-none" />
            </div>
            <p className="text-sm text-muted-foreground pl-1 truncate">{dynamicSubtitle || 'Configura el trigger para ver el resumen'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={!canSave || createAutomation.isPending || updateAutomation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Guardar borrador</span>
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={!canSave || createAutomation.isPending || updateAutomation.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Guardar y activar</span>
          </Button>
        </div>
      </div>

      {/* Main layout with sidebar summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* BLOQUE 1: CUÁNDO OCURRE */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
                <Clock className="h-4 w-4" />
                ¿Cuándo ocurre esto?
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{currentTrigger?.label || 'Selecciona un disparador'}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {getTriggerSummary(formData.trigger_type, formData.trigger_config)}
                    </p>
                  </div>
                </div>
                <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Edit3 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Cambiar disparador</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Selecciona el disparador</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      <TriggerSelectorInline
                        selectedTrigger={formData.trigger_type}
                        triggerConfig={formData.trigger_config}
                        onTriggerChange={(trigger) => setFormData(prev => ({ 
                          ...prev, 
                          trigger_type: trigger as any, 
                          trigger_config: {} 
                        }))}
                        onConfigChange={(config) => setFormData(prev => ({ 
                          ...prev, 
                          trigger_config: config 
                        }))}
                        onConfirm={() => setTriggerDialogOpen(false)}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* BLOQUE 2: CONDICIONES */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  Solo si se cumple lo siguiente
                </div>
                <Dialog open={conditionsDialogOpen} onOpenChange={setConditionsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Edit3 className="h-4 w-4 mr-2" />
                      Ajustar condiciones
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Condiciones</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                      {CONDITION_OPTIONS.filter(
                        c => !c.appliesToTriggers || c.appliesToTriggers.includes(formData.trigger_type) || !formData.trigger_type.startsWith('event.')
                      ).map((condition) => {
                        const Icon = condition.icon;
                        const isActive = formData.conditions.some(
                          ac => ac.field === condition.field && ac.operator === condition.operator
                        );
                        return (
                          <div
                            key={condition.id}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                              isActive ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30 hover:border-primary/50'
                            }`}
                            onClick={() => toggleCondition(condition.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{condition.label}</p>
                                <p className="text-xs text-muted-foreground">{condition.description}</p>
                              </div>
                            </div>
                            <Switch checked={isActive} />
                          </div>
                        );
                      })}

                      {/* Horario permitido */}
                      <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Horario permitido</Label>
                          <Switch
                            checked={formData.allowed_hours.days.length > 0}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                allowed_hours: { ...prev.allowed_hours, days: checked ? [1, 2, 3, 4, 5] : [] }
                              }));
                            }}
                          />
                        </div>
                        {formData.allowed_hours.days.length > 0 && (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {DAYS_OPTIONS.map((day) => (
                                <Badge
                                  key={day.value}
                                  variant={formData.allowed_hours.days.includes(day.value) ? 'default' : 'outline'}
                                  className="cursor-pointer"
                                  onClick={() => toggleDay(day.value)}
                                >
                                  {day.label}
                                </Badge>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Desde</Label>
                                <Input
                                  type="time"
                                  value={formData.allowed_hours.start}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    allowed_hours: { ...prev.allowed_hours, start: e.target.value }
                                  }))}
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Hasta</Label>
                                <Input
                                  type="time"
                                  value={formData.allowed_hours.end}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    allowed_hours: { ...prev.allowed_hours, end: e.target.value }
                                  }))}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {conditionsSummary.length > 0 || formData.allowed_hours.days.length > 0 ? (
                <ul className="text-sm text-foreground space-y-1 pl-1">
                  {conditionsSummary.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {c}
                    </li>
                  ))}
                  {formData.allowed_hours.days.length > 0 && (
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      Dentro del horario laboral ({formData.allowed_hours.start} - {formData.allowed_hours.end})
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin condiciones adicionales. Siempre se ejecutará.</p>
              )}
            </CardContent>
          </Card>

          {/* BLOQUE 3: QUÉ SUCEDE DESPUÉS (TIMELINE) */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  Qué sucede después
                </div>
                <Dialog open={actionsDialogOpen} onOpenChange={setActionsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar paso
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Agregar acción</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="mt-4">
                        <AllActionsGrid
                          triggerType={formData.trigger_type}
                          onSelectAction={addAction}
                        />
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

              {formData.actions.length > 0 ? (
                <div className="space-y-3">
                  {formData.actions.map((action, index) => {
                    const actionOption = ACTION_OPTIONS.find(o => o.value === action.type);
                    const ActionIcon = actionOption?.icon || MessageSquare;
                    const isEditing = editingActionIndex === index;
                    const stepType = getActionStepType(action, index, formData.actions.length);
                    const stepStyle = getStepTypeStyle(stepType);

                    return (
                      <div key={action.id} className="relative">
                        {/* Timeline connector */}
                        {index < formData.actions.length - 1 && (
                          <div className="absolute left-5 top-14 w-0.5 h-6 bg-border" />
                        )}
                        
                        <Card className={`border-border ${isEditing ? 'ring-1 ring-primary' : ''} ${
                          stepType === 'conditional' ? 'border-l-2 border-l-amber-500' :
                          stepType === 'fallback' ? 'border-l-2 border-l-orange-500' : ''
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                                <Badge variant="secondary" className="text-xs font-mono shrink-0">
                                  Paso {index + 1}
                                </Badge>
                                {/* Step type badge */}
                                {stepType !== 'normal' && (
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${stepStyle.badgeClass}`}>
                                    <stepStyle.icon className="h-3 w-3 mr-0.5" />
                                    {stepStyle.label}
                                  </Badge>
                                )}
                                <div className={`p-1.5 rounded-lg shrink-0 ${actionOption?.color || 'bg-muted'}`}>
                                  <ActionIcon className="h-4 w-4" />
                                </div>
                                <span className="font-medium text-foreground text-sm truncate">
                                  {getActionSummary(action, approvedTemplates)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditingActionIndex(isEditing ? null : index)}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => removeAction(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Inline editor */}
                            {isEditing && (
                              <div className="mt-4 pt-4 border-t border-border">
                                {action.type === 'send_template' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Plantilla</Label>
                                    <Select
                                      value={(action.config.template_id as string) || ''}
                                      onValueChange={(value) => updateAction(index, { config: { ...action.config, template_id: value } })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una plantilla" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {approvedTemplates.map((template) => (
                                          <SelectItem key={template.id} value={template.id}>
                                            {template.display_name || template.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {action.type === 'send_message' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Mensaje</Label>
                                    <Textarea
                                      value={(action.config.message as string) || ''}
                                      onChange={(e) => updateAction(index, { config: { ...action.config, message: e.target.value } })}
                                      placeholder="Escribe el mensaje..."
                                      rows={3}
                                    />
                                  </div>
                                )}

                                {action.type === 'delay' && (
                                  <DelayActionEditor
                                    action={action}
                                    index={index}
                                    updateAction={updateAction}
                                    triggerType={formData.trigger_type}
                                  />
                                )}

                                {action.type === 'update_event_status' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Nuevo estado</Label>
                                    <Select
                                      value={(action.config.new_status as string) || ''}
                                      onValueChange={(value) => updateAction(index, { config: { ...action.config, new_status: value } })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona el estado" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="confirmed">Confirmado</SelectItem>
                                        <SelectItem value="completed">Completado</SelectItem>
                                        <SelectItem value="canceled">Cancelado</SelectItem>
                                        <SelectItem value="no_show">No asistió</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {action.type === 'create_note' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Nota</Label>
                                    <Textarea
                                      value={(action.config.note as string) || ''}
                                      onChange={(e) => updateAction(index, { config: { ...action.config, note: e.target.value } })}
                                      placeholder="Texto de la nota..."
                                      rows={2}
                                    />
                                  </div>
                                )}

                                {action.type === 'pause_ai' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Razón (opcional)</Label>
                                    <Input
                                      value={(action.config.reason as string) || ''}
                                      onChange={(e) => updateAction(index, { config: { ...action.config, reason: e.target.value } })}
                                      placeholder="Ej: Cliente requiere atención personalizada"
                                    />
                                  </div>
                                )}

                                {action.type === 'enable_ai' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Razón (opcional)</Label>
                                    <Input
                                      value={(action.config.reason as string) || ''}
                                      onChange={(e) => updateAction(index, { config: { ...action.config, reason: e.target.value } })}
                                      placeholder="Ej: Flujo automatizado completado"
                                    />
                                  </div>
                                )}

                                {action.type === 'update_field' && (
                                  <ActionFieldEditor 
                                    action={action} 
                                    index={index} 
                                    updateAction={updateAction}
                                  />
                                )}

                                {action.type === 'add_tag' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Tag a agregar</Label>
                                    <Input
                                      value={(action.config.tag as string) || ''}
                                      onChange={(e) => updateAction(index, { config: { ...action.config, tag: e.target.value } })}
                                      placeholder="Ej: cliente_vip"
                                    />
                                  </div>
                                )}

                                {action.type === 'remove_tag' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Tag a eliminar</Label>
                                    <Input
                                      value={(action.config.tag as string) || ''}
                                      onChange={(e) => updateAction(index, { config: { ...action.config, tag: e.target.value } })}
                                      placeholder="Ej: lead_nuevo"
                                    />
                                  </div>
                                )}

                                {action.type === 'update_tag' && (
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Tag a reemplazar</Label>
                                      <Input
                                        value={(action.config.old_tag as string) || ''}
                                        onChange={(e) => updateAction(index, { config: { ...action.config, old_tag: e.target.value } })}
                                        placeholder="Ej: lead_nuevo"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Nuevo tag</Label>
                                      <Input
                                        value={(action.config.new_tag as string) || ''}
                                        onChange={(e) => updateAction(index, { config: { ...action.config, new_tag: e.target.value } })}
                                        placeholder="Ej: cliente_activo"
                                      />
                                    </div>
                                  </div>
                                )}

                                {action.type === 'send_webhook' && (
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">URL del webhook</Label>
                                      <Input
                                        value={(action.config.webhook_url as string) || ''}
                                        onChange={(e) => updateAction(index, { config: { ...action.config, webhook_url: e.target.value } })}
                                        placeholder="https://tu-servidor.com/webhook"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Datos a incluir</Label>
                                      <div className="grid grid-cols-2 gap-2">
                                        {[
                                          { key: 'include_contact_info', label: 'Info contacto' },
                                          { key: 'include_custom_fields', label: 'Campos personalizados' },
                                          { key: 'include_tags', label: 'Tags' },
                                          { key: 'include_conversation', label: 'Conversación' },
                                        ].map((option) => (
                                          <label key={option.key} className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={(action.config[option.key] as boolean) ?? true}
                                              onChange={(e) => updateAction(index, { config: { ...action.config, [option.key]: e.target.checked } })}
                                              className="rounded border-border"
                                            />
                                            {option.label}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {action.type === 'create_followup' && (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Programar en</Label>
                                        <Input
                                          type="number"
                                          value={(action.config.delay_value as number) || 1}
                                          onChange={(e) => updateAction(index, { config: { ...action.config, delay_value: parseInt(e.target.value) || 1 } })}
                                          className="w-20"
                                          min={1}
                                        />
                                      </div>
                                      <div className="space-y-2 flex-1">
                                        <Label className="text-xs text-muted-foreground">Unidad</Label>
                                        <Select
                                          value={(action.config.delay_unit as string) || 'days'}
                                          onValueChange={(value) => updateAction(index, { config: { ...action.config, delay_unit: value } })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="hours">Horas</SelectItem>
                                            <SelectItem value="days">Días</SelectItem>
                                            <SelectItem value="weeks">Semanas</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Nota del seguimiento</Label>
                                      <Textarea
                                        value={(action.config.followup_note as string) || ''}
                                        onChange={(e) => updateAction(index, { config: { ...action.config, followup_note: e.target.value } })}
                                        placeholder="Ej: Hacer seguimiento de propuesta"
                                        rows={2}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Agrega al menos una acción</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setActionsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar paso
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BLOQUE 4: SI NADIE RESPONDE */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
                <HandHelping className="h-4 w-4" />
                ¿Qué pasa si nadie responde?
              </div>
              
              <RadioGroup value={fallbackOption} onValueChange={(v) => setFallbackOption(v as any)} className="space-y-2">
                <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${fallbackOption === 'none' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="none" id="fallback-none" />
                  <Label htmlFor="fallback-none" className="cursor-pointer flex-1">
                    <p className="font-medium text-foreground">No hacer nada</p>
                    <p className="text-xs text-muted-foreground">La automatización termina normalmente</p>
                  </Label>
                </div>
                <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${fallbackOption === 'reminder' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="reminder" id="fallback-reminder" />
                  <Label htmlFor="fallback-reminder" className="cursor-pointer flex-1">
                    <p className="font-medium text-foreground">Enviar último recordatorio</p>
                    <p className="text-xs text-muted-foreground">Envía un mensaje adicional antes de terminar</p>
                  </Label>
                </div>
                <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${fallbackOption === 'escalate' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="escalate" id="fallback-escalate" />
                  <Label htmlFor="fallback-escalate" className="cursor-pointer flex-1">
                    <p className="font-medium text-foreground">Escalar a humano y pausar IA</p>
                    <p className="text-xs text-muted-foreground">Marca la conversación para atención manual</p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* BLOQUE 5: CONFIGURACIÓN AVANZADA */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card className="border-border">
              <CardContent className="p-5">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Settings className="h-4 w-4" />
                      Configuración avanzada
                    </div>
                    {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Estas opciones evitan saturar a tus contactos.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Máx. por minuto</Label>
                      <Input
                        type="number"
                        value={formData.rate_limits.per_minute}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rate_limits: { ...prev.rate_limits, per_minute: parseInt(e.target.value) || 10 }
                        }))}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Máx. por hora</Label>
                      <Input
                        type="number"
                        value={formData.rate_limits.per_hour}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rate_limits: { ...prev.rate_limits, per_hour: parseInt(e.target.value) || 200 }
                        }))}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Máx. por contacto/día</Label>
                      <Input
                        type="number"
                        value={formData.rate_limits.per_contact_day}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rate_limits: { ...prev.rate_limits, per_contact_day: parseInt(e.target.value) || 3 }
                        }))}
                        min={1}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Cooldown (horas antes de volver a ejecutar para el mismo contacto)</Label>
                    <Input
                      type="number"
                      value={formData.cooldown_hours || 24}
                      onChange={(e) => setFormData(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value) || 24 }))}
                      className="w-32"
                      min={0}
                    />
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        </div>

        {/* Right column - Summary (sticky) */}
        <div className="lg:col-span-1">
          <AutomationFlowSummary
            triggerType={formData.trigger_type}
            triggerConfig={formData.trigger_config}
            conditions={formData.conditions}
            actions={formData.actions}
            templates={approvedTemplates}
            allowedHours={formData.allowed_hours}
            fallbackOption={fallbackOption}
          />
        </div>
      </div>
    </div>
  );
}

// Helper component for update_field action
function ActionFieldEditor({ 
  action, 
  index, 
  updateAction 
}: { 
  action: AutomationAction; 
  index: number; 
  updateAction: (index: number, updates: Partial<AutomationAction>) => void;
}) {
  const { customFields, fetchCustomFields } = useCustomFields();
  
  useEffect(() => {
    fetchCustomFields();
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Operación</Label>
          <Select
            value={(action.config.operation as string) || 'set'}
            onValueChange={(value) => updateAction(index, { config: { ...action.config, operation: value } })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set">Establecer valor</SelectItem>
              <SelectItem value="clear">Eliminar valor</SelectItem>
              <SelectItem value="append">Agregar al final</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Campo</Label>
          <Select
            value={(action.config.field_key as string) || ''}
            onValueChange={(value) => {
              const std = STANDARD_FIELDS.find(f => f.key === value);
              const custom = customFields.find(f => f.key === value);
              updateAction(index, { 
                config: { 
                  ...action.config, 
                  field_key: value,
                  field_label: std?.name || custom?.name || value,
                  is_custom_field: !!custom,
                } 
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">Campos estándar</SelectLabel>
                {STANDARD_FIELDS.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {customFields.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground">Campos personalizados</SelectLabel>
                  {customFields.map((field) => (
                    <SelectItem key={field.id} value={field.key}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      {action.config.operation !== 'clear' && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Nuevo valor</Label>
          <Input
            value={(action.config.value as string) || ''}
            onChange={(e) => updateAction(index, { config: { ...action.config, value: e.target.value } })}
            placeholder="Valor (puedes usar {{variables}})"
          />
        </div>
      )}
    </div>
  );
}

// Helper function to get action summary text
function getActionSummary(action: AutomationAction, templates: any[]): string {
  switch (action.type) {
    case 'send_template': {
      const templateId = action.config.template_id as string;
      const template = templates.find(t => t.id === templateId);
      return template ? `Enviar plantilla "${template.display_name || template.name}"` : 'Enviar plantilla WhatsApp';
    }
    case 'send_message': {
      const msg = (action.config.message as string) || '';
      return msg ? `Enviar mensaje: "${msg.slice(0, 30)}${msg.length > 30 ? '...' : ''}"` : 'Enviar mensaje de texto';
    }
    case 'delay': {
      const waitMode = action.config.wait_mode as string;
      if (waitMode === 'until_event') {
        const conditions: string[] = [];
        if (action.config.wait_for_response) conditions.push('respuesta');
        if (action.config.wait_for_event) conditions.push('evento');
        if (action.config.wait_for_window_expire) conditions.push('ventana');
        const maxWait = action.config.max_wait_value ? 
          ` (máx ${action.config.max_wait_value}${action.config.max_wait_unit === 'hours' ? 'h' : action.config.max_wait_unit === 'days' ? 'd' : 'm'})` : '';
        return `Esperar hasta ${conditions.join('/')}${maxWait}`;
      }
      const value = (action.config.value as number) || 5;
      const unit = (action.config.unit as string) === 'hours' ? 'horas' : (action.config.unit as string) === 'days' ? 'días' : 'minutos';
      return `Esperar ${value} ${unit}`;
    }
    case 'update_event_status': {
      const status = action.config.new_status as string;
      const labels: Record<string, string> = { confirmed: 'Confirmado', completed: 'Completado', canceled: 'Cancelado', no_show: 'No asistió' };
      return `Cambiar estado a "${labels[status] || status || '...'}"`;
    }
    case 'create_note':
      return 'Agregar nota al contacto';
    case 'pause_ai':
      return 'Pausar IA en conversación';
    case 'enable_ai':
      return 'Activar IA en conversación';
    case 'escalate':
      return 'Escalar a humano';
    case 'update_field': {
      const fieldLabel = (action.config.field_label as string) || (action.config.field_key as string);
      const operation = action.config.operation as string;
      if (operation === 'clear') return `Eliminar valor de "${fieldLabel || 'campo'}"`;
      if (operation === 'append') return `Agregar a "${fieldLabel || 'campo'}"`;
      return `Actualizar "${fieldLabel || 'campo'}"`;
    }
    case 'add_tag': {
      const tag = action.config.tag as string;
      return tag ? `Agregar tag "${tag}"` : 'Agregar tag';
    }
    case 'remove_tag': {
      const tag = action.config.tag as string;
      return tag ? `Eliminar tag "${tag}"` : 'Eliminar tag';
    }
    case 'update_tag': {
      const oldTag = action.config.old_tag as string;
      const newTag = action.config.new_tag as string;
      if (oldTag && newTag) return `Cambiar tag "${oldTag}" → "${newTag}"`;
      return 'Actualizar tag';
    }
    case 'send_webhook': {
      const url = action.config.webhook_url as string;
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          return `Enviar a ${hostname}`;
        } catch {
          return 'Enviar a webhook';
        }
      }
      return 'Enviar a webhook';
    }
    case 'create_followup': {
      const delayValue = (action.config.delay_value as number) || 1;
      const delayUnit = (action.config.delay_unit as string) || 'days';
      const unitLabels: Record<string, string> = { hours: 'horas', days: 'días', weeks: 'semanas' };
      return `Seguimiento en ${delayValue} ${unitLabels[delayUnit] || delayUnit}`;
    }
    default:
      return action.type;
  }
}
