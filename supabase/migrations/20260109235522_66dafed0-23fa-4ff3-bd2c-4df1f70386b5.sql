-- Add pipeline_stage column for Real Estate pipeline
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new_lead';

-- Add check constraint for pipeline_stage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_pipeline_stage_chk'
  ) THEN
    ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_pipeline_stage_chk
    CHECK (pipeline_stage IN (
      'new_lead',
      'interest_confirmed',
      'financial_validation',
      'searching',
      'visit_done',
      'follow_up',
      'negotiation',
      'closed_won',
      'closed_lost'
    ));
  END IF;
END $$;

-- Create index for pipeline_stage
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline_stage
ON public.contacts (pipeline_stage);

-- Add re_block_reason column for diagnostic
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS re_block_reason TEXT;

-- Add check constraint for re_block_reason
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_re_block_reason_chk'
  ) THEN
    ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_re_block_reason_chk
    CHECK (re_block_reason IS NULL OR re_block_reason IN (
      'NO_RESPONSE',
      'BUDGET_TOO_LOW',
      'CREDIT_NOT_APPROVED',
      'CREDIT_UNKNOWN_AMOUNT',
      'CREDIT_NOT_COMPATIBLE',
      'NO_PROPERTIES_MATCH',
      'NOT_INTERESTED_AFTER_VISIT',
      'POSTPONED',
      'OTHER'
    ));
  END IF;
END $$;

-- Add re_visit_outcome column
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS re_visit_outcome TEXT;

-- Add check constraint for re_visit_outcome
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_re_visit_outcome_chk'
  ) THEN
    ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_re_visit_outcome_chk
    CHECK (re_visit_outcome IS NULL OR re_visit_outcome IN (
      'LIKED',
      'DIDNT_LIKE',
      'NO_SHOW',
      'RESCHEDULE',
      'PENDING'
    ));
  END IF;
END $$;

-- Add operational_status column (separate from existing status enum)
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add check constraint for operational_status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_operational_status_chk'
  ) THEN
    ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_operational_status_chk
    CHECK (operational_status IN (
      'ACTIVE',
      'WAITING_CUSTOMER',
      'GHOSTING',
      'DND',
      'CLOSED'
    ));
  END IF;
END $$;

-- Create index for operational_status
CREATE INDEX IF NOT EXISTS idx_contacts_operational_status
ON public.contacts (operational_status);