import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Zap, 
  Clock, 
  AlertCircle,
  MessageSquare,
  FileText,
  Tag,
  StickyNote,
  Calendar,
  UserCog,
  Webhook,
  CalendarClock,
  UserPen,
  Bot,
  BotOff,
  Tags,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { type AutomationAction } from '@/hooks/useAutomations';
import { getTriggerSummary, TRIGGER_CATEGORIES } from './TriggerSelector';
import { CONDITION_OPTIONS } from './ConditionsSelector';

interface AutomationFlowSummaryProps {
  triggerType: string;
  triggerConfig: Record<string, any>;
  conditions: Array<{ field: string; operator: string; value?: any }>;
  actions: AutomationAction[];
  templates: any[];
  allowedHours?: { start: string; end: string; days: number[] };
  fallbackOption: 'none' | 'reminder' | 'escalate';
}

// Determine action step type for visual styling
export function getActionStepType(action: AutomationAction, index: number, totalActions: number): 'normal' | 'conditional' | 'fallback' {
  // Delay/wait actions are conditional
  if (action.type === 'delay') {
    const waitMode = action.config.wait_mode as string;
    if (waitMode === 'until_event') return 'conditional';
    return 'conditional';
  }
  
  // Escalate and pause_ai at the end are typically fallback
  if ((action.type === 'escalate' || action.type === 'pause_ai') && index === totalActions - 1) {
    return 'fallback';
  }
  
  return 'normal';
}

// Get step type styling
export function getStepTypeStyle(stepType: 'normal' | 'conditional' | 'fallback') {
  switch (stepType) {
    case 'conditional':
      return {
        badgeVariant: 'outline' as const,
        badgeClass: 'border-amber-500/50 text-amber-600 bg-amber-500/10',
        icon: Timer,
        label: 'Condicional',
      };
    case 'fallback':
      return {
        badgeVariant: 'outline' as const,
        badgeClass: 'border-orange-500/50 text-orange-600 bg-orange-500/10',
        icon: AlertCircle,
        label: 'Fallback',
      };
    default:
      return {
        badgeVariant: 'secondary' as const,
        badgeClass: '',
        icon: Zap,
        label: '',
      };
  }
}

// Get action icon
function getActionIcon(actionType: string) {
  const icons: Record<string, any> = {
    send_template: FileText,
    send_message: MessageSquare,
    delay: Clock,
    update_event_status: Calendar,
    create_note: StickyNote,
    pause_ai: BotOff,
    enable_ai: Bot,
    escalate: UserCog,
    update_field: UserPen,
    add_tag: Tag,
    remove_tag: Tags,
    update_tag: RefreshCw,
    send_webhook: Webhook,
    create_followup: CalendarClock,
  };
  return icons[actionType] || Zap;
}

