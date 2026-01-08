import { useState, useEffect } from 'react';
import { Trash2, GripVertical, MessageSquare, Clock, Tag, StickyNote, UserCog, AlertTriangle, FileText, Webhook, CalendarClock, UserPen, Bot, BotOff, Tags, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { useTemplates } from '@/hooks/useTemplates';
import { useCustomFields } from '@/hooks/useCustomFields';
import { type AutomationAction, type AutomationActionType } from '@/hooks/useAutomations';

export type { AutomationAction };

interface ActionOption {
  value: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: 'messaging' | 'contact' | 'workflow' | 'ai';
}

const ACTION_OPTIONS: ActionOption[] = [
  // Messaging
  {
    value: 'send_template',
    label: 'Enviar plantilla WhatsApp',
    description: 'Envía una plantilla aprobada (puede iniciar conversación)',
    icon: FileText,
    color: 'text-green-500 bg-green-500/10',
    category: 'messaging',
  },
  {
    value: 'send_message',
    label: 'Enviar mensaje de texto',
    description: 'Envía texto libre (requiere ventana abierta)',
    icon: MessageSquare,
    color: 'text-blue-500 bg-blue-500/10',
    category: 'messaging',
  },
  // Contact management
  {
    value: 'update_field',
    label: 'Actualizar campo de contacto',
    description: 'Agregar, actualizar o eliminar información de un campo',
    icon: UserPen,
    color: 'text-cyan-500 bg-cyan-500/10',
    category: 'contact',
  },
  {
    value: 'add_tag',
    label: 'Agregar tag',
    description: 'Añade un tag al contacto',
    icon: Tag,
    color: 'text-purple-500 bg-purple-500/10',
    category: 'contact',
  },
  {
    value: 'remove_tag',
    label: 'Eliminar tag',
    description: 'Elimina un tag del contacto',
    icon: Tags,
    color: 'text-pink-500 bg-pink-500/10',
    category: 'contact',
  },
  {
    value: 'update_tag',
    label: 'Actualizar tag',
    description: 'Reemplaza un tag por otro',
    icon: RefreshCw,
    color: 'text-indigo-500 bg-indigo-500/10',
    category: 'contact',
  },
  {
    value: 'create_note',
    label: 'Agregar nota al contacto',
    description: 'Registra una nota interna en el contacto',
    icon: StickyNote,
    color: 'text-yellow-500 bg-yellow-500/10',
    category: 'contact',
  },
  // Workflow
  {
    value: 'delay',
    label: 'Esperar',
    description: 'Pausar la ejecución antes de continuar',
    icon: Clock,
    color: 'text-amber-500 bg-amber-500/10',
    category: 'workflow',
  },
  {
    value: 'update_event_status',
    label: 'Cambiar estado del evento',
    description: 'Actualiza el estado del evento asociado',
    icon: Tag,
    color: 'text-purple-500 bg-purple-500/10',
    category: 'workflow',
  },
  {
    value: 'create_followup',
    label: 'Crear seguimiento',
    description: 'Programa un seguimiento con fecha y notas',
    icon: CalendarClock,
    color: 'text-teal-500 bg-teal-500/10',
    category: 'workflow',
  },
  {
    value: 'send_webhook',
    label: 'Enviar a webhook',
    description: 'Envía datos del contacto a un endpoint externo',
    icon: Webhook,
    color: 'text-rose-500 bg-rose-500/10',
    category: 'workflow',
  },
  // AI
  {
    value: 'pause_ai',
    label: 'Pausar IA',
    description: 'Desactiva respuestas automáticas de IA',
    icon: BotOff,
    color: 'text-orange-500 bg-orange-500/10',
    category: 'ai',
  },
  {
    value: 'enable_ai',
    label: 'Activar IA',
    description: 'Activa respuestas automáticas de IA',
    icon: Bot,
    color: 'text-emerald-500 bg-emerald-500/10',
    category: 'ai',
  },
  {
    value: 'escalate',
    label: 'Escalar a humano',
    description: 'Marca la conversación para atención humana',
    icon: UserCog,
    color: 'text-red-500 bg-red-500/10',
    category: 'ai',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  messaging: 'Mensajería',
  contact: 'Gestión de contacto',
  workflow: 'Flujo de trabajo',
  ai: 'Inteligencia Artificial',
};

const STANDARD_FIELDS = [
  { key: 'name', name: 'Nombre' },
  { key: 'email', name: 'Email' },
  { key: 'phone', name: 'Teléfono' },
  { key: 'status', name: 'Estado' },
  { key: 'country', name: 'País' },
  { key: 'notes', name: 'Notas' },
];

interface ActionBuilderProps {
  actions: AutomationAction[];
  onActionsChange: (actions: AutomationAction[]) => void;
}

export function ActionBuilder({ actions, onActionsChange }: ActionBuilderProps) {
  const { data: templates } = useTemplates();
  const { customFields, fetchCustomFields } = useCustomFields();
  const approvedTemplates = templates?.filter(t => t.approval_status === 'approved') || [];

  useEffect(() => {
    fetchCustomFields();
  }, []);

  const addAction = (type: AutomationActionType) => {
    const newAction: AutomationAction = {
      id: crypto.randomUUID(),
      type,
      config: {},
    };
    onActionsChange([...actions, newAction]);
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    onActionsChange(
      actions.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const removeAction = (index: number) => {
    onActionsChange(actions.filter((_, i) => i !== index));
  };

  const getActionOption = (type: string) => ACTION_OPTIONS.find(o => o.value === type);

  // Group actions by category
  const actionsByCategory = ACTION_OPTIONS.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, ActionOption[]>);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          ¿Qué debe hacer la automatización?
        </h3>
        <p className="text-sm text-muted-foreground">
          Define las acciones que se ejecutarán en orden
        </p>
      </div>

      {/* Actions List */}
      <div className="space-y-3">
        {actions.map((action, index) => {
          const actionOption = getActionOption(action.type);
          const ActionIcon = actionOption?.icon || MessageSquare;

          return (
            <Card key={action.id} className="border-border bg-secondary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Badge variant="outline" className="text-xs">Paso {index + 1}</Badge>
                    <div className={`p-1.5 rounded ${actionOption?.color || 'bg-muted'}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground text-sm">
                      {actionOption?.label || action.type}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeAction(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Action Config */}
                {action.type === 'send_template' && (
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Plantilla</Label>
                    <Select
                      value={(action.config.template_id as string) || ''}
                      onValueChange={(value) =>
                        updateAction(index, { config: { ...action.config, template_id: value } })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona una plantilla aprobada" />
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
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Mensaje</Label>
                    <Textarea
                      value={(action.config.message as string) || ''}
                      onChange={(e) =>
                        updateAction(index, { config: { ...action.config, message: e.target.value } })
                      }
                      placeholder="Escribe el mensaje a enviar..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                )}

                {action.type === 'delay' && (
                  <div className="pl-8 flex items-center gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Esperar</Label>
                      <Input
                        type="number"
                        value={(action.config.value as number) || 5}
                        onChange={(e) =>
                          updateAction(index, {
                            config: { ...action.config, value: parseInt(e.target.value) || 5 },
                          })
                        }
                        className="w-20 mt-1"
                        min={1}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Unidad</Label>
                      <Select
                        value={(action.config.unit as string) || 'minutes'}
                        onValueChange={(value) =>
                          updateAction(index, { config: { ...action.config, unit: value } })
                        }
                      >
                        <SelectTrigger className="mt-1">
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

                {action.type === 'update_event_status' && (
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Nuevo estado</Label>
                    <Select
                      value={(action.config.new_status as string) || ''}
                      onValueChange={(value) =>
                        updateAction(index, { config: { ...action.config, new_status: value } })
                      }
                    >
                      <SelectTrigger className="mt-1">
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
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Nota</Label>
                    <Textarea
                      value={(action.config.note as string) || ''}
                      onChange={(e) =>
                        updateAction(index, { config: { ...action.config, note: e.target.value } })
                      }
                      placeholder="Texto de la nota interna..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                )}

                {action.type === 'pause_ai' && (
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Razón (opcional)</Label>
                    <Input
                      value={(action.config.reason as string) || ''}
                      onChange={(e) =>
                        updateAction(index, { config: { ...action.config, reason: e.target.value } })
                      }
                      placeholder="Ej: Cliente requiere atención personalizada"
                      className="mt-1"
                    />
                  </div>
                )}

                {action.type === 'enable_ai' && (
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Razón (opcional)</Label>
                    <Input
                      value={(action.config.reason as string) || ''}
                      onChange={(e) =>
                        updateAction(index, { config: { ...action.config, reason: e.target.value } })
                      }
                      placeholder="Ej: Flujo automatizado completado"
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Update field action */}
                {action.type === 'update_field' && (
                  <div className="pl-8 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Operación</Label>
                        <Select
                          value={(action.config.operation as string) || 'set'}
                          onValueChange={(value) =>
                            updateAction(index, { config: { ...action.config, operation: value } })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="set">Establecer valor</SelectItem>
                            <SelectItem value="clear">Eliminar valor</SelectItem>
                            <SelectItem value="append">Agregar al final</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
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
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecciona un campo" />
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
                      <div>
                        <Label className="text-xs text-muted-foreground">Nuevo valor</Label>
                        <Input
                          value={(action.config.value as string) || ''}
                          onChange={(e) =>
                            updateAction(index, { config: { ...action.config, value: e.target.value } })
                          }
                          placeholder="Valor a establecer (puedes usar {{variables}})"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Add tag action */}
                {action.type === 'add_tag' && (
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Tag a agregar</Label>
                    <Input
                      value={(action.config.tag as string) || ''}
                      onChange={(e) =>
                        updateAction(index, { config: { ...action.config, tag: e.target.value } })
                      }
                      placeholder="Ej: cliente_vip"
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Remove tag action */}
                {action.type === 'remove_tag' && (
                  <div className="pl-8">
                    <Label className="text-xs text-muted-foreground">Tag a eliminar</Label>
                    <Input
                      value={(action.config.tag as string) || ''}
                      onChange={(e) =>
                        updateAction(index, { config: { ...action.config, tag: e.target.value } })
                      }
                      placeholder="Ej: lead_nuevo"
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Update tag action */}
                {action.type === 'update_tag' && (
                  <div className="pl-8 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Tag a reemplazar</Label>
                      <Input
                        value={(action.config.old_tag as string) || ''}
                        onChange={(e) =>
                          updateAction(index, { config: { ...action.config, old_tag: e.target.value } })
                        }
                        placeholder="Ej: lead_nuevo"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nuevo tag</Label>
                      <Input
                        value={(action.config.new_tag as string) || ''}
                        onChange={(e) =>
                          updateAction(index, { config: { ...action.config, new_tag: e.target.value } })
                        }
                        placeholder="Ej: cliente_activo"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Webhook action */}
                {action.type === 'send_webhook' && (
                  <div className="pl-8 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">URL del webhook</Label>
                      <Input
                        value={(action.config.webhook_url as string) || ''}
                        onChange={(e) =>
                          updateAction(index, { config: { ...action.config, webhook_url: e.target.value } })
                        }
                        placeholder="https://tu-servidor.com/webhook"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Datos a incluir</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[
                          { key: 'include_contact_info', label: 'Información del contacto' },
                          { key: 'include_custom_fields', label: 'Campos personalizados' },
                          { key: 'include_tags', label: 'Tags' },
                          { key: 'include_conversation', label: 'Última conversación' },
                        ].map((option) => (
                          <label key={option.key} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(action.config[option.key] as boolean) ?? true}
                              onChange={(e) =>
                                updateAction(index, { 
                                  config: { ...action.config, [option.key]: e.target.checked } 
                                })
                              }
                              className="rounded border-border"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Headers personalizados (JSON, opcional)</Label>
                      <Textarea
                        value={(action.config.custom_headers as string) || ''}
                        onChange={(e) =>
                          updateAction(index, { config: { ...action.config, custom_headers: e.target.value } })
                        }
                        placeholder='{"Authorization": "Bearer xxx"}'
                        rows={2}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Create followup action */}
                {action.type === 'create_followup' && (
                  <div className="pl-8 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Programar en</Label>
                        <Input
                          type="number"
                          value={(action.config.delay_value as number) || 1}
                          onChange={(e) =>
                            updateAction(index, { 
                              config: { ...action.config, delay_value: parseInt(e.target.value) || 1 } 
                            })
                          }
                          className="mt-1"
                          min={1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Unidad</Label>
                        <Select
                          value={(action.config.delay_unit as string) || 'days'}
                          onValueChange={(value) =>
                            updateAction(index, { config: { ...action.config, delay_unit: value } })
                          }
                        >
                          <SelectTrigger className="mt-1">
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
                    <div>
                      <Label className="text-xs text-muted-foreground">Nota del seguimiento</Label>
                      <Textarea
                        value={(action.config.followup_note as string) || ''}
                        onChange={(e) =>
                          updateAction(index, { config: { ...action.config, followup_note: e.target.value } })
                        }
                        placeholder="Ej: Recordar hacer seguimiento de propuesta enviada"
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Action - Grouped by category */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-foreground">Agregar acción</Label>
        {Object.entries(actionsByCategory).map(([category, categoryActions]) => (
          <div key={category} className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {CATEGORY_LABELS[category] || category}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {categoryActions.map((option) => {
                const Icon = option.icon;
                return (
                  <Card
                    key={option.value}
                    className="border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50 cursor-pointer transition-all"
                    onClick={() => addAction(option.value as AutomationActionType)}
                  >
                    <CardContent className="p-3 text-center">
                      <div className={`p-2 rounded-lg mx-auto w-fit ${option.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-medium text-foreground mt-2">{option.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {actions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border rounded-lg">
          Agrega al menos una acción para que la automatización pueda ejecutarse
        </p>
      )}
    </div>
  );
}