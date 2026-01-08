import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  useAutomation,
  useCreateAutomation,
  useUpdateAutomation,
  type AutomationFormData,
} from '@/hooks/useAutomations';
import { AutomationTemplates, AUTOMATION_TEMPLATES, type AutomationTemplate } from '@/components/automations/AutomationTemplates';
import { TriggerSelector } from '@/components/automations/TriggerSelector';
import { ConditionsSelector } from '@/components/automations/ConditionsSelector';
import { ActionBuilder, type AutomationAction } from '@/components/automations/ActionBuilder';
import { AutomationSummary } from '@/components/automations/AutomationSummary';

const STEPS = [
  { id: 'trigger', label: 'Trigger', description: '¿Cuándo se activa?' },
  { id: 'conditions', label: 'Condiciones', description: 'Filtros opcionales' },
  { id: 'actions', label: 'Acciones', description: '¿Qué hace?' },
  { id: 'summary', label: 'Resumen', description: 'Revisa y guarda' },
];

const DAYS_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export default function AutomationWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  
  const [step, setStep] = useState(0);
  const [showTemplates, setShowTemplates] = useState(isNew);
  
  const { data: automation, isLoading } = useAutomation(isNew ? null : id || null);
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();

  const [formData, setFormData] = useState<AutomationFormData>({
    name: '',
    description: '',
    status: 'draft',
    trigger_type: 'event.upcoming' as any,
    trigger_config: { hours_before: 24 },
    conditions: [],
    actions: [],
    rate_limits: {
      per_minute: 10,
      per_hour: 200,
      per_contact_day: 3,
    },
    cooldown_hours: 24,
    allowed_hours: {
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5],
      timezone: 'America/Mexico_City',
    },
  });

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
        rate_limits: automation.rate_limits || {
          per_minute: 10,
          per_hour: 200,
          per_contact_day: 3,
        },
        cooldown_hours: automation.cooldown_hours || 24,
        allowed_hours: automation.allowed_hours || {
          start: '09:00',
          end: '18:00',
          days: [1, 2, 3, 4, 5],
          timezone: 'America/Mexico_City',
        },
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
    setStep(0);
  };

  const handleSave = async (activate = false) => {
    const data = {
      ...formData,
      status: activate ? 'active' as const : formData.status,
    };

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

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!formData.trigger_type;
      case 1:
        return true; // Conditions are optional
      case 2:
        return formData.actions.length > 0;
      case 3:
        return formData.name.trim().length > 0 && formData.actions.length > 0;
      default:
        return true;
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  if (isLoading && !isNew) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
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
            <p className="text-sm text-muted-foreground">
              Elige una plantilla o comienza desde cero
            </p>
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
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {isNew ? 'Nueva automatización' : 'Editar automatización'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {STEPS[step].description}
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setStep(index)}
              className={`flex items-center gap-2 text-sm transition-colors ${
                index === step
                  ? 'text-primary font-medium'
                  : index < step
                  ? 'text-success'
                  : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  index === step
                    ? 'bg-primary text-primary-foreground'
                    : index < step
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Step Content */}
      <Card className="border-border bg-secondary/20">
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-6">
              <TriggerSelector
                selectedTrigger={formData.trigger_type}
                triggerConfig={formData.trigger_config}
                onTriggerChange={(trigger) =>
                  setFormData(prev => ({ ...prev, trigger_type: trigger as any, trigger_config: {} }))
                }
                onConfigChange={(config) =>
                  setFormData(prev => ({ ...prev, trigger_config: config }))
                }
                onConfirm={() => setStep(1)}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <ConditionsSelector
                selectedTrigger={formData.trigger_type}
                activeConditions={formData.conditions}
                onConditionsChange={(conditions) =>
                  setFormData(prev => ({ ...prev, conditions }))
                }
              />

              {/* Allowed Hours */}
              <Card className="border-border bg-background/50">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Horario permitido</Label>
                    <Switch
                      checked={formData.allowed_hours.days.length > 0}
                      onCheckedChange={(checked) => {
                        if (!checked) {
                          setFormData(prev => ({
                            ...prev,
                            allowed_hours: { ...prev.allowed_hours, days: [] }
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            allowed_hours: { ...prev.allowed_hours, days: [1, 2, 3, 4, 5] }
                          }));
                        }
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Desde</Label>
                          <Input
                            type="time"
                            value={formData.allowed_hours.start}
                            onChange={(e) =>
                              setFormData(prev => ({
                                ...prev,
                                allowed_hours: { ...prev.allowed_hours, start: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Hasta</Label>
                          <Input
                            type="time"
                            value={formData.allowed_hours.end}
                            onChange={(e) =>
                              setFormData(prev => ({
                                ...prev,
                                allowed_hours: { ...prev.allowed_hours, end: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && (
            <ActionBuilder
              actions={formData.actions}
              onActionsChange={(actions) => setFormData(prev => ({ ...prev, actions }))}
            />
          )}

          {step === 3 && (
            <div className="space-y-6">
              {/* Name & Description */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la automatización *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Confirmación 24h antes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe qué hace esta automatización..."
                    rows={2}
                  />
                </div>
              </div>

              <AutomationSummary
                name={formData.name}
                description={formData.description}
                triggerType={formData.trigger_type}
                triggerConfig={formData.trigger_config}
                conditions={formData.conditions}
                actions={formData.actions}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => {
            if (step === 0) {
              if (isNew) {
                setShowTemplates(true);
              } else {
                navigate('/automations');
              }
            } else {
              setStep(step - 1);
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 0 ? (isNew ? 'Plantillas' : 'Cancelar') : 'Anterior'}
        </Button>

        <div className="flex items-center gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={!canProceed() || createAutomation.isPending || updateAutomation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar borrador
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={!canProceed() || createAutomation.isPending || updateAutomation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Guardar y activar
              </Button>
            </>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
