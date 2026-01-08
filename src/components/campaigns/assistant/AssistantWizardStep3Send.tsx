import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Wallet, 
  Calendar, 
  Send, 
  Loader2, 
  AlertCircle,
  Check,
  FileText,
  Zap,
  Link2,
  Clock,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WizardDraft } from './AssistantWizard';
import { VariableMappingModal } from './VariableMappingModal';
import { format } from 'date-fns';

interface VariableMapping {
  source: 'base' | 'custom' | 'fixed';
  field: string;
  field_key?: string;
  fixed_value?: string;
}

interface AssistantWizardStep3SendProps {
  draft: WizardDraft;
  walletBalance: number;
  isCreating: boolean;
  customFields: Array<{ key: string; name: string }>;
  onScheduleChange: (type: 'now' | 'scheduled', datetime?: string) => void;
  onVariableMappingChange: (mapping: Record<string, VariableMapping>) => void;
  onCreateCampaign: () => void;
}

// Extract variables from template
function extractVariables(body: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }
  return variables;
}

// Approval status display
const approvalStatusDisplay: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Borrador', color: 'text-muted-foreground', icon: <FileText className="w-4 h-4" /> },
  pending: { label: 'En revisión', color: 'text-yellow-600', icon: <Clock className="w-4 h-4" /> },
  approved: { label: 'Aprobada', color: 'text-success', icon: <Check className="w-4 h-4" /> },
  rejected: { label: 'Rechazada', color: 'text-destructive', icon: <XCircle className="w-4 h-4" /> },
};

