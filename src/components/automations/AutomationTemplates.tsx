import { Calendar, Clock, MessageSquare, UserX, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: { field: string; operator: string; value: unknown }[];
  actions: { id: string; type: string; config: Record<string, unknown> }[];
  color: string;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'confirmation-24h',
    name: 'Confirmar evento 24h antes',
    description: 'Envía un mensaje de confirmación automático 24 horas antes del evento programado',
    icon: Calendar,
    triggerType: 'event.upcoming',
    triggerConfig: { hours_before: 24 },
    conditions: [{ field: 'event.status', operator: 'equals', value: 'scheduled' }],
    actions: [
      { id: crypto.randomUUID(), type: 'send_template', config: {} }
    ],
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    id: 'reminder-2h',
    name: 'Recordatorio 2h antes',
    description: 'Envía un recordatorio corto 2 horas antes de la cita',
    icon: Clock,
    triggerType: 'event.upcoming',
    triggerConfig: { hours_before: 2 },
    conditions: [{ field: 'event.status', operator: 'equals', value: 'confirmed' }],
    actions: [
      { id: crypto.randomUUID(), type: 'send_message', config: { message: '¡Hola! Te recordamos que tu cita es en 2 horas. ¡Te esperamos!' } }
    ],
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    id: 'event-canceled',
    name: 'Aviso de cancelación',
    description: 'Notifica automáticamente cuando se cancela un evento',
    icon: XCircle,
    triggerType: 'event.canceled',
    triggerConfig: {},
    conditions: [],
    actions: [
      { id: crypto.randomUUID(), type: 'send_template', config: {} }
    ],
    color: 'text-red-500 bg-red-500/10',
  },
  {
    id: 'post-event',
    name: 'Seguimiento post-evento',
    description: 'Solicita feedback o reseña después de completar un evento',
    icon: CheckCircle,
    triggerType: 'event.completed',
    triggerConfig: {},
    conditions: [],
    actions: [
      { id: crypto.randomUUID(), type: 'delay', config: { minutes: 60 } },
      { id: crypto.randomUUID(), type: 'send_template', config: {} }
    ],
    color: 'text-green-500 bg-green-500/10',
  },
  {
    id: 'no-show',
    name: 'Gestión de no-show',
    description: 'Mensaje empático con opción de reagendar cuando el cliente no asiste',
    icon: UserX,
    triggerType: 'event.no_show',
    triggerConfig: {},
    conditions: [],
    actions: [
      { id: crypto.randomUUID(), type: 'send_template', config: {} }
    ],
    color: 'text-orange-500 bg-orange-500/10',
  },
];

interface AutomationTemplatesProps {
  onSelect: (template: AutomationTemplate) => void;
}

export function AutomationTemplates({ onSelect }: AutomationTemplatesProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Automatiza confirmaciones, recordatorios y seguimientos en minutos
        </h3>
        <p className="text-sm text-muted-foreground">
          Elige una plantilla para comenzar o crea una automatización desde cero
        </p>
      </div>
      
      <div className="grid gap-3">
        {AUTOMATION_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className="bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary/50 cursor-pointer transition-all"
              onClick={() => onSelect(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${template.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground">{template.name}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {template.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
