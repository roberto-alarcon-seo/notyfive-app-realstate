import { useState, useEffect } from 'react';
import { Calendar, MessageSquare, Clock, Tag, UserCheck, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCustomFields } from '@/hooks/useCustomFields';

// ========================================
// TRIGGER TYPES
// ========================================

export type TriggerConfigType = 
  | 'none' 
  | 'time_before' 
  | 'keyword' 
  | 'campaign' 
  | 'field_changed' 
  | 'tag_changed';

export interface TriggerOption {
  value: string;
  label: string;
  description: string;
  example: string;
  configType: TriggerConfigType;
}

export interface TriggerCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  triggers: TriggerOption[];
}

// ========================================
// TRIGGERS CLASSIFICATION
// ========================================

export const TRIGGER_CATEGORIES: TriggerCategory[] = [
  {
    id: 'events',
    name: 'Eventos',
    icon: Calendar,
    triggers: [
      {
        value: 'event.created',
        label: 'Cuando se crea un evento',
        description: 'Se dispara cuando se agenda una cita, reservación o evento nuevo',
        example: 'Enviar confirmación de cita',
        configType: 'none',
      },
      {
        value: 'event.upcoming',
        label: 'Cuando un evento está por ocurrir',
        description: 'Se ejecuta X tiempo antes del evento programado',
        example: 'Recordatorio 24h antes',
        configType: 'time_before',
      },
      {
        value: 'event.canceled',
        label: 'Cuando un evento se cancela',
        description: 'Se dispara cuando se cancela una cita o reservación',
        example: 'Notificar cancelación al cliente',
        configType: 'none',
      },
      {
        value: 'event.completed',
        label: 'Cuando un evento se completa',
        description: 'Se ejecuta al marcar un evento como completado',
        example: 'Solicitar reseña después de la cita',
        configType: 'none',
      },
      {
        value: 'event.no_show',
        label: 'Cuando hay un no-show',
        description: 'Se dispara cuando el cliente no asiste al evento',
        example: 'Ofrecer reagendar la cita',
        configType: 'none',
      },
      {
        value: 'event.confirmed',
        label: 'Cuando se confirma un evento',
        description: 'Se dispara cuando el cliente confirma asistencia',
        example: 'Enviar detalles adicionales',
        configType: 'none',
      },
    ],
  },
  {
    id: 'messages',
    name: 'Mensajes',
    icon: MessageSquare,
    triggers: [
      {
        value: 'inbound_message',
        label: 'Mensaje entrante',
        description: 'Cuando un cliente envía un mensaje',
        example: 'Respuesta automática a palabra clave',
        configType: 'keyword',
      },
      {
        value: 'campaign_replied',
        label: 'Respuesta a campaña',
        description: 'Cuando un contacto responde a una campaña',
        example: 'Follow-up personalizado',
        configType: 'campaign',
      },
    ],
  },
  {
    id: 'window',
    name: 'Ventana de WhatsApp',
    icon: Clock,
    triggers: [
      {
        value: 'window_expiring',
        label: 'Ventana por expirar',
        description: 'Antes de que expire la ventana de 24h',
        example: 'Reactivar conversación',
        configType: 'time_before',
      },
      {
        value: 'window_expired',
        label: 'Ventana expirada',
        description: 'Cuando la ventana de 24h ha expirado',
        example: 'Enviar plantilla de reenganche',
        configType: 'none',
      },
    ],
  },
  {
    id: 'contact',
    name: 'Contacto',
    icon: UserCheck,
    triggers: [
      {
        value: 'field_changed',
        label: 'Campo modificado',
        description: 'Cuando se modifica un campo del contacto',
        example: 'Actualizar segmentación',
        configType: 'field_changed',
      },
      {
        value: 'tag_changed',
        label: 'Tag modificado',
        description: 'Cuando se agrega o quita un tag',
        example: 'Iniciar secuencia de bienvenida',
        configType: 'tag_changed',
      },
    ],
  },
];

// ========================================
// HUMAN READABLE SUMMARY GENERATOR
// ========================================

