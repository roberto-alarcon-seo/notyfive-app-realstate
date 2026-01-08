import { useCampaignCopilot } from '@/hooks/useCampaignCopilot';
import { CopilotChatPanel } from '@/components/assistant/CopilotChatPanel';
import { CopilotProposalPanel } from '@/components/assistant/CopilotProposalPanel';

export default function Assistant() {
  const {
    messages,
    isLoading,
    context,
    proposal,
    selectedSegment,
    selectedCopy,
    uiPhase,
    contextComplete,
    sendMessage,
    resetConversation,
    selectSegment,
    selectCopy,
  } = useCampaignCopilot();

  const handleRegenerateCopy = () => {
    sendMessage('Regenera los copys con variantes diferentes, más creativos y persuasivos.');
  };

  return (
    <div className="h-full flex">
      {/* Left Panel: Chat */}
      <div className="w-1/2 border-r border-border">
        <CopilotChatPanel
          messages={messages}
          isLoading={isLoading}
          uiPhase={uiPhase}
          onSendMessage={sendMessage}
          onReset={resetConversation}
        />
      </div>

      {/* Right Panel: Proposals */}
      <div className="w-1/2 bg-muted/20">
        <CopilotProposalPanel
          proposal={proposal}
          context={context}
          uiPhase={uiPhase}
          contextComplete={contextComplete}
          selectedSegment={selectedSegment}
          selectedCopy={selectedCopy}
          onSelectSegment={selectSegment}
          onSelectCopy={selectCopy}
          onRegenerateCopy={handleRegenerateCopy}
        />
      </div>
    </div>
  );
}
