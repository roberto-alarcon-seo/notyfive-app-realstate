ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_pipeline_stage_chk;

ALTER TABLE public.contacts ADD CONSTRAINT contacts_pipeline_stage_chk CHECK (
  pipeline_stage IN (
    'new_lead',
    'interest_confirmed', 
    'financial_validation',
    'searching',
    'visit_scheduled',
    'visit_done',
    'follow_up',
    'negotiation',
    'closed_won',
    'closed_lost'
  )
);