export function getTriggerSummary(
  triggerType: string, 
  config: Record<string, unknown>
): string {
  const allTriggers = TRIGGER_CATEGORIES.flatMap(c => c.triggers);
  const trigger = allTriggers.find(t => t.value === triggerType);
  
  if (!trigger) return 'Selecciona un disparador';

  switch (trigger.configType) {
    case 'time_before': {
      const value = (config.time_value as number) || 24;
      const unit = config.time_unit as string;
      const unitLabel = unit === 'days' ? (value === 1 ? 'día' : 'días') 
                      : unit === 'minutes' ? (value === 1 ? 'minuto' : 'minutos')
                      : (value === 1 ? 'hora' : 'horas');
      
      if (triggerType === 'event.upcoming') {
        return `${value} ${unitLabel} antes de un evento programado`;
      }
      if (triggerType === 'window_expiring') {
        return `${value} ${unitLabel} antes de que expire la ventana de WhatsApp`;
      }
      return `${value} ${unitLabel} antes`;
    }
    
    case 'keyword': {
      const messageType = config.message_type as string;
      const keyword = config.keyword as string;
      
      if (messageType === 'any' || !keyword) {
        return 'Cuando se recibe cualquier mensaje entrante';
      }
      return `Cuando se recibe un mensaje con la palabra "${keyword}"`;
    }
    
    case 'campaign': {
      const campaignType = config.campaign_type as string;
      const campaignName = config.campaign_name as string;
      
      if (campaignType === 'any') {
        return 'Cuando un contacto responde a cualquier campaña';
      }
      return campaignName 
        ? `Cuando un contacto responde a la campaña "${campaignName}"` 
        : 'Cuando un contacto responde a una campaña específica';
    }
    
    case 'field_changed': {
      const fieldLabel = (config.field_label as string) || (config.field_name as string);
      const changeType = config.change_type as string;
      const expectedValue = config.expected_value as string;
      
      if (!fieldLabel) return 'Cuando se modifica un campo del contacto';
      
      if (changeType === 'specific' && expectedValue) {
        return `Cuando "${fieldLabel}" cambia a "${expectedValue}"`;
      }
      return `Cuando se modifica el campo "${fieldLabel}"`;
    }
    
    case 'tag_changed': {
      const tagName = config.tag_name as string;
      const tagAction = config.tag_action as string;
      
      if (!tagName) return 'Cuando se modifica un tag';
      
      const actionLabel = tagAction === 'removed' ? 'se quita' : 'se agrega';
      return `Cuando ${actionLabel} el tag "${tagName}"`;
    }
    
    default:
      return trigger.label;
  }
}

// ========================================
// CONFIG VALIDATION
// ========================================

export function isTriggerConfigValid(
  triggerType: string,
  config: Record<string, unknown>
): boolean {
  const allTriggers = TRIGGER_CATEGORIES.flatMap(c => c.triggers);
  const trigger = allTriggers.find(t => t.value === triggerType);
  
  if (!trigger) return false;

  switch (trigger.configType) {
    case 'none':
      return true;
      
    case 'time_before': {
      const value = config.time_value as number;
      return value !== undefined && value > 0;
    }
    
    case 'keyword': {
      const messageType = config.message_type as string;
      if (messageType === 'any') return true;
      const keyword = config.keyword as string;
      return messageType === 'keyword' && keyword?.trim().length > 0;
    }
    
    case 'campaign': {
      const campaignType = config.campaign_type as string;
      if (campaignType === 'any') return true;
      const campaignId = config.campaign_id as string;
      return campaignType === 'specific' && campaignId?.length > 0;
    }
    
    case 'field_changed': {
      const fieldName = config.field_name as string;
      return fieldName?.length > 0;
    }
    
    case 'tag_changed': {
      const tagName = config.tag_name as string;
      const tagAction = config.tag_action as string;
      return tagName?.length > 0 && (tagAction === 'added' || tagAction === 'removed');
    }
    
    default:
      return true;
  }
}

// ========================================
// TRIGGER SELECTOR COMPONENT (Two-Step Flow)
// ========================================

interface TriggerSelectorProps {
  selectedTrigger: string;
  triggerConfig: Record<string, unknown>;
  onTriggerChange: (trigger: string) => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  onConfirm: () => void;
}

