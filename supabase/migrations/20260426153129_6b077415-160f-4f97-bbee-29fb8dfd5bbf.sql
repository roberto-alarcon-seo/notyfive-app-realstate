-- Add SUSPENDED to tenant_billing_state enum so the external Core can
-- explicitly suspend a tenant. When a tenant is SUSPENDED the CRM will
-- block message sending and AI actions even if credits remain.
ALTER TYPE public.tenant_billing_state ADD VALUE IF NOT EXISTS 'SUSPENDED';