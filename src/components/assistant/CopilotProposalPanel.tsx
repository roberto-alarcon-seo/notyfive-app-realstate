import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Check, 
  AlertTriangle, 
  ChevronRight, 
  Copy, 
  RefreshCw,
  Rocket,
  Target,
  MessageSquare,
  Shield,
  Clock,
  Crosshair,
  Megaphone,
  Zap,
  Heart,
  Info,
  AlertCircle,
  Recycle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  CampaignProposal, 
  SegmentProposal, 
  CopyProposal,
  CampaignContext,
  UiPhase
} from '@/hooks/useCampaignCopilot';
import { useCreateCampaign } from '@/hooks/useCampaigns';
import { useSegments } from '@/hooks/useSegments';
import { useCreateTemplate, extractVariables } from '@/hooks/useTemplates';
import { computeSegmentFingerprint } from '@/lib/segments/fingerprint';

interface CopilotProposalPanelProps {
  proposal: CampaignProposal | null;
  context: CampaignContext;
  uiPhase: UiPhase;
  contextComplete: boolean;
  selectedSegment: SegmentProposal | null;
  selectedCopy: CopyProposal | null;
  onSelectSegment: (segment: SegmentProposal) => void;
  onSelectCopy: (copy: CopyProposal) => void;
  onRegenerateCopy: () => void;
  onFocusInput?: () => void;
  // Embedded mode props (for use inside Campaign Builder)
  embedded?: boolean;
  onUseSegment?: (segment: SegmentProposal) => void;
  onUseCopy?: (copy: CopyProposal) => void;
}

// Context field configuration for discovery phase
const CONTEXT_FIELDS: Array<{
  key: keyof CampaignContext;
  label: string;
  icon: typeof Target;
  fallbackKey?: keyof CampaignContext;
}> = [
  { key: 'objective', label: 'Objetivo', icon: Target },
  { key: 'clientType', label: 'Audiencia', icon: Users },
  { key: 'timePeriod', label: 'Periodo / Temporalidad', icon: Clock },
  { key: 'promotionDetails', label: 'Promoción', icon: Megaphone, fallbackKey: 'promotionType' },
  { key: 'tone', label: 'Tono', icon: Heart },
  { key: 'urgency', label: 'Urgencia', icon: Zap },
];

const OBJECTIVE_CHIPS = ['Promoción', 'Reactivación', 'Recordatorio', 'Informativo'];

