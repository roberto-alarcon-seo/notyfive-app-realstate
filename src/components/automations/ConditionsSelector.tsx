import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Calendar, Clock, UserCheck, Ban } from 'lucide-react';

export interface ConditionOption {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  label: string;
  description: string;
  icon: React.ElementType;
  appliesToTriggers?: string[];
}

export const CONDITION_OPTIONS: ConditionOption[] = [
  {
    id: 'event_confirmed',
    field: 'event.status',
    operator: 'equals',
    value: 'confirmed',
    label: 'Solo si el evento está confirmado',
    description: 'Ejecutar únicamente cuando el cliente ha confirmado asistencia',
    icon: CheckCircle,
    appliesToTriggers: ['event.upcoming', 'event.completed'],
  },
  {
    id: 'event_scheduled',
    field: 'event.status',
    operator: 'equals',
    value: 'scheduled',
    label: 'Solo si el evento está programado',
    description: 'Ejecutar para eventos que aún no han sido confirmados',
    icon: Calendar,
    appliesToTriggers: ['event.upcoming'],
  },
  {
    id: 'event_not_canceled',
    field: 'event.status',
    operator: 'not_equals',
    value: 'canceled',
    label: 'Solo si no ha sido cancelado',
    description: 'Omitir si el evento fue cancelado antes de ejecutar',
    icon: Ban,
    appliesToTriggers: ['event.upcoming', 'event.created'],
  },
  {
    id: 'within_hours',
    field: 'execution.time',
    operator: 'within_hours',
    value: true,
    label: 'Solo dentro de horario laboral',
    description: 'Respetar el horario configurado para esta automatización',
    icon: Clock,
  },
  {
    id: 'not_executed_before',
    field: 'execution.unique',
    operator: 'not_executed',
    value: true,
    label: 'Solo si no se ejecutó antes',
    description: 'No ejecutar si ya corrió para este contacto/evento',
    icon: UserCheck,
  },
];

interface ConditionsSelectorProps {
  selectedTrigger: string;
  activeConditions: { field: string; operator: string; value: unknown }[];
  onConditionsChange: (conditions: { field: string; operator: string; value: unknown }[]) => void;
}

export function ConditionsSelector({
  selectedTrigger,
  activeConditions,
  onConditionsChange,
}: ConditionsSelectorProps) {
  // Filter conditions that apply to the current trigger
  const applicableConditions = CONDITION_OPTIONS.filter(
    (condition) =>
      !condition.appliesToTriggers ||
      condition.appliesToTriggers.includes(selectedTrigger) ||
      !selectedTrigger.startsWith('event.')
  );

  const isConditionActive = (conditionId: string) => {
    const condition = CONDITION_OPTIONS.find(c => c.id === conditionId);
    if (!condition) return false;
    return activeConditions.some(
      (ac) => ac.field === condition.field && ac.operator === condition.operator
    );
  };

  const toggleCondition = (conditionId: string) => {
    const condition = CONDITION_OPTIONS.find(c => c.id === conditionId);
    if (!condition) return;

    if (isConditionActive(conditionId)) {
      onConditionsChange(
        activeConditions.filter(
          (ac) => !(ac.field === condition.field && ac.operator === condition.operator)
        )
      );
    } else {
      onConditionsChange([
        ...activeConditions,
        { field: condition.field, operator: condition.operator, value: condition.value },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Condiciones (opcional)
        </h3>
        <p className="text-sm text-muted-foreground">
          Define cuándo debe ejecutarse esta automatización
        </p>
      </div>

      <div className="space-y-3">
        {applicableConditions.map((condition) => {
          const Icon = condition.icon;
          const isActive = isConditionActive(condition.id);

          return (
            <Card
              key={condition.id}
              className={`transition-all cursor-pointer ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-secondary/30 hover:border-primary/50'
              }`}
              onClick={() => toggleCondition(condition.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <Label className="text-foreground cursor-pointer">{condition.label}</Label>
                      <p className="text-xs text-muted-foreground">{condition.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => toggleCondition(condition.id)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeConditions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Sin condiciones adicionales. La automatización se ejecutará siempre que ocurra el trigger.
        </p>
      )}
    </div>
  );
}
