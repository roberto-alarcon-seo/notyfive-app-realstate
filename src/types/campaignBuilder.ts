import { SegmentProposal, CopyProposal } from '@/hooks/useCampaignCopilot';

export type CampaignBuilderMode = 'manual' | 'assistant';

export interface CampaignDraft {
  name?: string;
  description?: string;
  campaign_type?: 'marketing' | 'utility' | 'authentication';
  segment_proposal?: SegmentProposal;
  copy_proposal?: CopyProposal;
  template_body?: string;
  template_id?: string;
  segment_id?: string;
  schedule?: { type: 'now' | 'scheduled'; datetime?: string };
  source: CampaignBuilderMode;
}

export const createEmptyDraft = (mode: CampaignBuilderMode): CampaignDraft => ({
  source: mode,
});