export function CopilotProposalPanel({
  proposal,
  context,
  uiPhase,
  contextComplete,
  selectedSegment,
  selectedCopy,
  onSelectSegment,
  onSelectCopy,
  onRegenerateCopy,
  onFocusInput,
  embedded = false,
  onUseSegment,
  onUseCopy,
}: CopilotProposalPanelProps) {
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const { findOrCreateSegment } = useSegments();
  const createTemplate = useCreateTemplate();
  const [isCreating, setIsCreating] = useState(false);
  const [segmentWasReused, setSegmentWasReused] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  // Generate a WhatsApp-compatible template name (snake_case, alphanumeric)
  const generateTemplateName = (segmentName: string): string => {
    return segmentName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Max length
  };

  const handleCreateCampaign = async () => {
    if (!selectedSegment || !selectedCopy) {
      toast.error('Selecciona un segmento y un copy primero');
      return;
    }

    setIsCreating(true);
    setSegmentWasReused(false);
    
    try {
      // 1. Build rules_json for the segment
      const rules_json = {
        logic: 'AND' as const,
        conditions: selectedSegment.rules.map((rule, idx) => ({
          id: `rule_${idx}`,
          field: rule.field,
          fieldType: 'base' as const,
          dataType: 'short_text',
          operator: rule.operator,
          value: rule.value,
        })),
      };

      // 2. Compute fingerprint for deduplication
      const fingerprint = await computeSegmentFingerprint(rules_json);

      // 3. Find existing segment or create new one
      const { segment: segmentResult, wasReused } = await findOrCreateSegment({
        name: selectedSegment.name,
        description: selectedSegment.description,
        rules_json,
        fingerprint,
      });

      setSegmentWasReused(wasReused);

      // 4. Create the template with the copy (as draft)
      const templateName = generateTemplateName(selectedSegment.name);
      const variables = extractVariables(selectedCopy.main);
      
      const templateResult = await createTemplate.mutateAsync({
        name: templateName,
        category: 'marketing',
        header_type: 'none',
        body: selectedCopy.main,
        footer: '',
        buttons: [],
      });

      // 5. Create the campaign linking both segment and template
      await createCampaign.mutateAsync({
        name: `Campaña: ${selectedSegment.name}`,
        description: `Generada por IA - ${context.objective || 'Campaña general'}`,
        campaign_type: 'template',
        template_id: templateResult.id,
        segment_id: segmentResult.id,
        audience_type: 'segment',
        variable_mapping: {},
      });

      toast.success('Campaña creada como borrador', {
        description: wasReused 
          ? 'Se reutilizó un segmento existente. La plantilla necesita aprobación de WhatsApp.'
          : 'La plantilla fue creada pero necesita aprobación de WhatsApp antes de enviar',
      });

      navigate('/campaigns');
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error('Error al crear la campaña');
    } finally {
      setIsCreating(false);
    }
  };

  // Validation status
  const isReadyToCreate = selectedSegment && selectedCopy;
  const validationPassed = proposal?.validation?.whatsappCompliant && proposal?.validation?.cooldownRespected;

  // Compute pending context fields for proposal_partial
  const getPendingFields = (): string[] => {
    const pending: string[] = [];
    if (!context.clientType) pending.push('Audiencia');
    if (!context.tone) pending.push('Tono');
    if (!context.urgency) pending.push('Urgencia');
    return pending;
  };

  // Discovery phase: show detected context ONLY when no proposal exists
  if (!proposal && uiPhase === 'discovery') {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Información detectada</h2>
              <p className="text-xs text-muted-foreground">Lo que ya entendí de tu campaña</p>
            </div>
          </div>

          {/* Context fields */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {CONTEXT_FIELDS.map((field) => {
                const value = context[field.key as keyof CampaignContext] || 
                  (field.fallbackKey ? context[field.fallbackKey as keyof CampaignContext] : undefined);
                const Icon = field.icon;
                const hasValue = Boolean(value);

                return (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      hasValue ? 'bg-success/10' : 'bg-muted'
                    )}>
                      {hasValue ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={cn(
                          'w-4 h-4 shrink-0',
                          hasValue ? 'text-foreground' : 'text-muted-foreground'
                        )} />
                        <span className={cn(
                          'text-sm',
                          hasValue ? 'font-medium text-foreground' : 'text-muted-foreground'
                        )}>
                          {field.label}:
                        </span>
                        <span className={cn(
                          'text-sm truncate',
                          hasValue ? 'text-foreground' : 'text-muted-foreground italic'
                        )}>
                          {hasValue ? value : 'pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Objective chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Tipos de campaña comunes
            </p>
            <div className="flex flex-wrap gap-2">
              {OBJECTIVE_CHIPS.map((chip) => (
                <Badge key={chip} variant="outline" className="cursor-default">
                  {chip}
                </Badge>
              ))}
            </div>
          </div>

          {/* Helper text */}
          <p className="text-xs text-muted-foreground text-center py-4">
            Cuando complete estos datos te mostraré segmentos y copys aquí.
          </p>
        </div>
      </ScrollArea>
    );
  }

  // Generation phase: show skeleton loaders
  if (uiPhase === 'generation') {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary animate-pulse" />
              Generando propuesta...
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Analizando tus contactos y creando la campaña
            </p>
          </div>

          {/* Segments skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Segmentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>

          {/* Copies skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Copys
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>

          {/* Validation skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Validación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    );
  }

  // Show proposal (includes proposal_partial, ready, update_copy phases)
  const pendingFields = getPendingFields();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Proposal Partial Banner */}
        {uiPhase === 'proposal_partial' && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Propuesta inicial (puede refinarse)</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              Ya generé un borrador con la información actual. Si completas{' '}
              {pendingFields.length > 0 ? pendingFields.join(', ') : 'más detalles'}
              , la propuesta será más precisa.
              {pendingFields.length > 0 && (
                <span className="block mt-1 text-xs">
                  <strong>Pendiente:</strong> {pendingFields.join(', ')}
                </span>
              )}
            </AlertDescription>
            {onFocusInput && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={onFocusInput}
              >
                Refinar propuesta
              </Button>
            )}
          </Alert>
        )}

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            {uiPhase === 'proposal_partial' ? 'Borrador de Campaña' : 'Propuesta de Campaña'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {uiPhase === 'proposal_partial' 
              ? 'Revisa el borrador inicial y refina con más detalles'
              : 'Revisa y selecciona los elementos para tu campaña'
            }
          </p>
        </div>

        {/* Segments Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Segmentos Propuestos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposal.segments.map((segment, idx) => (
              <div
                key={idx}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-all',
                  selectedSegment?.name === segment.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => onSelectSegment(segment)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{segment.name}</span>
                      {segment.recommended && (
                        <Badge variant="default" className="text-xs">
                          Recomendado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {segment.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-muted-foreground">
                        ~{segment.estimatedCount.toLocaleString()} contactos
                      </span>
                      <Badge 
                        variant={
                          segment.saturationRisk === 'bajo' ? 'secondary' :
                          segment.saturationRisk === 'medio' ? 'outline' : 'destructive'
                        }
                        className="text-xs"
                      >
                        Riesgo: {segment.saturationRisk}
                      </Badge>
                    </div>
                  </div>
                  {selectedSegment?.name === segment.name && (
                    <Check className="w-5 h-5 text-primary shrink-0" />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {segment.rules.map((rule, ruleIdx) => (
                    <Badge key={ruleIdx} variant="outline" className="text-xs">
                      {rule.field} {rule.operator} {rule.value}
                    </Badge>
                  ))}
                </div>
                {/* Embedded mode: "Use this segment" button */}
                {embedded && onUseSegment && selectedSegment?.name === segment.name && (
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseSegment(segment);
                    }}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Usar este segmento
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Copies Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Copys Propuestos
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onRegenerateCopy}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposal.copies.map((copy, idx) => (
              <div key={idx} className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Para: {copy.segmentName}
                </div>
                
                {/* Main Copy */}
                <div
                  className={cn(
                    'p-4 rounded-lg border cursor-pointer transition-all',
                    selectedCopy?.main === copy.main
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => onSelectCopy(copy)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground whitespace-pre-line flex-1">
                      {copy.main}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(copy.main);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {selectedCopy?.main === copy.main && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </div>
                  {copy.requiresTemplate && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Requiere plantilla aprobada
                    </Badge>
                  )}
                  {/* Embedded mode: "Use this copy" button */}
                  {embedded && onUseCopy && selectedCopy?.main === copy.main && (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseCopy(copy);
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Usar este copy
                    </Button>
                  )}
                </div>

                {/* Intent badge and recommendation */}
                {copy.intent && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {copy.intent === 'conversacional' ? '💬 Conversacional' : 
                       copy.intent === 'urgencia' ? '⚡ Urgencia' : 
                       '🎁 Beneficio'}
                    </Badge>
                    {copy.recommended && (
                      <Badge variant="default" className="text-xs bg-primary/20 text-primary">
                        ⭐ Recomendado
                      </Badge>
                    )}
                  </div>
                )}
                {copy.recommendation_reason && copy.recommended && (
                  <p className="text-xs text-muted-foreground mt-1">{copy.recommendation_reason}</p>
                )}

                {idx < proposal.copies.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Validation Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Validación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {proposal.validation.whatsappCompliant ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                )}
                <span className="text-sm">
                  {proposal.validation.whatsappCompliant 
                    ? 'Cumple reglas de WhatsApp' 
                    : 'Revisar cumplimiento de WhatsApp'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {proposal.validation.cooldownRespected ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                )}
                <span className="text-sm">
                  {proposal.validation.cooldownRespected 
                    ? 'Respeta cooldown de contactos' 
                    : 'Algunos contactos en cooldown'}
                </span>
              </div>
              
              {proposal.validation.notes.length > 0 && (
                <div className="mt-3 p-3 rounded-md bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Notas:</span>
                  <ul className="mt-1 space-y-1">
                    {proposal.validation.notes.map((note, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Create Campaign Button - only show when not embedded */}
        {!embedded && (
          <div className="sticky bottom-0 pt-4 pb-2 bg-background">
            <Button 
              className="w-full" 
              size="lg"
              disabled={!isReadyToCreate || isCreating}
              onClick={handleCreateCampaign}
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creando campaña...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Crear campaña con esta configuración
                </>
              )}
            </Button>
            {!isReadyToCreate && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Selecciona un segmento y un copy para continuar
              </p>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
