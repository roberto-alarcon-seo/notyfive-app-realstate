import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Users,
  FileText,
  Send,
  Wallet,
  Bot,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import { useTemplates, Template } from '@/hooks/useTemplates';
import { useSegments } from '@/hooks/useSegments';
import { useWallet } from '@/hooks/useWallet';
import { useCreateCampaign, useStartCampaign, calculateAudienceCount } from '@/hooks/useCampaigns';
import { useOperationStatus } from '@/hooks/useOperationStatus';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CampaignBuilderMode } from '@/types/campaignBuilder';
import { GatedActionButton } from '@/components/ui/gated-action-button';

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: CampaignBuilderMode;
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = [
  { step: 1, title: 'Información', icon: FileText },
  { step: 2, title: 'Plantilla', icon: FileText },
  { step: 3, title: 'Audiencia', icon: Users },
  { step: 4, title: 'Variables', icon: FileText },
  { step: 5, title: 'Consumo', icon: Wallet },
  { step: 6, title: 'Envío', icon: Send },
];

export function CampaignWizard({ open, onOpenChange, initialMode }: CampaignWizardProps) {
  const navigate = useNavigate();
  
  // Mode selection (Step 0)
  const [mode, setMode] = useState<CampaignBuilderMode | null>(initialMode || null);
  const [currentStep, setCurrentStep] = useState<Step>(initialMode === 'manual' ? 1 : 0);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState('marketing');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [audienceType, setAudienceType] = useState<'all' | 'segment'>('all');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  const [sendType, setSendType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [audienceCount, setAudienceCount] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Data hooks
  const { data: templates = [] } = useTemplates();
  const { segments = [] } = useSegments();
  const { data: wallet } = useWallet();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const { canOperate } = useOperationStatus();

  const approvedTemplates = templates.filter((t: Template) => t.approval_status === 'approved');
  const selectedTemplate = approvedTemplates.find((t: Template) => t.id === selectedTemplateId);
  const templateVariables = selectedTemplate?.variables || [];

  const contactFields = [
    { value: 'name', label: 'Nombre' },
    { value: 'phone', label: 'Teléfono' },
    { value: 'email', label: 'Email' },
    { value: 'country', label: 'País' },
  ];

  // Calculate audience count when audience changes
  useEffect(() => {
    async function calculate() {
      setIsCalculating(true);
      try {
        const count = await calculateAudienceCount(
          audienceType,
          audienceType === 'segment' ? selectedSegmentId : undefined
        );
        setAudienceCount(count);
      } catch (error) {
        console.error('Error calculating audience:', error);
        setAudienceCount(0);
      } finally {
        setIsCalculating(false);
      }
    }
    
    if (audienceType === 'all' || (audienceType === 'segment' && selectedSegmentId)) {
      calculate();
    } else {
      setAudienceCount(0);
    }
  }, [audienceType, selectedSegmentId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(initialMode === 'manual' ? 1 : 0);
      setMode(initialMode || null);
      setName('');
      setDescription('');
      setCampaignType('marketing');
      setSelectedTemplateId('');
      setAudienceType('all');
      setSelectedSegmentId('');
      setVariableMapping({});
      setSendType('now');
      setScheduledDate('');
      setScheduledTime('');
    }
  }, [open, initialMode]);

  const walletBalance = wallet?.balance_messages || 0;
  const hasSufficientBalance = walletBalance >= audienceCount;
  const allVariablesMapped = templateVariables.every(v => variableMapping[v]);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return mode !== null;
      case 1:
        return name.trim().length > 0;
      case 2:
        return !!selectedTemplateId;
      case 3:
        return audienceType === 'all' || !!selectedSegmentId;
      case 4:
        return allVariablesMapped || templateVariables.length === 0;
      case 5:
        return hasSufficientBalance && audienceCount > 0;
      case 6:
        return sendType === 'now' || (scheduledDate && scheduledTime);
      default:
        return false;
    }
  };

  const handleModeSelect = (selectedMode: CampaignBuilderMode) => {
    setMode(selectedMode);
  };

  const handleNext = () => {
    if (currentStep === 0 && mode) {
      if (mode === 'assistant') {
        // Redirect to assistant builder page
        onOpenChange(false);
        navigate('/campaigns/new/assistant');
      } else {
        setCurrentStep(1);
      }
    } else if (currentStep < 6) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    try {
      let scheduledAt: string | undefined;
      if (sendType === 'scheduled' && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const campaign = await createCampaign.mutateAsync({
        name,
        description: description || undefined,
        campaign_type: campaignType,
        template_id: selectedTemplateId || undefined,
        segment_id: audienceType === 'segment' ? selectedSegmentId : undefined,
        audience_type: audienceType,
        variable_mapping: variableMapping,
        scheduled_at: scheduledAt,
      });

      if (sendType === 'now' && campaign?.id) {
        await startCampaign.mutateAsync(campaign.id);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const isLoading = createCampaign.isPending || startCampaign.isPending;

  // Render Step 0 - Mode Selection
  const renderModeSelection = () => (
    <div className="py-8 space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">¿Cómo quieres crear tu campaña?</h3>
        <p className="text-sm text-muted-foreground">
          Elige el modo que mejor se adapte a tus necesidades
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {/* AI Assisted Mode */}
        <Card 
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50',
            mode === 'assistant' && 'border-primary bg-primary/5'
          )}
          onClick={() => handleModeSelect('assistant')}
        >
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h4 className="font-semibold">Asistida por IA</h4>
                <Badge variant="default" className="text-xs">Recomendado</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Te guiamos y generamos segmentos y mensajes por ti
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Segmentos IA
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Copys IA
              </Badge>
            </div>
            {mode === 'assistant' && (
              <CheckCircle className="w-6 h-6 text-primary mx-auto" />
            )}
          </CardContent>
        </Card>

        {/* Manual Mode */}
        <Card 
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50',
            mode === 'manual' && 'border-primary bg-primary/5'
          )}
          onClick={() => handleModeSelect('manual')}
        >
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center">
              <Pencil className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Manual</h4>
              <p className="text-sm text-muted-foreground">
                Configura cada paso de forma tradicional
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className="text-xs">Control total</Badge>
              <Badge variant="outline" className="text-xs">Sin IA</Badge>
            </div>
            {mode === 'manual' && (
              <CheckCircle className="w-6 h-6 text-primary mx-auto" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Render the wizard content (steps 1-6)
  const renderWizardContent = () => (
    <div className="py-4 space-y-6">
      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la campaña *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Promoción Black Friday"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe brevemente el objetivo de la campaña"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de campaña</Label>
            <RadioGroup value={campaignType} onValueChange={setCampaignType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="marketing" id="marketing" />
                <Label htmlFor="marketing" className="font-normal">Marketing</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="utility" id="utility" />
                <Label htmlFor="utility" className="font-normal">Servicio / Utilidad</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="authentication" id="authentication" />
                <Label htmlFor="authentication" className="font-normal">Autenticación</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}

      {/* Step 2: Select Template */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Label>Selecciona una plantilla aprobada</Label>
          {approvedTemplates.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tienes plantillas aprobadas. Crea y envía a aprobación una plantilla primero.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {approvedTemplates.map((template: Template) => (
                <div
                  key={template.id}
                  className={cn(
                    'p-4 rounded-lg border-2 cursor-pointer transition-colors',
                    selectedTemplateId === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {template.category}
                      </Badge>
                    </div>
                    {selectedTemplateId === template.id && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {template.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {selectedTemplate && (
            <div className="mt-4">
              <Label className="mb-2 block">Vista previa</Label>
              <div className="p-4 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className="text-muted-foreground mt-1 line-clamp-3">{selectedTemplate.body}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Select Audience */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <Label>Selecciona la audiencia</Label>
          <RadioGroup value={audienceType} onValueChange={(v) => setAudienceType(v as 'all' | 'segment')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="font-normal">Todos los contactos con WhatsApp</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="segment" id="segment" />
              <Label htmlFor="segment" className="font-normal">Segmento específico</Label>
            </div>
          </RadioGroup>

          {audienceType === 'segment' && (
            <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un segmento" />
              </SelectTrigger>
              <SelectContent>
                {segments.map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="p-4 bg-muted rounded-lg flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {isCalculating ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  `${audienceCount} contactos`
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Esta campaña se enviará a {audienceCount} contactos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Variable Mapping */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <Label>Mapeo de variables</Label>
          {templateVariables.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Esta plantilla no tiene variables. Puedes continuar.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Asigna cada variable de la plantilla a un campo del contacto
              </p>
              {templateVariables.map((variable) => (
                <div key={variable} className="flex items-center gap-4">
                  <div className="w-32">
                    <Badge variant="secondary">{`{{${variable}}}`}</Badge>
                  </div>
                  <Select
                    value={variableMapping[variable] || ''}
                    onValueChange={(value) => 
                      setVariableMapping(prev => ({ ...prev, [variable]: value }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona un campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactFields.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Consumption Simulation */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <Label>Simulación de consumo</Label>
          <div className="p-6 bg-muted rounded-lg space-y-4">
            <div className="flex justify-between items-center">
              <span>Total de mensajes a enviar</span>
              <span className="font-bold text-lg">{audienceCount}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span>Saldo actual del wallet</span>
              <span className="font-bold text-lg">{walletBalance} mensajes</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span>Saldo después del envío</span>
              <span className={cn(
                'font-bold text-lg',
                hasSufficientBalance ? 'text-green-500' : 'text-destructive'
              )}>
                {walletBalance - audienceCount} mensajes
              </span>
            </div>
          </div>

          {!hasSufficientBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tienes saldo suficiente para enviar esta campaña. 
                Necesitas {audienceCount - walletBalance} mensajes adicionales.
              </AlertDescription>
            </Alert>
          )}

          {hasSufficientBalance && audienceCount > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Esta campaña consumirá <strong>{audienceCount} mensajes</strong> de tu wallet.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Step 6: Send */}
      {currentStep === 6 && (
        <div className="space-y-4">
          <Label>¿Cuándo enviar?</Label>
          <RadioGroup value={sendType} onValueChange={(v) => setSendType(v as 'now' | 'scheduled')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="now" id="now" />
              <Label htmlFor="now" className="font-normal">Enviar ahora</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <Label htmlFor="scheduled" className="font-normal">Programar envío</Label>
            </div>
          </RadioGroup>

          {sendType === 'scheduled' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2 mt-4">
            <h4 className="font-medium">Resumen de la campaña</h4>
            <div className="text-sm space-y-1">
              <p><strong>Nombre:</strong> {name}</p>
              <p><strong>Plantilla:</strong> {selectedTemplate?.name}</p>
              <p><strong>Audiencia:</strong> {audienceCount} contactos</p>
              <p><strong>Consumo:</strong> {audienceCount} mensajes</p>
              <p><strong>Envío:</strong> {sendType === 'now' ? 'Inmediato' : `Programado para ${scheduledDate} ${scheduledTime}`}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Stepper component
  const renderStepper = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b shrink-0">
      {STEPS.map(({ step, title }, index) => (
        <div key={step} className="flex items-center">
          <div 
            className={cn(
              'flex items-center gap-2',
              step === currentStep 
                ? 'text-primary' 
                : step < currentStep 
                  ? 'text-green-500' 
                  : 'text-muted-foreground'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              step === currentStep 
                ? 'bg-primary text-primary-foreground' 
                : step < currentStep 
                  ? 'bg-green-500 text-white' 
                  : 'bg-muted'
            )}>
              {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            <span className="text-sm font-medium hidden lg:inline">{title}</span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={cn(
              'w-8 lg:w-12 h-0.5 mx-2',
              step < currentStep ? 'bg-green-500' : 'bg-muted'
            )} />
          )}
        </div>
      ))}
    </div>
  );

  // Navigation footer
  const renderNavigation = () => (
    <div className="flex justify-between items-center px-6 py-4 border-t bg-background shrink-0">
      {currentStep === 0 ? (
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={handleNext} disabled={!canProceed()}>
            Continuar
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {currentStep === 1 ? 'Cambiar modo' : 'Anterior'}
          </Button>

          {currentStep < 6 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : sendType === 'now' ? (
            <GatedActionButton 
              onClick={handleSubmit} 
              disabled={!canProceed() || isLoading}
              gatedTooltip="Necesitas créditos para enviar la campaña"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar campaña
            </GatedActionButton>
          ) : (
            <GatedActionButton 
              onClick={handleSubmit} 
              disabled={!canProceed() || isLoading}
              gatedTooltip="Necesitas créditos para programar la campaña"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Programar campaña
            </GatedActionButton>
          )}
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Nueva campaña
            {mode && currentStep > 0 && (
              <Badge variant="outline" className="text-xs">
                <Pencil className="w-3 h-3 mr-1" />
                Manual
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators (only show after mode selection) */}
        {currentStep > 0 && renderStepper()}

        {/* Main content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {currentStep === 0 ? renderModeSelection() : renderWizardContent()}
          </div>
        </ScrollArea>

        {/* Navigation */}
        {renderNavigation()}
      </DialogContent>
    </Dialog>
  );
}
