
-- Function to clear risk flag when agent responds
CREATE OR REPLACE FUNCTION public.fn_clear_risk_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When an outbound message is sent (from agent/human), clear risk flag
  IF NEW.direction = 'outbound' AND COALESCE(NEW.source, '') <> 'ai' THEN
    UPDATE conversations
    SET risk_flagged_at = NULL,
        status = CASE WHEN status = 'risk' THEN 'open' ELSE status END,
        last_agent_message_at = NEW.created_at
    WHERE id = NEW.conversation_id
      AND risk_flagged_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_risk_on_agent_message ON public.messages;
CREATE TRIGGER trg_clear_risk_on_agent_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.fn_clear_risk_flag();

-- Main timeout check function
CREATE OR REPLACE FUNCTION public.fn_check_assignment_timeouts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_rules RECORD;
  v_flagged int := 0;
  v_reassigned int := 0;
  v_notified int := 0;
  v_assign_result jsonb;
  v_previous_agent uuid;
BEGIN
  -- Iterate over all tenants' rules
  FOR v_rules IN
    SELECT tenant_id, lead_timeout_minutes, timeout_action
    FROM assignment_rules
    WHERE COALESCE(lead_timeout_minutes, 0) > 0
  LOOP
    -- Find conversations at risk for this tenant
    FOR v_conv IN
      SELECT c.id, c.contact_id, c.tenant_id, c.assigned_agent_id,
             c.last_customer_message_at, c.last_agent_message_at
      FROM conversations c
      WHERE c.tenant_id = v_rules.tenant_id
        AND c.assigned_agent_id IS NOT NULL
        AND c.status NOT IN ('closed', 'archived', 'risk')
        AND c.risk_flagged_at IS NULL
        AND c.last_customer_message_at IS NOT NULL
        AND (
          c.last_agent_message_at IS NULL
          OR c.last_agent_message_at < c.last_customer_message_at
        )
        AND c.last_customer_message_at < (now() - (v_rules.lead_timeout_minutes || ' minutes')::interval)
      LIMIT 200
    LOOP
      v_previous_agent := v_conv.assigned_agent_id;

      -- Mark as risk
      UPDATE conversations
      SET status = 'risk',
          risk_flagged_at = now()
      WHERE id = v_conv.id;
      v_flagged := v_flagged + 1;

      -- Log activity
      INSERT INTO conversation_activity (
        tenant_id, conversation_id, contact_id, actor_type, event_type, payload
      ) VALUES (
        v_conv.tenant_id, v_conv.id, v_conv.contact_id, 'system',
        'lead_at_risk',
        jsonb_build_object(
          'agent_id', v_previous_agent,
          'timeout_minutes', v_rules.lead_timeout_minutes,
          'action', v_rules.timeout_action
        )
      );

      -- Action: reassign
      IF v_rules.timeout_action IN ('reassign', 'notify_and_reassign') THEN
        BEGIN
          -- Temporarily clear assigned_agent so the engine picks a different one
          UPDATE conversations SET assigned_agent_id = NULL WHERE id = v_conv.id;
          UPDATE contacts SET assigned_agent_id = NULL
          WHERE id = v_conv.contact_id AND assigned_agent_id = v_previous_agent;

          v_assign_result := public.fn_assign_conversation(
            v_conv.id, NULL, 'timeout_reassign'
          );
          v_reassigned := v_reassigned + 1;
        EXCEPTION WHEN OTHERS THEN
          -- Restore original agent if reassignment fails
          UPDATE conversations SET assigned_agent_id = v_previous_agent WHERE id = v_conv.id;
        END;
      END IF;

      -- Action: notify (logged as activity for managers to surface in UI)
      IF v_rules.timeout_action IN ('notify', 'notify_and_reassign') THEN
        INSERT INTO conversation_activity (
          tenant_id, conversation_id, contact_id, actor_type, event_type, payload
        ) VALUES (
          v_conv.tenant_id, v_conv.id, v_conv.contact_id, 'system',
          'manager_notified_risk',
          jsonb_build_object('agent_id', v_previous_agent)
        );
        v_notified := v_notified + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'flagged', v_flagged,
    'reassigned', v_reassigned,
    'notified', v_notified,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_check_assignment_timeouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_assignment_timeouts() TO service_role;

-- Allow status='risk' implicitly (text column already, no enum constraint)
