
CREATE OR REPLACE FUNCTION public.fn_run_assignment_tests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_a1 uuid := gen_random_uuid();
  v_a2 uuid := gen_random_uuid();
  v_a3 uuid := gen_random_uuid();
  v_prop uuid;
  v_contact uuid;
  v_conv uuid;
  v_res RECORD;
  v_results jsonb := '[]'::jsonb;
  v_started_at timestamptz := clock_timestamp();
  v_pass int := 0;
  v_fail int := 0;
  v_agents_seen uuid[];
  v_i int;
  v_c uuid;
  v_cv uuid;
  v_flagged boolean;
BEGIN
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.is_tenant_manager_or_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- ===== Setup =====
  INSERT INTO public.tenants (id, name, plan, status, max_users, max_contacts)
  VALUES (v_tenant, '__assignment_test_' || substr(v_tenant::text,1,8), 'trial', 'active', 999, 999999);

  INSERT INTO public.assignment_rules (tenant_id, round_robin_enabled, sticky_agent_enabled, sticky_overrides_property, lead_timeout_minutes, timeout_action)
  VALUES (v_tenant, true, true, false, 30, 'notify');

  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, instance_id, created_at, updated_at)
  VALUES
    (v_admin, 'test_admin_'||substr(v_admin::text,1,6)||'@test.local',
      jsonb_build_object('tenant_id', v_tenant::text, 'tenant_role', 'administrador', 'name', 'Test Admin'),
      'authenticated','authenticated','00000000-0000-0000-0000-000000000000', now(), now()),
    (v_a1, 'test_a1_'||substr(v_a1::text,1,6)||'@test.local',
      jsonb_build_object('tenant_id', v_tenant::text, 'tenant_role', 'asesor', 'name', 'Asesor 1'),
      'authenticated','authenticated','00000000-0000-0000-0000-000000000000', now(), now()),
    (v_a2, 'test_a2_'||substr(v_a2::text,1,6)||'@test.local',
      jsonb_build_object('tenant_id', v_tenant::text, 'tenant_role', 'asesor', 'name', 'Asesor 2'),
      'authenticated','authenticated','00000000-0000-0000-0000-000000000000', now(), now()),
    (v_a3, 'test_a3_'||substr(v_a3::text,1,6)||'@test.local',
      jsonb_build_object('tenant_id', v_tenant::text, 'tenant_role', 'asesor', 'name', 'Asesor 3'),
      'authenticated','authenticated','00000000-0000-0000-0000-000000000000', now(), now());

  INSERT INTO public.properties (id, tenant_id, property_code, title, operation_type, zone, price)
  VALUES (gen_random_uuid(), v_tenant, 'TST-001', 'Test Property', 'sale', 'Polanco', 1000000)
  RETURNING id INTO v_prop;

  -- 1. Round Robin global
  INSERT INTO public.contacts (tenant_id, name, phone) VALUES (v_tenant, 'C1', '+5215555550001') RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550001', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_rr');
  v_results := v_results || jsonb_build_object(
    'scenario', '1. Round Robin global (sin propiedad, sin sticky)',
    'expected', 'strategy=round_robin, agente activo del tenant',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id, 'success', v_res.success),
    'passed', (v_res.success AND v_res.strategy = 'round_robin' AND v_res.agent_id IN (v_a1,v_a2,v_a3,v_admin))
  );

  -- 2. Sticky
  INSERT INTO public.contacts (tenant_id, name, phone, assigned_agent_id) VALUES (v_tenant, 'C2', '+5215555550002', v_a2) RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550002', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_sticky');
  v_results := v_results || jsonb_build_object(
    'scenario', '2. Sticky: agente previo se mantiene',
    'expected', 'strategy=sticky, agent=Asesor 2',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.strategy = 'sticky' AND v_res.agent_id = v_a2)
  );

  -- 3. Property
  INSERT INTO public.property_assignments (tenant_id, property_id, user_id) VALUES (v_tenant, v_prop, v_a1);
  INSERT INTO public.contacts (tenant_id, name, phone, re_property_interest_id) VALUES (v_tenant, 'C3', '+5215555550003', v_prop) RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550003', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_property');
  v_results := v_results || jsonb_build_object(
    'scenario', '3. Propiedad con asesor autorizado',
    'expected', 'strategy=property, agent=Asesor 1',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.strategy = 'property' AND v_res.agent_id = v_a1)
  );

  -- 4. Sticky overrides property
  UPDATE public.assignment_rules SET sticky_overrides_property = true WHERE tenant_id = v_tenant;
  INSERT INTO public.contacts (tenant_id, name, phone, assigned_agent_id, re_property_interest_id) VALUES (v_tenant, 'C4', '+5215555550004', v_a2, v_prop) RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550004', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_sticky_override');
  v_results := v_results || jsonb_build_object(
    'scenario', '4. Sticky vence a Propiedad cuando override=true',
    'expected', 'strategy=sticky, agent=Asesor 2',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.strategy = 'sticky' AND v_res.agent_id = v_a2)
  );
  UPDATE public.assignment_rules SET sticky_overrides_property = false WHERE tenant_id = v_tenant;

  -- 5. Property with multiple agents picks lowest load
  INSERT INTO public.property_assignments (tenant_id, property_id, user_id) VALUES (v_tenant, v_prop, v_a3);
  INSERT INTO public.contacts (tenant_id, name, phone, assigned_agent_id, status, operational_status)
  SELECT v_tenant, 'load_'||g, '+52155500'||(1000+g)::text, v_a1, 'active'::contact_status, 'ACTIVE'
  FROM generate_series(1,5) g;
  INSERT INTO public.contacts (tenant_id, name, phone, re_property_interest_id) VALUES (v_tenant, 'C5', '+5215555550005', v_prop) RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550005', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_property_rr');
  v_results := v_results || jsonb_build_object(
    'scenario', '5. Propiedad con 2 asesores: gana el de menor carga',
    'expected', 'agent=Asesor 3 (Asesor 1 saturado con 5 leads)',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.strategy = 'property' AND v_res.agent_id = v_a3)
  );

  -- 6. max_active_leads_per_agent
  UPDATE public.assignment_rules SET max_active_leads_per_agent = 2 WHERE tenant_id = v_tenant;
  INSERT INTO public.contacts (tenant_id, name, phone, re_property_interest_id) VALUES (v_tenant, 'C6', '+5215555550006', v_prop) RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550006', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_cap');
  v_results := v_results || jsonb_build_object(
    'scenario', '6. max_active_leads_per_agent excluye saturados',
    'expected', 'agent=Asesor 3 (Asesor 1 saturado con 5 > cap 2)',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.agent_id = v_a3)
  );
  UPDATE public.assignment_rules SET max_active_leads_per_agent = NULL WHERE tenant_id = v_tenant;

  -- 7. is_active_for_assignment=false
  UPDATE public.profiles SET is_active_for_assignment = false WHERE id IN (v_a1, v_a3);
  INSERT INTO public.contacts (tenant_id, name, phone) VALUES (v_tenant, 'C7', '+5215555550007') RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550007', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_inactive');
  v_results := v_results || jsonb_build_object(
    'scenario', '7. is_active_for_assignment=false excluye al asesor',
    'expected', 'agent=Asesor 2 o Admin (los demás inactivos)',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.agent_id = v_a2 OR v_res.agent_id = v_admin)
  );
  UPDATE public.profiles SET is_active_for_assignment = true WHERE id IN (v_a1, v_a3);

  -- 8. Fallback when no active agents (all inactive)
  UPDATE public.profiles SET is_active_for_assignment = false WHERE tenant_id = v_tenant;
  INSERT INTO public.contacts (tenant_id, name, phone) VALUES (v_tenant, 'C8', '+5215555550008') RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550008', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, NULL, NULL, NULL, 'test_no_agents');
  v_results := v_results || jsonb_build_object(
    'scenario', '8. Sin asesores activos: success=false + error NO_AGENTS_AVAILABLE',
    'expected', 'success=false, error_code=NO_AGENTS_AVAILABLE',
    'actual', jsonb_build_object('success', v_res.success, 'error_code', v_res.error_code),
    'passed', (v_res.success = false AND v_res.error_code = 'NO_AGENTS_AVAILABLE')
  );
  UPDATE public.profiles SET is_active_for_assignment = true WHERE tenant_id = v_tenant;

  -- 9. Manual force
  INSERT INTO public.contacts (tenant_id, name, phone) VALUES (v_tenant, 'C9', '+5215555550009') RETURNING id INTO v_contact;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_contact, '+5215555550009', 'open') RETURNING id INTO v_conv;
  SELECT * INTO v_res FROM public.fn_assign_conversation(v_conv, 'manual', v_a3, v_admin, 'test_manual');
  v_results := v_results || jsonb_build_object(
    'scenario', '9. Reasignación manual respeta el agente forzado',
    'expected', 'strategy=manual, agent=Asesor 3',
    'actual', jsonb_build_object('strategy', v_res.strategy, 'agent', v_res.agent_id),
    'passed', (v_res.strategy = 'manual' AND v_res.agent_id = v_a3)
  );

  -- 10. Audit log
  v_results := v_results || jsonb_build_object(
    'scenario', '10. assignment_logs registra cada asignación',
    'expected', 'count(logs) >= 9',
    'actual', jsonb_build_object('count', (SELECT COUNT(*) FROM public.assignment_logs WHERE tenant_id = v_tenant)),
    'passed', ((SELECT COUNT(*) FROM public.assignment_logs WHERE tenant_id = v_tenant) >= 9)
  );

  -- 11. Round Robin rotates
  v_agents_seen := ARRAY[]::uuid[];
  UPDATE public.assignment_rules SET last_assigned_agent_id = NULL WHERE tenant_id = v_tenant;
  FOR v_i IN 1..3 LOOP
    INSERT INTO public.contacts (tenant_id, name, phone) VALUES (v_tenant, 'RR'||v_i, '+521555556000'||v_i) RETURNING id INTO v_c;
    INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status) VALUES (v_tenant, v_c, '+521555556000'||v_i, 'open') RETURNING id INTO v_cv;
    SELECT * INTO v_res FROM public.fn_assign_conversation(v_cv, NULL, NULL, NULL, 'test_rotation');
    v_agents_seen := v_agents_seen || v_res.agent_id;
  END LOOP;
  v_results := v_results || jsonb_build_object(
    'scenario', '11. Round Robin rota entre asesores',
    'expected', 'al menos 2 asesores distintos en 3 asignaciones',
    'actual', jsonb_build_object('agents_seen', to_jsonb(v_agents_seen)),
    'passed', (SELECT COUNT(DISTINCT a) FROM unnest(v_agents_seen) a) >= 2
  );

  -- 12. Timeout monitor
  INSERT INTO public.contacts (tenant_id, name, phone, assigned_agent_id) VALUES (v_tenant, 'TO', '+5215555570001', v_a1) RETURNING id INTO v_c;
  INSERT INTO public.conversations (tenant_id, contact_id, customer_whatsapp, status, last_customer_message_at, last_agent_message_at)
  VALUES (v_tenant, v_c, '+5215555570001', 'open', now() - interval '2 hours', now() - interval '3 hours') RETURNING id INTO v_cv;
  PERFORM public.fn_check_assignment_timeouts();
  SELECT (risk_flagged_at IS NOT NULL) INTO v_flagged FROM public.conversations WHERE id = v_cv;
  v_results := v_results || jsonb_build_object(
    'scenario', '12. Timeout monitor marca conversación en riesgo',
    'expected', 'risk_flagged_at IS NOT NULL después de pasar el timeout',
    'actual', jsonb_build_object('flagged', v_flagged),
    'passed', v_flagged
  );

  -- Tally
  SELECT
    COUNT(*) FILTER (WHERE (r->>'passed')::boolean),
    COUNT(*) FILTER (WHERE NOT (r->>'passed')::boolean)
  INTO v_pass, v_fail
  FROM jsonb_array_elements(v_results) r;

  -- Cleanup
  DELETE FROM public.tenants WHERE id = v_tenant;
  DELETE FROM auth.users WHERE id IN (v_admin, v_a1, v_a2, v_a3);

  RETURN jsonb_build_object(
    'ok', v_fail = 0,
    'total', v_pass + v_fail,
    'passed', v_pass,
    'failed', v_fail,
    'duration_ms', extract(epoch from (clock_timestamp() - v_started_at)) * 1000,
    'results', v_results
  );

EXCEPTION WHEN OTHERS THEN
  BEGIN DELETE FROM public.tenants WHERE id = v_tenant; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM auth.users WHERE id IN (v_admin, v_a1, v_a2, v_a3); EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_run_assignment_tests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_run_assignment_tests() TO authenticated, service_role;