export function AssistantWizardStep3Send({
  draft,
  walletBalance,
  isCreating,
  customFields,
  onScheduleChange,
  onVariableMappingChange,
  onCreateCampaign,
}: AssistantWizardStep3SendProps) {
  const [showMappingModal, setShowMappingModal] = useState(false);
  
  const audienceCount = draft.audienceCount || 0;
  const estimatedCredits = audienceCount;
  const hasSufficientBalance = walletBalance >= estimatedCredits;
  const isScheduleReady = draft.schedule.type === 'now' || (draft.schedule.type === 'scheduled' && !!draft.schedule.datetime);
  
  // Check approval status
  const isApproved = draft.templateApprovalStatus === 'approved';
  const isPending = draft.templateApprovalStatus === 'pending';
  const isRejected = draft.templateApprovalStatus === 'rejected';
  const isDraft = draft.templateApprovalStatus === 'draft' || draft.templateApprovalStatus === 'editing';
  
  // For marketing campaigns, require approval
  const requiresApproval = draft.campaign_type === 'marketing';
  const approvalBlocked = requiresApproval && !isApproved;
  
  // Check variable mapping
  const variables = draft.template_body ? extractVariables(draft.template_body) : [];
  const mappedCount = Object.keys(draft.variableMapping || {}).length;
  const unmappedVariables = variables.filter(v => !(draft.variableMapping || {})[v]);
  const hasUnmappedVariables = unmappedVariables.length > 0;
  
  // Final check
  const canLaunch = hasSufficientBalance && isScheduleReady && !approvalBlocked && !hasUnmappedVariables;

  const approvalInfo = approvalStatusDisplay[draft.templateApprovalStatus] || approvalStatusDisplay.draft;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1">Lanza tu campaña</h3>
        <p className="text-sm text-muted-foreground">
          Revisa el resumen y elige cuándo enviar
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Audience Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Audiencia</p>
                <p className="font-semibold">{audienceCount.toLocaleString()} contactos</p>
                {draft.selectedSegment && (
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {draft.selectedSegment.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Summary */}
        <Card className={cn(approvalBlocked && 'border-destructive/50')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isApproved ? 'bg-success/10' : 
                isPending ? 'bg-yellow-500/10' :
                isRejected ? 'bg-destructive/10' :
                'bg-muted'
              )}>
                <span className={approvalInfo.color}>{approvalInfo.icon}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plantilla</p>
                <p className={cn('font-semibold', approvalInfo.color)}>
                  {approvalInfo.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {draft.campaign_type === 'marketing' ? 'Marketing' : 'Utilidad'} • WhatsApp
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Summary */}
        <Card className={cn(!hasSufficientBalance && 'border-destructive')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                hasSufficientBalance ? 'bg-primary/10' : 'bg-destructive/10'
              )}>
                <Wallet className={cn(
                  'w-5 h-5',
                  hasSufficientBalance ? 'text-primary' : 'text-destructive'
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créditos</p>
                <p className={cn(
                  'font-semibold',
                  !hasSufficientBalance && 'text-destructive'
                )}>
                  {estimatedCredits.toLocaleString()} necesarios
                </p>
                <p className="text-xs text-muted-foreground">
                  Disponibles: {walletBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variables Summary */}
        <Card className={cn(hasUnmappedVariables && 'border-destructive/50')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                hasUnmappedVariables ? 'bg-destructive/10' : 'bg-success/10'
              )}>
                <Link2 className={cn(
                  'w-5 h-5',
                  hasUnmappedVariables ? 'text-destructive' : 'text-success'
                )} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Variables</p>
                {variables.length === 0 ? (
                  <p className="font-semibold text-muted-foreground">Sin variables</p>
                ) : (
                  <p className={cn(
                    'font-semibold',
                    hasUnmappedVariables && 'text-destructive'
                  )}>
                    {mappedCount}/{variables.length} mapeadas
                  </p>
                )}
              </div>
              {variables.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMappingModal(true)}
                >
                  Configurar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {approvalBlocked && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isPending 
              ? 'La plantilla está en revisión por WhatsApp. Espera la aprobación para enviar.'
              : isRejected
              ? 'La plantilla fue rechazada. Edítala y envía nuevamente a aprobación.'
              : 'Necesitas aprobación de WhatsApp para enviar campañas de marketing. Guarda la plantilla y envíala a aprobación en el paso anterior.'
            }
          </AlertDescription>
        </Alert>
      )}

      {hasUnmappedVariables && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Faltan mapear variables: {unmappedVariables.map(v => `{{${v}}}`).join(', ')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMappingModal(true)}
            >
              Configurar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!hasSufficientBalance && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Saldo insuficiente. Necesitas {estimatedCredits.toLocaleString()} créditos pero solo tienes {walletBalance.toLocaleString()}.
          </AlertDescription>
        </Alert>
      )}

      {/* Schedule Options */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h4 className="font-medium">¿Cuándo enviar?</h4>
          </div>

          <RadioGroup
            value={draft.schedule.type}
            onValueChange={(v) => onScheduleChange(v as 'now' | 'scheduled', draft.schedule.datetime)}
            className="space-y-4"
          >
            <div className={cn(
              'flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer',
              draft.schedule.type === 'now' && 'border-primary bg-primary/5'
            )}>
              <RadioGroupItem value="now" id="schedule-now" />
              <div className="flex-1">
                <Label htmlFor="schedule-now" className="font-medium cursor-pointer">
                  Enviar ahora
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los mensajes comenzarán a enviarse inmediatamente
                </p>
              </div>
              <Send className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className={cn(
              'p-4 rounded-lg border transition-all cursor-pointer',
              draft.schedule.type === 'scheduled' && 'border-primary bg-primary/5'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="scheduled" id="schedule-later" />
                <div className="flex-1">
                  <Label htmlFor="schedule-later" className="font-medium cursor-pointer">
                    Programar
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Elige la fecha y hora de envío
                  </p>
                </div>
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>

              {draft.schedule.type === 'scheduled' && (
                <div className="mt-4 ml-7">
                  <Input
                    type="datetime-local"
                    value={draft.schedule.datetime || ''}
                    onChange={(e) => onScheduleChange('scheduled', e.target.value)}
                    className="max-w-xs"
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  />
                </div>
              )}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Launch Button */}
      <div className="pt-4">
        <Button
          className="w-full h-12 text-base"
          size="lg"
          disabled={!canLaunch || isCreating}
          onClick={onCreateCampaign}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creando campaña...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              {draft.schedule.type === 'scheduled' ? 'Programar campaña' : 'Lanzar campaña'}
            </>
          )}
        </Button>

        {draft.schedule.type === 'scheduled' && draft.schedule.datetime && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            Se enviará el {format(new Date(draft.schedule.datetime), "d 'de' MMMM 'a las' HH:mm")}
          </p>
        )}
      </div>

      {/* Variable Mapping Modal */}
      <VariableMappingModal
        open={showMappingModal}
        onOpenChange={setShowMappingModal}
        variables={variables}
        currentMapping={draft.variableMapping || {}}
        customFields={customFields}
        onSave={onVariableMappingChange}
      />
    </div>
  );
}
