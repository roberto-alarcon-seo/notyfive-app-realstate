
REVOKE ALL ON FUNCTION public.fn_assign_conversation(uuid, text, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_reassign_conversation(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_count_active_leads_for_agent(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reassign_conversation(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_count_active_leads_for_agent(uuid, uuid) TO authenticated;
-- fn_assign_conversation only callable via service_role / edge functions
GRANT EXECUTE ON FUNCTION public.fn_assign_conversation(uuid, text, uuid, uuid, text) TO service_role;