// Generate human-readable action description
function getActionDescription(action: AutomationAction, templates: any[]): string {
  switch (action.type) {
    case 'send_template': {
      const templateId = action.config.template_id as string;
      const template = templates.find(t => t.id === templateId);
      return `Se envía la plantilla "${template?.display_name || template?.name || 'plantilla'}"`;
    }
    case 'send_message': {
      const msg = (action.config.message as string) || '';
      return msg ? `Se envía un mensaje de texto` : 'Se envía un mensaje';
    }
    case 'delay': {
      const waitMode = action.config.wait_mode as string;
      if (waitMode === 'until_event') {
        const conditions: string[] = [];
        if (action.config.wait_for_response) conditions.push('el cliente responda');
        if (action.config.wait_for_event) conditions.push('ocurra el evento');
        if (action.config.wait_for_window_expire) conditions.push('expire la ventana de WhatsApp');
        const maxWait = action.config.max_wait_value ? 
          `o hasta ${action.config.max_wait_value} ${action.config.max_wait_unit === 'hours' ? 'horas' : action.config.max_wait_unit === 'days' ? 'días' : 'minutos'} como máximo` : '';
        if (conditions.length > 0) {
          return `Se espera hasta que ${conditions.join(' o ')}${maxWait ? ' ' + maxWait : ''}`;
        }
        return 'Se espera hasta que ocurra algo';
      }
      const value = (action.config.value as number) || 5;
      const unit = (action.config.unit as string) === 'hours' ? 'horas' : (action.config.unit as string) === 'days' ? 'días' : 'minutos';
      return `Se espera ${value} ${unit}`;
    }
    case 'update_event_status': {
      const status = action.config.new_status as string;
      const labels: Record<string, string> = { confirmed: 'Confirmado', completed: 'Completado', canceled: 'Cancelado', no_show: 'No asistió' };
      return `Se cambia el estado del evento a "${labels[status] || status}"`;
    }
    case 'create_note':
      return 'Se agrega una nota al contacto';
    case 'pause_ai':
      return 'Se pausa la IA en la conversación';
    case 'enable_ai':
      return 'Se activa la IA en la conversación';
    case 'escalate':
      return 'Se escala a un humano';
    case 'update_field': {
      const fieldLabel = (action.config.field_label as string) || (action.config.field_key as string) || 'campo';
      const operation = action.config.operation as string;
      if (operation === 'clear') return `Se elimina el valor de "${fieldLabel}"`;
      if (operation === 'append') return `Se agrega información a "${fieldLabel}"`;
      return `Se actualiza el campo "${fieldLabel}"`;
    }
    case 'add_tag': {
      const tag = action.config.tag as string;
      return tag ? `Se agrega el tag "${tag}"` : 'Se agrega un tag';
    }
    case 'remove_tag': {
      const tag = action.config.tag as string;
      return tag ? `Se elimina el tag "${tag}"` : 'Se elimina un tag';
    }
    case 'update_tag': {
      const oldTag = action.config.old_tag as string;
      const newTag = action.config.new_tag as string;
      if (oldTag && newTag) return `Se cambia el tag "${oldTag}" por "${newTag}"`;
      return 'Se actualiza un tag';
    }
    case 'send_webhook': {
      return 'Se envía información a un webhook externo';
    }
    case 'create_followup': {
      const delayValue = (action.config.delay_value as number) || 1;
      const delayUnit = (action.config.delay_unit as string) || 'days';
      const unitLabels: Record<string, string> = { hours: 'horas', days: 'días', weeks: 'semanas' };
      return `Se crea un seguimiento para ${delayValue} ${unitLabels[delayUnit]}`;
    }
    default:
      return action.type;
  }
}

export function AutomationFlowSummary({
  triggerType,
  triggerConfig,
  conditions,
  actions,
  templates,
  allowedHours,
  fallbackOption,
}: AutomationFlowSummaryProps) {
  const allTriggers = TRIGGER_CATEGORIES.flatMap(c => c.triggers);
  const currentTrigger = allTriggers.find(t => t.value === triggerType);
  
  const triggerSummary = useMemo(() => {
    return getTriggerSummary(triggerType, triggerConfig);
  }, [triggerType, triggerConfig]);
  
  const conditionsSummary = useMemo(() => {
    const result: string[] = [];
    conditions.forEach(c => {
      const cond = CONDITION_OPTIONS.find(opt => opt.field === c.field && opt.operator === c.operator);
      if (cond) {
        result.push(cond.label.replace('Solo si ', ''));
      }
    });
    if (allowedHours && allowedHours.days.length > 0) {
      result.push(`Dentro del horario ${allowedHours.start} - ${allowedHours.end}`);
    }
    return result;
  }, [conditions, allowedHours]);

  const fallbackText = useMemo(() => {
    switch (fallbackOption) {
      case 'reminder':
        return 'Si no hay respuesta, se envía un último recordatorio';
      case 'escalate':
        return 'Si no hay respuesta, se escala a un humano';
      default:
        return null;
    }
  }, [fallbackOption]);

  if (!currentTrigger && actions.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent sticky top-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">Resumen de la automatización</span>
        </div>
        
        <div className="space-y-4 text-sm">
          {/* Trigger */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bell className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Este flujo se ejecuta cuando</span>
            </div>
            <p className="text-foreground pl-5">{triggerSummary}</p>
          </div>
          
          {/* Conditions */}
          {conditionsSummary.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Solo si</span>
              </div>
              <ul className="space-y-0.5 pl-5">
                {conditionsSummary.map((c, i) => (
                  <li key={i} className="text-foreground flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Actions */}
          {actions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Luego sucede lo siguiente</span>
              </div>
              <ol className="space-y-1.5 pl-5">
                {actions.map((action, index) => {
                  const stepType = getActionStepType(action, index, actions.length);
                  const stepStyle = getStepTypeStyle(stepType);
                  return (
                    <li key={action.id} className="text-foreground flex items-start gap-2">
                      <span className="text-muted-foreground text-xs font-mono mt-0.5">{index + 1}.</span>
                      <span className="flex-1">{getActionDescription(action, templates)}</span>
                      {stepType !== 'normal' && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${stepStyle.badgeClass}`}>
                          {stepStyle.label}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          
          {/* Fallback */}
          {fallbackText && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-start gap-2 text-amber-600">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="text-xs">{fallbackText}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
