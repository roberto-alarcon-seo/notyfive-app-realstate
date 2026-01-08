import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bot, Pencil, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCampaignCopilot } from '@/hooks/useCampaignCopilot';
import { useCreateCampaign, useStartCampaign, calculateAudienceCount } from '@/hooks/useCampaigns';
import { useSegments } from '@/hooks/useSegments';
import { useCreateTemplate } from '@/hooks/useTemplates';
import { useWallet } from '@/hooks/useWallet';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useTemplateUpsert, useSubmitForApproval, useSyncTemplates, extractTemplateVariables, generateAutoVariableMapping } from '@/hooks/useTemplateOperations';
import { CopilotChatPanel } from '@/components/assistant/CopilotChatPanel';
import { AssistantWizard, WizardDraft } from '@/components/campaigns/assistant/AssistantWizard';
import { computeSegmentFingerprint } from '@/lib/segments/fingerprint';
import { toast } from 'sonner';

const createEmptyDraft = (): WizardDraft => ({
  audienceCount: 0,
  templateApprovalStatus: 'draft',
  schedule: { type: 'now' },
  variableMapping: {},
  campaign_type: 'marketing',
});

export default function CampaignAssistantBuilder() {
  const navigate = useNavigate();
  const chatInputRef = useRef<HTMLInputElement>(null);
  
  // Guards against double-click
  const savingRef = useRef(false);
  const submittingRef = useRef(false);
  
  // Draft state
  const [draft, setDraft] = useState<WizardDraft>(createEmptyDraft());

  // Copilot hook
  const copilot = useCampaignCopilot();
  
  // Data hooks
  const { findOrCreateSegment } = useSegments();
  const { data: wallet } = useWallet();
  const { customFields } = useCustomFields();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const createTemplate = useCreateTemplate();
  
  // Template operations
  const templateUpsert = useTemplateUpsert();
  const submitApproval = useSubmitForApproval();
  const syncTemplates = useSyncTemplates();

  // Update draft helper
  const handleDraftChange = (updates: Partial<WizardDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  };

  // Calculate audience when segment changes
  useEffect(() => {
    async function calculate() {
      if (!draft.selectedSegment) {
        handleDraftChange({ audienceCount: 0 });
        return;
      }
      
      try {
        // Use the estimated count from the proposal
        handleDraftChange({ audienceCount: draft.selectedSegment.estimatedCount });
      } catch (error) {
        console.error('Error calculating audience:', error);
      }
    }
    calculate();
  }, [draft.selectedSegment]);

  // Generate WhatsApp-compatible template name
  const generateTemplateName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  };

  // Handle campaign creation
  const handleCreateCampaign = async () => {
    if (!draft.selectedSegment || !draft.template_body) {
      toast.error('Completa el segmento y mensaje antes de crear');
      return;
    }

    try {
      // 1. Create or find segment
      const rules_json = {
        logic: 'AND' as const,
        conditions: draft.selectedSegment.rules.map((rule, idx) => ({
          id: `rule_${idx}`,
          field: rule.field,
          fieldType: 'base' as const,
          dataType: 'short_text',
          operator: rule.operator,
          value: rule.value,
        })),
      };

      const fingerprint = await computeSegmentFingerprint(rules_json);

      const { segment: segmentResult } = await findOrCreateSegment({
        name: draft.selectedSegment.name,
        description: draft.selectedSegment.description,
        rules_json,
        fingerprint,
      });

      // 2. Create template
      const templateName = generateTemplateName(
        draft.name || draft.selectedSegment.name
      );
      
      const templateResult = await createTemplate.mutateAsync({
        name: templateName,
        category: 'marketing',
        header_type: draft.media ? draft.media.type : 'none',
        body: draft.template_body,
        footer: '',
        buttons: [],
        // Pass media URL if present
        ...(draft.media && {
          media_url: draft.media.url,
          media_mime_type: draft.media.mimeType,
          media_filename: draft.media.filename,
        }),
      });

      // 3. Build scheduled_at if needed
      let scheduledAt: string | undefined;
      if (draft.schedule.type === 'scheduled' && draft.schedule.datetime) {
        scheduledAt = new Date(draft.schedule.datetime).toISOString();
      }

      // 4. Create campaign
      const campaign = await createCampaign.mutateAsync({
        name: draft.name || `Campaña: ${draft.selectedSegment.name}`,
        description: draft.description || `Generada por IA`,
        campaign_type: 'marketing',
        template_id: templateResult.id,
        segment_id: segmentResult.id,
        audience_type: 'segment',
        variable_mapping: {},
        scheduled_at: scheduledAt,
      });

      // 5. Start if sending now
      if (draft.schedule.type === 'now' && campaign?.id) {
        await startCampaign.mutateAsync(campaign.id);
        toast.success('Campaña iniciada', { description: 'Los mensajes se están enviando' });
      } else {
        toast.success('Campaña creada', { 
          description: draft.schedule.type === 'scheduled' 
            ? 'Programada para envío'
            : 'La plantilla requiere aprobación de WhatsApp'
        });
      }

      navigate('/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Error al crear la campaña');
    }
  };

  // Handle switch to manual mode
  const handleSwitchToManual = () => {
    navigate('/campaigns?openWizard=manual');
  };

  // Focus copilot chat
  const handleRequestProposals = () => {
    chatInputRef.current?.focus();
  };

  // Generate template name from body content

  // Handle save template (upsert to DB + Twilio) - with double-click guard
  const handleSaveTemplate = async () => {
    // Guard against double-click
    if (savingRef.current || templateUpsert.isPending) {
      console.log('⚠️ Save already in progress, ignoring duplicate call');
      return;
    }
    
    if (!draft.template_body) {
      toast.error('No hay mensaje para guardar');
      return;
    }

    savingRef.current = true;
    
    try {
      const variables = extractTemplateVariables(draft.template_body);
      const customFieldsList = customFields.map(cf => ({ key: cf.key, name: cf.name }));
      const autoMapping = generateAutoVariableMapping(variables, customFieldsList);

      const result = await templateUpsert.mutateAsync({
        id: draft.template_id,
        // Don't pass name - let backend generate it with naming_context
        category: draft.campaign_type,
        body: draft.template_body,
        header: draft.media ? {
          type: draft.media.type,
          media_url: draft.media.url,
        } : { type: 'none' },
        variables,
        // Mark as AI-created from campaign assistant
        source: 'ai',
        source_module: 'campaign_ai',
        // Pass naming context for descriptive name generation
        naming_context: {
          category: draft.campaign_type,
          objective: draft.name || undefined,
          segment_name: draft.selectedSegment?.name || undefined,
        },
      });

      handleDraftChange({
        template_id: result.template_id,
        twilioSid: result.provider_template_sid || undefined,
        templateApprovalStatus: result.approval_status as WizardDraft['templateApprovalStatus'],
        variableMapping: { ...autoMapping, ...draft.variableMapping },
      });
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      savingRef.current = false;
    }
  };

  // Handle submit for approval - with double-click guard
  const handleSubmitApproval = async () => {
    // Guard against double-click
    if (submittingRef.current || submitApproval.isPending) {
      console.log('⚠️ Submit already in progress, ignoring duplicate call');
      return;
    }
    
    if (!draft.template_id) {
      toast.error('Guarda la plantilla primero');
      return;
    }

    submittingRef.current = true;
    
    try {
      const result = await submitApproval.mutateAsync(draft.template_id);
      handleDraftChange({
        templateApprovalStatus: result.approval_status as WizardDraft['templateApprovalStatus'],
      });
    } catch (error) {
      console.error('Error submitting approval:', error);
    } finally {
      submittingRef.current = false;
    }
  };

  // Handle sync status
  const handleSyncStatus = async () => {
    try {
      await syncTemplates.mutateAsync();
      // Refresh template status from DB
      if (draft.template_id) {
        const { data } = await supabase
          .from('templates')
          .select('approval_status, twilio_template_sid')
          .eq('id', draft.template_id)
          .single();
        
        if (data) {
          handleDraftChange({
            templateApprovalStatus: data.approval_status as WizardDraft['templateApprovalStatus'],
            twilioSid: data.twilio_template_sid || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error syncing templates:', error);
    }
  };

  const walletBalance = wallet?.balance_messages || 0;
  const isLoading = createCampaign.isPending || startCampaign.isPending || createTemplate.isPending;
  const hasProposals = copilot.proposal !== null && copilot.proposal.segments.length > 0;
  const customFieldsList = customFields.map(cf => ({ key: cf.key, name: cf.name }));

  return (
    <Dialog open={true} onOpenChange={(open) => !open && navigate('/campaigns')}>
      <DialogContent 
        className="max-w-[95vw] w-[95vw] max-h-[92vh] h-[92vh] p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <header className="border-b px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/campaigns')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold">Nueva campaña (Asistida por IA)</h1>
                <p className="text-xs text-muted-foreground">Tu copiloto te guía paso a paso</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSwitchToManual}>
            <Pencil className="h-4 w-4 mr-2" />
            Cambiar a modo manual
          </Button>
        </header>

        {/* Main Content - 2 Panels (30/70 split) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Copilot (30%) */}
          <div className="w-[30%] border-r flex flex-col">
            <CopilotChatPanel
              messages={copilot.messages}
              isLoading={copilot.isLoading}
              uiPhase={copilot.uiPhase}
              onSendMessage={copilot.sendMessage}
              onReset={copilot.resetConversation}
            />
          </div>

          {/* Right Panel - Wizard (70%) */}
          <div className="w-[70%] bg-muted/20">
            <AssistantWizard
              segmentProposals={copilot.proposal?.segments || []}
              copyProposals={copilot.proposal?.copies || []}
              draft={draft}
              onDraftChange={handleDraftChange}
              walletBalance={walletBalance}
              isCreating={isLoading}
              isSaving={templateUpsert.isPending}
              isSubmitting={submitApproval.isPending}
              isSyncing={syncTemplates.isPending}
              customFields={customFieldsList}
              onSaveTemplate={handleSaveTemplate}
              onSubmitApproval={handleSubmitApproval}
              onSyncStatus={handleSyncStatus}
              onCreateCampaign={handleCreateCampaign}
              onRequestProposals={handleRequestProposals}
              hasProposals={hasProposals}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-export for external use
export type { WizardDraft as AssistantCampaignDraft };
