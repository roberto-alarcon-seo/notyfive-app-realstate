import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Users, FileText, Send, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentProposal, CopyProposal, MediaAttachment } from '@/hooks/useCampaignCopilot';
import { AssistantWizardStep1Audience } from './AssistantWizardStep1Audience';
import { AssistantWizardStep2Message } from './AssistantWizardStep2Message';
import { AssistantWizardStep3Send } from './AssistantWizardStep3Send';

interface VariableMapping {
  source: 'base' | 'custom' | 'fixed';
  field: string;
  field_key?: string;
  fixed_value?: string;
}

export interface WizardDraft {
  // Step 1: Audience
  selectedSegment?: SegmentProposal;
  segment_id?: string;
  audienceCount: number;
  // Step 2: Message
  selectedCopy?: CopyProposal;
  template_body?: string;
  template_id?: string;
  twilioSid?: string;
  templateApprovalStatus: 'draft' | 'pending' | 'approved' | 'rejected' | 'editing';
  // Media (optional)
  media?: MediaAttachment;
  // Step 3: Send
  schedule: { type: 'now' | 'scheduled'; datetime?: string };
  variableMapping: Record<string, VariableMapping>;
  // Meta
  name?: string;
  description?: string;
  campaign_type: 'marketing' | 'utility' | 'authentication';
}

interface AssistantWizardProps {
  segmentProposals: SegmentProposal[];
  copyProposals: CopyProposal[];
  draft: WizardDraft;
  onDraftChange: (updates: Partial<WizardDraft>) => void;
  walletBalance: number;
  isCreating: boolean;
  isSaving?: boolean;
  isSubmitting?: boolean;
  isSyncing?: boolean;
  customFields: Array<{ key: string; name: string }>;
  onSaveTemplate: () => Promise<void>;
  onSubmitApproval: () => Promise<void>;
  onSyncStatus: () => Promise<void>;
  onCreateCampaign: () => void;
  onRequestProposals: () => void;
  hasProposals: boolean;
}

const STEPS = [
  { number: 1, title: 'Audiencia', icon: Users },
  { number: 2, title: 'Mensaje', icon: FileText },
  { number: 3, title: 'Envío', icon: Send },
];

export function AssistantWizard({
  segmentProposals,
  copyProposals,
  draft,
  onDraftChange,
  walletBalance,
  isCreating,
  isSaving = false,
  isSubmitting = false,
  isSyncing = false,
  customFields,
  onSaveTemplate,
  onSubmitApproval,
  onSyncStatus,
  onCreateCampaign,
  onRequestProposals,
  hasProposals,
}: AssistantWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);

  // Step completion logic
  const isStep1Complete = !!draft.selectedSegment;
  const isStep2Complete = !!draft.template_id && (draft.templateApprovalStatus === 'approved' || draft.templateApprovalStatus === 'pending');
  const isStep3Ready = draft.schedule.type === 'now' || (draft.schedule.type === 'scheduled' && !!draft.schedule.datetime);
  
  const canProceedToStep2 = isStep1Complete;
  const canProceedToStep3 = isStep1Complete && !!draft.template_body;

  const handleNext = () => {
    if (currentStep === 1 && canProceedToStep2) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedToStep3) {
      setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepStatus = (stepNumber: number): 'completed' | 'active' | 'pending' => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'active';
    return 'pending';
  };

  const isStepComplete = (stepNumber: number): boolean => {
    if (stepNumber === 1) return isStep1Complete;
    if (stepNumber === 2) return isStep2Complete;
    if (stepNumber === 3) return isStep3Ready;
    return false;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Progress Header */}
      <div className="shrink-0 border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Crear campaña</h2>
          <Badge variant="outline" className="text-xs">
            Paso {currentStep} de {STEPS.length}
          </Badge>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const status = getStepStatus(step.number);
            const complete = isStepComplete(step.number);
            const Icon = step.icon;
            
            return (
              <div key={step.number} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    if (step.number < currentStep) setCurrentStep(step.number);
                    else if (step.number === 2 && canProceedToStep2) setCurrentStep(2);
                    else if (step.number === 3 && canProceedToStep3) setCurrentStep(3);
                  }}
                  disabled={
                    (step.number === 2 && !canProceedToStep2) ||
                    (step.number === 3 && !canProceedToStep3)
                  }
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    status === 'active' && 'bg-primary/10 border border-primary/30',
                    status === 'completed' && 'bg-success/10',
                    status === 'pending' && 'opacity-50',
                    'disabled:cursor-not-allowed'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
                    status === 'completed' ? 'bg-success text-success-foreground' :
                    status === 'active' ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {complete && status !== 'active' ? <Check className="h-4 w-4" /> : step.number}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className={cn(
                      'text-sm font-medium',
                      status === 'active' ? 'text-primary' :
                      status === 'completed' ? 'text-success' :
                      'text-muted-foreground'
                    )}>
                      {step.title}
                    </p>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-2',
                    isStepComplete(step.number) ? 'bg-success' : 'bg-border'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentStep === 1 && (
          <AssistantWizardStep1Audience
            proposals={segmentProposals}
            selectedSegment={draft.selectedSegment}
            onSelectSegment={(segment) => {
              onDraftChange({ 
                selectedSegment: segment, 
                audienceCount: segment.estimatedCount,
                name: `Campaña: ${segment.name}`,
              });
            }}
            hasProposals={hasProposals}
            onRequestProposals={onRequestProposals}
          />
        )}

        {currentStep === 2 && (
          <AssistantWizardStep2Message
            proposals={copyProposals}
            selectedCopy={draft.selectedCopy}
            templateBody={draft.template_body}
            approvalStatus={draft.templateApprovalStatus}
            templateId={draft.template_id}
            twilioSid={draft.twilioSid}
            media={draft.media}
            isSaving={isSaving}
            isSubmitting={isSubmitting}
            isSyncing={isSyncing}
            onSelectCopy={(copy) => {
              onDraftChange({
                selectedCopy: copy,
                template_body: copy.content || copy.main,
                templateApprovalStatus: 'draft',
                template_id: undefined,
                twilioSid: undefined,
              });
            }}
            onUpdateBody={(body) => {
              onDraftChange({ template_body: body, templateApprovalStatus: 'editing' });
            }}
            onSaveTemplate={onSaveTemplate}
            onSubmitApproval={onSubmitApproval}
            onSyncStatus={onSyncStatus}
            onRequestEdit={() => {
              onDraftChange({ templateApprovalStatus: 'editing' });
            }}
            onMediaChange={(media) => {
              onDraftChange({ media });
            }}
          />
        )}

        {currentStep === 3 && (
          <AssistantWizardStep3Send
            draft={draft}
            walletBalance={walletBalance}
            isCreating={isCreating}
            customFields={customFields}
            onScheduleChange={(type, datetime) => {
              onDraftChange({ schedule: { type, datetime } });
            }}
            onVariableMappingChange={(mapping) => {
              onDraftChange({ variableMapping: mapping });
            }}
            onCreateCampaign={onCreateCampaign}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between bg-background">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>

        <div className="flex items-center gap-2">
          {currentStep < 3 && (
            <Button
              onClick={handleNext}
              disabled={
                (currentStep === 1 && !canProceedToStep2) ||
                (currentStep === 2 && !canProceedToStep3)
              }
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
