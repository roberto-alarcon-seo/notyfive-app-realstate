
-- Remove the contact limit trigger
DROP TRIGGER IF EXISTS check_contact_limit_before_insert ON public.contacts;

-- Drop the contact limit check function
DROP FUNCTION IF EXISTS public.check_tenant_contact_limit();

-- Set max_contacts to a very high number for all tenants (effectively unlimited)
UPDATE public.tenants SET max_contacts = 999999999;

-- Change the default for max_contacts column
ALTER TABLE public.tenants ALTER COLUMN max_contacts SET DEFAULT 999999999;
