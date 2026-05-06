---
name: Lead Assignment Engine
description: Motor automático de asignación de leads (Sticky → Property → Round Robin → Fallback) con timeout, riesgo y reasignación
type: feature
---

## Jerarquía de asignación (fn_assign_conversation)
1. **Manual**: si p_force_strategy='manual' y p_force_agent_id provisto.
2. **Sticky**: si sticky_agent_enabled y contact.assigned_agent_id activo (a menos que sticky_overrides_property=false y la propiedad tenga otro asesor).
3. **Property**: asesor en property_assignments del re_property_interest_id.
4. **Round Robin**: rota sobre asesores activos (is_active_for_assignment=true) usando assignment_rules.last_assigned_agent_id; salta saturados (max_active_leads_per_agent).
5. **Fallback**: cualquier admin/manager activo. Si nada, deja null + log 'no_active_agents'.

## Configuración (assignment_rules, 1:1 por tenant)
- round_robin_enabled, sticky_agent_enabled, sticky_overrides_property
- lead_timeout_minutes, timeout_action ('notify' | 'reassign' | 'notify_and_reassign')
- max_active_leads_per_agent (null = sin tope)
- last_assigned_agent_id (puntero RR)

## Timeout y riesgo
- Cron pg_cron `assignment-timeout-monitor-every-5-min` invoca edge function `assignment-timeout-monitor` cada 5 min.
- fn_check_assignment_timeouts marca conversations.status='risk' + risk_flagged_at cuando last_customer_message_at supera el timeout sin respuesta del asesor.
- Reasigna excluyendo al asesor previo cuando timeout_action incluye 'reassign'.
- Trigger trg_clear_risk_on_agent_message limpia el flag automáticamente cuando el asesor envía un mensaje saliente no-AI.

## Auditoría
- Tabla assignment_logs (append-only): strategy ∈ {sticky, property, round_robin, manual, timeout_reassign, fallback}.
- conversation_activity registra event_type 'lead_at_risk' y 'manager_notified_risk'.

## UI
- /settings/assignment-rules: solo admin (toggles + timeouts + flag is_active_for_assignment por asesor).
- /admin-leads: dashboard manager+ con KPIs, distribución por asesor (Recharts hex #942CCC / #ef4444), tabla y reasignación inline.
- AssigneeSelector embebido en ContactProfilePanel del Inbox.
- Badge rojo pulsante en lista de conversaciones cuando status='risk'.

## Edge functions
- assign-conversation: wrapper para reasignación manual o auto desde frontend/webhooks.
- twilio-inbound-webhook + ai-chat-response llaman fn_assign_conversation tras crear conversación o handoff (needs_human=true).
