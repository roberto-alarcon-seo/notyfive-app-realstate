
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
  v_previous_agent uuid;
BEGIN
  FOR v_rules IN
    SELECT tenant_id, lead_timeout_minutes, timeout_action
    FROM assignment_rules
    WHERE COALESCE(lead_timeout_minutes, 0) > 0
  LOOP
    FOR v_conv IN
      SELECT c.id, c.contact_id, c.tenant_id,
             ct.assigned_agent_id AS agent_id,
             c.last_customer_message_at, c.last_agent_message_at
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.tenant_id = v_rules.tenant_id
        AND ct.assigned_agent_id IS NOT NULL
        AND c.status NOT IN ('closed', 'archived', 'risk', 'blocked')
        AND c.risk_flagged_at IS NULL
        AND c.last_customer_message_at IS NOT NULL
        AND (
          c.last_agent_message_at IS NULL
          OR c.last_agent_message_at < c.last_customer_message_at
        )
        AND c.last_customer_message_at < (now() - (v_rules.lead_timeout_minutes || ' minutes')::interval)
      LIMIT 200
    LOOP
      v_previous_agent := v_conv.agent_id;

      UPDATE conversations
      SET status = 'risk', risk_flagged_at = now()
      WHERE id = v_conv.id;
      v_flagged := v_flagged + 1;

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

      IF v_rules.timeout_action IN ('reassign', 'notify_and_reassign') THEN
        BEGIN
          UPDATE contacts SET assigned_agent_id = NULL
          WHERE id = v_conv.contact_id AND assigned_agent_id = v_previous_agent;

          PERFORM public.fn_assign_conversation(
            v_conv.id, 'timeout_reassign', NULL, NULL, 'timeout_reassign'
          );
          v_reassigned := v_reassigned + 1;
        EXCEPTION WHEN OTHERS THEN
          UPDATE contacts SET assigned_agent_id = v_previous_agent
          WHERE id = v_conv.contact_id AND assigned_agent_id IS NULL;
        END;
      END IF;

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