export function TriggerSelector({
  selectedTrigger,
  triggerConfig,
  onTriggerChange,
  onConfigChange,
  onConfirm,
}: TriggerSelectorProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const { customFields, loading: loadingFields, fetchCustomFields } = useCustomFields();
  
  // Load custom fields on mount
  useEffect(() => {
    fetchCustomFields();
  }, []);
  
  const allTriggers = TRIGGER_CATEGORIES.flatMap(c => c.triggers);
  const currentTrigger = allTriggers.find(t => t.value === selectedTrigger);
  const isValid = isTriggerConfigValid(selectedTrigger, triggerConfig);
  const requiresConfig = currentTrigger?.configType !== 'none';

  // Standard contact fields
  const standardFields = [
    { key: 'name', name: 'Nombre' },
    { key: 'email', name: 'Email' },
    { key: 'phone', name: 'Teléfono' },
    { key: 'status', name: 'Estado' },
    { key: 'country', name: 'País' },
  ];

  const handleSelectTrigger = (triggerValue: string) => {
    const trigger = allTriggers.find(t => t.value === triggerValue);
    onTriggerChange(triggerValue);
    
    // Set default config based on trigger type
    if (trigger) {
      switch (trigger.configType) {
        case 'time_before':
          onConfigChange({ time_value: 24, time_unit: 'hours' });
          break;
        case 'keyword':
          onConfigChange({ message_type: 'any', keyword: '' });
          break;
        case 'campaign':
          onConfigChange({ campaign_type: 'any', campaign_id: '' });
          break;
        case 'field_changed':
          onConfigChange({ field_name: '', change_type: 'any', expected_value: '' });
          break;
        case 'tag_changed':
          onConfigChange({ tag_name: '', tag_action: 'added' });
          break;
        default:
          onConfigChange({});
      }
    }
    
    // If requires config, go to step 2; otherwise confirm directly
    if (trigger?.configType !== 'none') {
      setStep('configure');
    } else {
      onConfirm();
    }
  };

  const handleBack = () => {
    setStep('select');
  };

  // ========================================
  // STEP 1: TRIGGER SELECTION
  // ========================================
  if (step === 'select') {
    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {TRIGGER_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <div key={category.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
                <CategoryIcon className="h-4 w-4" />
                {category.name}
              </div>
              {category.triggers.map((trigger) => {
                const needsConfig = trigger.configType !== 'none';
                return (
                  <Card
                    key={trigger.value}
                    className="p-3 cursor-pointer transition-all border-border hover:border-primary/50 hover:bg-primary/5 bg-secondary/30"
                    onClick={() => handleSelectTrigger(trigger.value)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{trigger.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{trigger.description}</p>
                      </div>
                      {needsConfig && (
                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                          Configurable
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // ========================================
  // STEP 2: CONFIGURATION (for parametrizable triggers)
  // ========================================
  return (
    <div className="flex flex-col h-full">
      {/* Header with back button and selected trigger */}
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
        <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{currentTrigger?.label}</p>
          <p className="text-xs text-muted-foreground truncate">{currentTrigger?.description}</p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <AlertCircle className="h-4 w-4" />
          Configuración requerida
        </div>
        
        {/* Time Before Config */}
        {currentTrigger?.configType === 'time_before' && (
          <div className="space-y-3">
            <Label className="font-medium">¿Cuánto tiempo antes?</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={(triggerConfig.time_value as number) || 24}
                onChange={(e) => onConfigChange({ 
                  ...triggerConfig, 
                  time_value: parseInt(e.target.value) || 1 
                })}
                className="w-24"
                min={1}
                max={168}
                autoFocus
              />
              <Select
                value={(triggerConfig.time_unit as string) || 'hours'}
                onValueChange={(value) => onConfigChange({ ...triggerConfig, time_unit: value })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Keyword Config */}
        {currentTrigger?.configType === 'keyword' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">Tipo de mensaje</Label>
              <RadioGroup 
                value={(triggerConfig.message_type as string) || 'any'}
                onValueChange={(value) => onConfigChange({ 
                  ...triggerConfig, 
                  message_type: value,
                  keyword: value === 'any' ? '' : triggerConfig.keyword 
                })}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="msg-any" />
                  <Label htmlFor="msg-any" className="font-normal cursor-pointer">Cualquier mensaje</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="keyword" id="msg-keyword" />
                  <Label htmlFor="msg-keyword" className="font-normal cursor-pointer">Contiene palabra clave</Label>
                </div>
              </RadioGroup>
            </div>
            
            {triggerConfig.message_type === 'keyword' && (
              <div className="space-y-2">
                <Label className="font-medium">Palabra clave</Label>
                <Input
                  value={(triggerConfig.keyword as string) || ''}
                  onChange={(e) => onConfigChange({ ...triggerConfig, keyword: e.target.value })}
                  placeholder="Ej: PROMO, AYUDA, INFO..."
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {/* Campaign Config */}
        {currentTrigger?.configType === 'campaign' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">¿Qué campaña?</Label>
              <RadioGroup 
                value={(triggerConfig.campaign_type as string) || 'any'}
                onValueChange={(value) => onConfigChange({ 
                  ...triggerConfig, 
                  campaign_type: value,
                  campaign_id: value === 'any' ? '' : triggerConfig.campaign_id 
                })}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="campaign-any" />
                  <Label htmlFor="campaign-any" className="font-normal cursor-pointer">Cualquier campaña</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="campaign-specific" />
                  <Label htmlFor="campaign-specific" className="font-normal cursor-pointer">Campaña específica</Label>
                </div>
              </RadioGroup>
            </div>
            
            {triggerConfig.campaign_type === 'specific' && (
              <div className="space-y-2">
                <Label className="font-medium">Seleccionar campaña</Label>
                <Select
                  value={(triggerConfig.campaign_id as string) || ''}
                  onValueChange={(value) => onConfigChange({ ...triggerConfig, campaign_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una campaña" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder">Cargando campañas...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Field Changed Config */}
        {currentTrigger?.configType === 'field_changed' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">Campo a monitorear</Label>
              <Select
                value={(triggerConfig.field_name as string) || ''}
                onValueChange={(value) => {
                  // Find the field label for the summary
                  const standardField = standardFields.find(f => f.key === value);
                  const customField = customFields.find(f => f.key === value);
                  const fieldLabel = standardField?.name || customField?.name || value;
                  onConfigChange({ ...triggerConfig, field_name: value, field_label: fieldLabel });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingFields ? "Cargando campos..." : "Selecciona un campo"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground">Campos estándar</SelectLabel>
                    {standardFields.map((field) => (
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
            
            <div className="space-y-2">
              <Label className="font-medium">Tipo de cambio</Label>
              <RadioGroup 
                value={(triggerConfig.change_type as string) || 'any'}
                onValueChange={(value) => onConfigChange({ 
                  ...triggerConfig, 
                  change_type: value,
                  expected_value: value === 'any' ? '' : triggerConfig.expected_value 
                })}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="change-any" />
                  <Label htmlFor="change-any" className="font-normal cursor-pointer">Cualquier cambio</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="change-specific" />
                  <Label htmlFor="change-specific" className="font-normal cursor-pointer">Valor específico</Label>
                </div>
              </RadioGroup>
            </div>
            
            {triggerConfig.change_type === 'specific' && (
              <div className="space-y-2">
                <Label className="font-medium">Valor esperado</Label>
                <Input
                  value={(triggerConfig.expected_value as string) || ''}
                  onChange={(e) => onConfigChange({ ...triggerConfig, expected_value: e.target.value })}
                  placeholder="Ej: activo, premium..."
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {/* Tag Changed Config */}
        {currentTrigger?.configType === 'tag_changed' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">Tag</Label>
              <Input
                value={(triggerConfig.tag_name as string) || ''}
                onChange={(e) => onConfigChange({ ...triggerConfig, tag_name: e.target.value })}
                placeholder="Ej: VIP, Nuevo, Interesado..."
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label className="font-medium">Acción</Label>
              <RadioGroup 
                value={(triggerConfig.tag_action as string) || 'added'}
                onValueChange={(value) => onConfigChange({ ...triggerConfig, tag_action: value })}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="added" id="tag-added" />
                  <Label htmlFor="tag-added" className="font-normal cursor-pointer">Cuando se agrega</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="removed" id="tag-removed" />
                  <Label htmlFor="tag-removed" className="font-normal cursor-pointer">Cuando se quita</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Footer with Preview and Confirm */}
      <div className="pt-4 mt-4 border-t border-border space-y-3">
        {/* Human Summary Preview */}
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Vista previa:</p>
          <p className="text-sm font-medium text-foreground">
            "Este flujo se ejecuta {getTriggerSummary(selectedTrigger, triggerConfig).toLowerCase()}"
          </p>
        </div>

        {/* Confirm Button - Always Visible */}
        <Button 
          className="w-full" 
          onClick={onConfirm}
          disabled={!isValid}
          size="lg"
        >
          <Check className="h-4 w-4 mr-2" />
          {!isValid ? 'Completa la configuración' : 'Confirmar disparador'}
        </Button>
      </div>
    </div>
  );
}
