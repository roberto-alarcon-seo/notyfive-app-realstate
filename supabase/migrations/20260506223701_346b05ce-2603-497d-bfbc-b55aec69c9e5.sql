
-- Allow an asesor to claim an unassigned conversation/contact for themselves.
-- Returns success=false with error_code if conversation already has an owner
-- or if caller is not part of the tenant.
CREATE OR REPLACE FUNCTION public.fn_claim_conversation(
  p_conversation_id uuid,
  p_reason text DEFAULT 'manual_claim'
)
RETURNS TABLE(success boolean, agent_id uuid, strategy text, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_conv_tenant uuid;
  v_contact_id uuid;
  v_current_agent uuid;
  v_caller_tenant uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'NOT_AUTHENTICATED'::text;
    RETURN;
  END IF;

  SELECT c.tenant_id, c.contact_id INTO v_conv_tenant, v_contact_id
  FROM public.conversations c WHERE c.id = p_conversation_id;
  IF v_conv_tenant IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'CONVERSATION_NOT_FOUND'::text;
    RETURN;
  END IF;

  -- Caller must belong to the same tenant (or be super admin)
  v_caller_tenant := public.get_user_tenant_id(v_caller);
  IF NOT (public.is_super_admin(v_caller) OR v_caller_tenant = v_conv_tenant) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'FORBIDDEN'::text;
    RETURN;
  END IF;

  -- Only allow claim when contact is unassigned (or already assigned to caller)
  SELECT assigned_agent_id INTO v_current_agent
  FROM public.contacts WHERE id = v_contact_id;

  IF v_current_agent IS NOT NULL AND v_current_agent <> v_caller THEN
    RETURN QUERY SELECT false, v_current_agent, NULL::text, 'ALREADY_ASSIGNED'::text;
    RETURN;
  END IF;

  -- Delegate to the assignment engine to keep logging/sticky/etc consistent
  RETURN QUERY SELECT * FROM public.fn_assign_conversation(
    p_conversation_id,
    'manual',
    v_caller,
    v_caller,
    COALESCE(p_reason, 'manual_claim')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_claim_conversation(uuid, text) TO authenticated;
