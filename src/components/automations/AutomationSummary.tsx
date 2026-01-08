import { Calendar, MessageSquare, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TRIGGER_CATEGORIES } from './TriggerSelector';
import { CONDITION_OPTIONS } from './ConditionsSelector';

interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface AutomationSummaryProps {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: { field: string; operator: string; value: unknown }[];
  actions: AutomationAction[];
}

const ACTION_LABELS: Record<string, string> = {
  send_template: 'Enviar plantilla',
  send_message: 'Enviar mensaje',
  delay: 'Esperar',
  update_event_status: 'Cambiar estado',
  create_note: 'Agregar nota',
  pause_ai: 'Pausar IA',
  escalate: 'Escalar a humano',
};

export function AutomationSummary({
  name,
  description,
  triggerType,
  triggerConfig,
  conditions,
  actions,
}: AutomationSummaryProps) {
  // Get trigger label
  const allTriggers = TRIGGER_CATEGORIES.flatMap(c => c.triggers);
  const trigger = allTriggers.find(t => t.value === triggerType);
  
  // Build human-readable summary
  const buildSummary = () => {
    const parts: string[] = [];
    
    // Trigger part
    if (triggerType === 'event.upcoming') {
      const hours = (triggerConfig.hours_before as number) || 24;
      parts.push(`${hours} horas antes de un evento`);
    } else if (trigger) {
      parts.push(trigger.label.toLowerCase());
    }
    
    // Conditions part
    const activeConditions = conditions
      .map(c => {
        const cond = CONDITION_OPTIONS.find(
          opt => opt.field === c.field && opt.operator === c.operator
        );
        return cond?.label.replace('Solo si ', '').toLowerCase();
      })
      .filter(Boolean);
    
    if (activeConditions.length > 0) {
      parts.push(activeConditions.join(' y '));
    }
    
    return parts;
  };

  const summaryParts = buildSummary();

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Resumen de automatización
        </h3>
        <p className="text-sm text-muted-foreground">
          Revisa que todo esté correcto antes de guardar
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {name || 'Sin nombre'}
          </CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Human-readable summary */}
          <div className="p-4 rounded-lg bg-background/60 border border-border">
            <p className="text-foreground leading-relaxed">
              {summaryParts.length > 0 ? (
                <>
                  <span className="font-medium">Cuando: </span>
                  {summaryParts[0]}
                  {summaryParts.length > 1 && (
                    <>
                      , <span className="font-medium">si </span>
                      {summaryParts.slice(1).join(' y ')}
                    </>
                  )}
                  <span className="font-medium">, entonces:</span>
                </>
              ) : (
                'Configura el trigger para ver el resumen'
              )}
            </p>
            
            {actions.length > 0 && (
              <div className="mt-3 space-y-2">
                {actions.map((action, index) => {
                  const label = ACTION_LABELS[action.type] || action.type;
                  let detail = '';
                  
                  if (action.type === 'delay') {
                    const value = (action.config.value as number) || 5;
                    const unit = (action.config.unit as string) === 'hours' ? 'horas' : 'minutos';
                    detail = `${value} ${unit}`;
                  } else if (action.type === 'send_message') {
                    const msg = (action.config.message as string) || '';
                    detail = msg.length > 50 ? msg.slice(0, 50) + '...' : msg;
                  }
                  
                  return (
                    <div key={action.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs w-6 justify-center">
                        {index + 1}
                      </Badge>
                      <span className="text-foreground">{label}</span>
                      {detail && (
                        <span className="text-muted-foreground">— {detail}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visual flow */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Trigger
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            {conditions.length > 0 && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {conditions.length} condición{conditions.length > 1 ? 'es' : ''}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </>
            )}
            <Badge variant="secondary" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {actions.length} acción{actions.length > 1 ? 'es' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {actions.length === 0 && (
        <p className="text-center text-sm text-destructive">
          Debes agregar al menos una acción para poder guardar
        </p>
      )}
    </div>
  );
}
