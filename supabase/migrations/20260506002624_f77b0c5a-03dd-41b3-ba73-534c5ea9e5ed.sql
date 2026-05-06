
CREATE OR REPLACE FUNCTION public.fn_count_active_leads_for_agent(_tenant_id uuid, _agent_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.contacts c
  WHERE c.tenant_id = _tenant_id
    AND c.assigned_agent_id = _agent_id
    AND c.pipeline_stage NOT IN ('closed_won','closed_lost')
    AND c.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.fn_assign_conversation(
  p_conversation_id uuid,
  p_force_strategy text DEFAULT NULL,
  p_force_agent_id uuid DEFAULT NULL,
  p_assigned_by uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(success boolean, agent_id uuid, strategy text, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_contact RECORD;
  v_rules RECORD;
  v_chosen_agent uuid;
  v_strategy text;
  v_previous_agent uuid;
  v_property_agent uuid;
  v_sticky_agent uuid;
  v_candidate uuid;
  v_max_cap integer;
BEGIN
  SELECT id, tenant_id, contact_id INTO v_conv
  FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'CONVERSATION_NOT_FOUND'::text;
    RETURN;
  END IF;

  SELECT id, tenant_id, assigned_agent_id, re_property_interest_id
  INTO v_contact FROM public.contacts WHERE id = v_conv.contact_id;

  v_previous_agent := v_contact.assigned_agent_id;

  SELECT * INTO v_rules FROM public.assignment_rules WHERE tenant_id = v_conv.tenant_id;
  IF NOT FOUND THEN
    INSERT INTO public.assignment_rules (tenant_id) VALUES (v_conv.tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
    SELECT * INTO v_rules FROM public.assignment_rules WHERE tenant_id = v_conv.tenant_id;
  END IF;

  v_max_cap := v_rules.max_active_leads_per_agent;

  IF p_force_strategy = 'manual' AND p_force_agent_id IS NOT NULL THEN
    v_chosen_agent := p_force_agent_id;
    v_strategy := 'manual';
  ELSE
    v_sticky_agent := v_contact.assigned_agent_id;

    IF v_contact.re_property_interest_id IS NOT NULL THEN
      SELECT pa.user_id INTO v_property_agent
      FROM public.property_assignments pa
      JOIN public.profiles p ON p.id = pa.user_id
      WHERE pa.property_id = v_contact.re_property_interest_id
        AND pa.tenant_id = v_conv.tenant_id
        AND COALESCE(p.is_active_for_assignment, true) = true
        AND p.status = 'active'
      LIMIT 1;
    END IF;

    IF v_rules.sticky_agent_enabled AND v_sticky_agent IS NOT NULL
       AND (v_rules.sticky_overrides_property OR v_property_agent IS NULL) THEN
      v_chosen_agent := v_sticky_agent;
      v_strategy := 'sticky';
    ELSIF v_property_agent IS NOT NULL THEN
      v_chosen_agent := v_property_agent;
      v_strategy := 'property';
    ELSIF v_rules.round_robin_enabled THEN
      WITH agents AS (
        SELECT p.id, ROW_NUMBER() OVER (ORDER BY p.id) AS rn, COUNT(*) OVER () AS total
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE p.tenant_id = v_conv.tenant_id
          AND COALESCE(p.is_active_for_assignment, true) = true
          AND p.status = 'active'
          AND ur.tenant_role IN ('asesor','manager','administrador')
      ),
      ordered AS (
        SELECT a.id, a.rn, a.total,
          CASE
            WHEN v_rules.last_assigned_agent_id IS NULL THEN a.rn
            ELSE ((a.rn - 1 - COALESCE((SELECT rn FROM agents WHERE id = v_rules.last_assigned_agent_id), 0) + a.total) % a.total) + 1
          END AS pos
        FROM agents a
      )
      SELECT id INTO v_candidate
      FROM ordered o
      WHERE (v_max_cap IS NULL OR public.fn_count_active_leads_for_agent(v_conv.tenant_id, o.id) < v_max_cap)
      ORDER BY pos ASC
      LIMIT 1;

      IF v_candidate IS NOT NULL THEN
        v_chosen_agent := v_candidate;
        v_strategy := 'round_robin';
      END IF;
    END IF;

    IF v_chosen_agent IS NULL THEN
      SELECT p.id INTO v_chosen_agent
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.tenant_id = v_conv.tenant_id
        AND COALESCE(p.is_active_for_assignment, true) = true
        AND p.status = 'active'
        AND ur.tenant_role IN ('asesor','manager','administrador')
      ORDER BY p.created_at ASC
      LIMIT 1;
      IF v_chosen_agent IS NOT NULL THEN
        v_strategy := 'fallback';
      END IF;
    END IF;
  END IF;

  IF v_chosen_agent IS NULL THEN
    INSERT INTO public.assignment_logs (tenant_id, conversation_id, contact_id, previous_agent_id, new_agent_id, assigned_by, strategy, reason)
    VALUES (v_conv.tenant_id, v_conv.id, v_contact.id, v_previous_agent, NULL, p_assigned_by, 'none', COALESCE(p_reason,'no_agents_available'));
    RETURN QUERY SELECT false, NULL::uuid, 'none'::text, 'NO_AGENTS_AVAILABLE'::text;
    RETURN;
  END IF;

  -- Skip noop assignment but still log if explicit
  IF v_chosen_agent = v_previous_agent AND p_force_strategy IS NULL THEN
    UPDATE public.conversations SET last_assigned_at = now(), updated_at = now() WHERE id = v_conv.id;
    RETURN QUERY SELECT true, v_chosen_agent, v_strategy, NULL::text;
    RETURN;
  END IF;

  UPDATE public.contacts SET assigned_agent_id = v_chosen_agent, updated_at = now()
  WHERE id = v_contact.id;

  UPDATE public.conversations SET last_assigned_at = now(), updated_at = now()
  WHERE id = v_conv.id;

  IF v_strategy = 'round_robin' THEN
    UPDATE public.assignment_rules
    SET last_assigned_agent_id = v_chosen_agent, updated_at = now()
    WHERE tenant_id = v_conv.tenant_id;
  END IF;

  INSERT INTO public.assignment_logs (tenant_id, conversation_id, contact_id, previous_agent_id, new_agent_id, assigned_by, strategy, reason)
  VALUES (v_conv.tenant_id, v_conv.id, v_contact.id, v_previous_agent, v_chosen_agent, p_assigned_by, v_strategy, p_reason);

  RETURN QUERY SELECT true, v_chosen_agent, v_strategy, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reassign_conversation(
  p_conversation_id uuid,
  p_agent_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(success boolean, agent_id uuid, strategy text, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_conv_tenant uuid;
  v_target_tenant uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'NOT_AUTHENTICATED'::text;
    RETURN;
  END IF;

  SELECT tenant_id INTO v_conv_tenant FROM public.conversations WHERE id = p_conversation_id;
  IF v_conv_tenant IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'CONVERSATION_NOT_FOUND'::text;
    RETURN;
  END IF;

  IF NOT (public.is_super_admin(v_caller) OR (public.is_tenant_manager_or_admin(v_caller) AND public.get_user_tenant_id(v_caller) = v_conv_tenant)) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'FORBIDDEN'::text;
    RETURN;
  END IF;

  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = p_agent_id;
  IF v_target_tenant IS DISTINCT FROM v_conv_tenant THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'AGENT_TENANT_MISMATCH'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.fn_assign_conversation(p_conversation_id, 'manual', p_agent_id, v_caller, p_reason);
END;
$$;
