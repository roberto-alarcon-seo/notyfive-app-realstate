import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
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
  Sparkles,
} from 'lucide-react';
import type { AutomationActionType } from '@/hooks/useAutomations';

interface ActionOption {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  category: 'messaging' | 'contact' | 'workflow' | 'ai';
}

const ACTION_OPTIONS: ActionOption[] = [
  { value: 'send_template', label: 'Enviar plantilla WhatsApp', icon: FileText, color: 'text-green-500 bg-green-500/10', category: 'messaging' },
  { value: 'send_message', label: 'Enviar mensaje de texto', icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', category: 'messaging' },
  { value: 'update_field', label: 'Actualizar campo', icon: UserPen, color: 'text-cyan-500 bg-cyan-500/10', category: 'contact' },
  { value: 'add_tag', label: 'Agregar tag', icon: Tag, color: 'text-purple-500 bg-purple-500/10', category: 'contact' },
  { value: 'remove_tag', label: 'Eliminar tag', icon: Tags, color: 'text-pink-500 bg-pink-500/10', category: 'contact' },
  { value: 'update_tag', label: 'Actualizar tag', icon: RefreshCw, color: 'text-indigo-500 bg-indigo-500/10', category: 'contact' },
  { value: 'create_note', label: 'Agregar nota', icon: StickyNote, color: 'text-yellow-500 bg-yellow-500/10', category: 'contact' },
  { value: 'delay', label: 'Esperar', icon: Clock, color: 'text-amber-500 bg-amber-500/10', category: 'workflow' },
  { value: 'update_event_status', label: 'Cambiar estado evento', icon: Calendar, color: 'text-purple-500 bg-purple-500/10', category: 'workflow' },
  { value: 'create_followup', label: 'Crear seguimiento', icon: CalendarClock, color: 'text-teal-500 bg-teal-500/10', category: 'workflow' },
  { value: 'send_webhook', label: 'Enviar a webhook', icon: Webhook, color: 'text-rose-500 bg-rose-500/10', category: 'workflow' },
  { value: 'pause_ai', label: 'Pausar IA', icon: BotOff, color: 'text-orange-500 bg-orange-500/10', category: 'ai' },
  { value: 'enable_ai', label: 'Activar IA', icon: Bot, color: 'text-emerald-500 bg-emerald-500/10', category: 'ai' },
  { value: 'escalate', label: 'Escalar a humano', icon: UserCog, color: 'text-red-500 bg-red-500/10', category: 'ai' },
];

const CATEGORY_LABELS: Record<string, string> = {
  messaging: 'Mensajería',
  contact: 'Gestión de contacto',
  workflow: 'Flujo de trabajo',
  ai: 'Inteligencia Artificial',
};

// Suggested actions based on trigger type
const SUGGESTED_ACTIONS_BY_TRIGGER: Record<string, string[]> = {
  // Event triggers
  'event.upcoming': ['send_template', 'delay', 'update_event_status', 'send_message'],
  'event.confirmed': ['send_template', 'create_note', 'add_tag'],
  'event.completed': ['send_template', 'create_followup', 'update_field'],
  'event.canceled': ['send_template', 'create_note', 'update_event_status'],
  'event.no_show': ['send_template', 'add_tag', 'create_followup'],
  // Message triggers
  'message.inbound': ['send_message', 'pause_ai', 'escalate', 'add_tag'],
  'message.ai_blocked': ['escalate', 'pause_ai', 'create_note'],
  'message.keyword': ['send_template', 'pause_ai', 'add_tag', 'update_field'],
  'message.first_contact': ['send_template', 'add_tag', 'create_followup'],
  // WhatsApp triggers
  'whatsapp.window_open': ['send_message', 'delay'],
  'whatsapp.window_closing': ['send_template', 'create_followup'],
  // Contact triggers
  'contact.field_changed': ['send_template', 'add_tag', 'create_followup', 'send_webhook'],
  'contact.created': ['send_template', 'add_tag', 'create_followup'],
  'contact.tag_added': ['send_template', 'create_followup', 'send_webhook'],
  'contact.tag_removed': ['update_field', 'create_note'],
};

interface SuggestedActionsProps {
  triggerType: string;
  onSelectAction: (actionType: AutomationActionType) => void;
  onShowAll: () => void;
}

export function SuggestedActions({ triggerType, onSelectAction, onShowAll }: SuggestedActionsProps) {
  const suggestedActionValues = SUGGESTED_ACTIONS_BY_TRIGGER[triggerType] || ['send_template', 'delay', 'escalate'];
  
  const suggestedActions = useMemo(() => {
    return suggestedActionValues
      .map(value => ACTION_OPTIONS.find(opt => opt.value === value))
      .filter(Boolean) as ActionOption[];
  }, [triggerType]);

  return (
    <div className="space-y-4">
      {/* Suggested actions section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-medium text-foreground">
            Acciones recomendadas para este disparador
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {suggestedActions.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.value}
                className="p-3 cursor-pointer hover:border-primary/50 transition-all border-primary/20 bg-primary/5"
                onClick={() => onSelectAction(option.value as AutomationActionType)}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${option.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{option.label}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-600 bg-amber-500/10">
                    Sugerida
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <button
            onClick={onShowAll}
            className="px-3 py-1 text-xs text-muted-foreground bg-background hover:text-foreground transition-colors"
          >
            Ver todas las acciones
          </button>
        </div>
      </div>
    </div>
  );
}

interface AllActionsGridProps {
  onSelectAction: (actionType: AutomationActionType) => void;
  triggerType: string;
}

export function AllActionsGrid({ onSelectAction, triggerType }: AllActionsGridProps) {
  const suggestedActionValues = SUGGESTED_ACTIONS_BY_TRIGGER[triggerType] || [];
  
  const groupedActions = useMemo(() => {
    return ACTION_OPTIONS.reduce((acc, action) => {
      if (!acc[action.category]) acc[action.category] = [];
      acc[action.category].push(action);
      return acc;
    }, {} as Record<string, ActionOption[]>);
  }, []);

  return (
    <div className="space-y-4">
      {Object.entries(groupedActions).map(([category, categoryActions]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {CATEGORY_LABELS[category] || category}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {categoryActions.map((option) => {
              const Icon = option.icon;
              const isSuggested = suggestedActionValues.includes(option.value);
              return (
                <Card
                  key={option.value}
                  className={`p-3 cursor-pointer hover:border-primary/50 transition-all ${
                    isSuggested ? 'border-primary/20 bg-primary/5' : 'border-border bg-secondary/30'
                  }`}
                  onClick={() => onSelectAction(option.value as AutomationActionType)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${option.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium text-foreground flex-1 truncate">{option.label}</p>
                  </div>
                  {isSuggested && (
                    <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-600 bg-amber-500/10">
                      Sugerida
                    </Badge>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
