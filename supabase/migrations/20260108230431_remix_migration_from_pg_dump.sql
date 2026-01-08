CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: ai_tone; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_tone AS ENUM (
    'cordial',
    'professional',
    'friendly',
    'adaptive'
);


--
-- Name: automation_action_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_action_type AS ENUM (
    'send_message',
    'send_template',
    'delay',
    'assign_agent',
    'add_tag',
    'remove_tag',
    'update_field',
    'create_note',
    'notify_agent'
);


--
-- Name: automation_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_run_status AS ENUM (
    'queued',
    'running',
    'success',
    'failed',
    'skipped_condition',
    'blocked_wallet',
    'blocked_rate',
    'blocked_window',
    'blocked_optout',
    'blocked_template',
    'paused'
);


--
-- Name: automation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_status AS ENUM (
    'draft',
    'active',
    'paused'
);


--
-- Name: automation_step_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_step_status AS ENUM (
    'queued',
    'running',
    'success',
    'failed',
    'skipped',
    'blocked'
);


--
-- Name: automation_trigger_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_trigger_type AS ENUM (
    'inbound_message',
    'window_expiring',
    'window_expired',
    'campaign_touched',
    'campaign_replied',
    'field_changed',
    'tag_changed',
    'scheduled',
    'event.created',
    'event.upcoming',
    'event.canceled',
    'event.completed',
    'event.no_show',
    'event.confirmed'
);


--
-- Name: consent_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_channel AS ENUM (
    'whatsapp'
);


--
-- Name: consent_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.consent_status AS ENUM (
    'allowed',
    'opted_out',
    'dnd',
    'blocked'
);


--
-- Name: contact_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_status AS ENUM (
    'active',
    'archived',
    'deleted'
);


--
-- Name: custom_field_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.custom_field_type AS ENUM (
    'short_text',
    'long_text',
    'number',
    'decimal',
    'boolean',
    'date',
    'datetime',
    'url',
    'select'
);


--
-- Name: global_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.global_role AS ENUM (
    'super_admin',
    'user'
);


--
-- Name: integration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.integration_status AS ENUM (
    'pending_setup',
    'connected',
    'error',
    'disconnected'
);


--
-- Name: kb_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kb_category AS ENUM (
    'general_info',
    'products',
    'services',
    'pricing',
    'purchase_process',
    'payments',
    'policies',
    'schedules',
    'other'
);


--
-- Name: segment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.segment_status AS ENUM (
    'active',
    'archived'
);


--
-- Name: segment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.segment_type AS ENUM (
    'static',
    'dynamic'
);


--
-- Name: tenant_billing_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_billing_state AS ENUM (
    'ONBOARDING_PAID',
    'ACTIVE_WITH_CREDITS',
    'CREDITS_EXHAUSTED',
    'SUBSCRIPTION_REQUIRED',
    'SUBSCRIBED_ACTIVE'
);


--
-- Name: tenant_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_plan AS ENUM (
    'trial',
    'basic',
    'pro',
    'enterprise',
    'starter',
    'growth',
    'scale'
);


--
-- Name: tenant_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_role AS ENUM (
    'owner',
    'marketer',
    'readonly'
);


--
-- Name: tenant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_status AS ENUM (
    'active',
    'suspended',
    'trial'
);


--
-- Name: ticket_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_category AS ENUM (
    'bug',
    'campaign_error',
    'billing',
    'whatsapp_twilio',
    'ux_ui',
    'other'
);


--
-- Name: ticket_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: ticket_sender_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_sender_type AS ENUM (
    'owner',
    'admin',
    'system'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'in_progress',
    'waiting_customer',
    'resolved',
    'closed'
);


--
-- Name: wallet_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_status AS ENUM (
    'active',
    'low',
    'blocked'
);


--
-- Name: wallet_transaction_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_transaction_reason AS ENUM (
    'inbound_message',
    'outbound_message',
    'campaign_message',
    'template_message',
    'manual_adjustment'
);


--
-- Name: wallet_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_transaction_type AS ENUM (
    'topup',
    'debit'
);


--
-- Name: activate_tenant_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_tenant_subscription(p_tenant_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.tenants
  SET billing_state = 'SUBSCRIBED_ACTIVE',
      updated_at = now()
  WHERE id = p_tenant_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: audit_cross_tenant_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_cross_tenant_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_target_tenant_id uuid;
  v_effective_tenant_id uuid;
BEGIN
  -- Only audit if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_actor_tenant_id := get_user_tenant_id(auth.uid());

  -- Handle the tenants table specially - it uses 'id' not 'tenant_id'
  IF TG_TABLE_NAME = 'tenants' THEN
    v_target_tenant_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  END IF;

  -- If the target tenant doesn't exist (e.g. AFTER DELETE on tenants),
  -- don't insert an invalid foreign key reference.
  v_effective_tenant_id := v_target_tenant_id;
  IF v_effective_tenant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_effective_tenant_id) THEN
      v_effective_tenant_id := NULL;
    END IF;
  END IF;

  -- Log when super_admin accesses another tenant's data
  IF is_super_admin(auth.uid()) AND v_actor_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
    VALUES (
      v_effective_tenant_id,
      auth.uid(),
      'cross_tenant_access',
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'actor_tenant_id', v_actor_tenant_id,
        'target_tenant_id', v_target_tenant_id
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: can_send_message(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_send_message(p_tenant_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_state public.tenant_billing_state;
  v_credits integer;
BEGIN
  SELECT billing_state, message_credits
  INTO v_state, v_credits
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Suscriptores siempre pueden enviar
  IF v_state = 'SUBSCRIBED_ACTIVE' THEN
    RETURN true;
  END IF;
  
  -- Con créditos activos y balance positivo
  IF v_state = 'ACTIVE_WITH_CREDITS' AND v_credits > 0 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;


--
-- Name: can_tenant_send_message(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_tenant_send_message(p_tenant_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_state public.tenant_billing_state;
  v_credits integer;
BEGIN
  SELECT billing_state, message_credits
  INTO v_state, v_credits
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Allow if subscribed
  IF v_state = 'SUBSCRIBED_ACTIVE' THEN
    RETURN true;
  END IF;
  
  -- Allow if active with credits remaining
  IF v_state = 'ACTIVE_WITH_CREDITS' AND v_credits > 0 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;


--
-- Name: check_tenant_contact_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_tenant_contact_limit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  _tenant_id UUID;
  _max_contacts INTEGER;
  _current_contacts INTEGER;
BEGIN
  _tenant_id := NEW.tenant_id;
  
  -- Get tenant limits
  SELECT max_contacts INTO _max_contacts
  FROM public.tenants
  WHERE id = _tenant_id;
  
  -- Count current active contacts
  SELECT COUNT(*) INTO _current_contacts
  FROM public.contacts
  WHERE tenant_id = _tenant_id
    AND status = 'active';
  
  -- Check if limit would be exceeded
  IF _current_contacts >= _max_contacts THEN
    RAISE EXCEPTION 'Has alcanzado el número máximo de contactos permitidos por tu plan. Actualiza tu plan para agregar más contactos.';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_tenant_user_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_tenant_user_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _tenant_id UUID;
  _max_users INTEGER;
  _current_users INTEGER;
  _is_owner BOOLEAN;
BEGIN
  -- Get tenant_id from the new profile
  _tenant_id := NEW.tenant_id;
  
  -- Skip check if no tenant_id (super admin)
  IF _tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this user is being assigned as owner
  -- If so, skip the limit check (owner doesn't count against limit)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND tenant_role = 'owner'
  ) INTO _is_owner;
  
  -- Also check if we're in the middle of creating an owner (profile created before role)
  -- This happens during tenant creation flow
  IF _is_owner OR NEW.status = 'inactive' THEN
    -- Owners and inactive users (pending activation) don't count
    RETURN NEW;
  END IF;
  
  -- Get tenant limits
  SELECT max_users INTO _max_users
  FROM public.tenants
  WHERE id = _tenant_id;
  
  -- Count current active users in the tenant (excluding owners)
  SELECT COUNT(*) INTO _current_users
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.tenant_id = _tenant_id
    AND p.status = 'active'
    AND ur.tenant_role != 'owner';  -- Exclude owners from count
  
  -- Check if limit would be exceeded
  IF _current_users >= _max_users THEN
    RAISE EXCEPTION 'Has alcanzado el número máximo de usuarios permitidos por tu plan. Actualiza tu plan para agregar más usuarios.';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: complete_tenant_onboarding(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_tenant_onboarding(p_tenant_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_state public.tenant_billing_state;
BEGIN
  SELECT billing_state INTO v_current_state
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Only allow transition from ONBOARDING_PAID
  IF v_current_state != 'ONBOARDING_PAID' THEN
    RETURN false;
  END IF;
  
  -- Transition to ACTIVE_WITH_CREDITS (trigger will grant credits)
  UPDATE public.tenants
  SET billing_state = 'ACTIVE_WITH_CREDITS',
      updated_at = now()
  WHERE id = p_tenant_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: create_wallet_for_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_wallet_for_tenant() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.wallets (tenant_id, balance_messages, status)
  VALUES (NEW.id, 0, 'blocked');
  RETURN NEW;
END;
$$;


--
-- Name: deduct_message_credit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_message_credit(p_tenant_id uuid) RETURNS TABLE(success boolean, remaining_credits integer, billing_state public.tenant_billing_state)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_credits integer;
  v_current_state public.tenant_billing_state;
BEGIN
  -- Get current state
  SELECT t.message_credits, t.billing_state 
  INTO v_current_credits, v_current_state
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;
  
  -- Check if sending is allowed
  IF v_current_state NOT IN ('ACTIVE_WITH_CREDITS', 'SUBSCRIBED_ACTIVE') THEN
    RETURN QUERY SELECT false, v_current_credits, v_current_state;
    RETURN;
  END IF;
  
  -- For subscribed tenants, allow sending without credit deduction
  IF v_current_state = 'SUBSCRIBED_ACTIVE' THEN
    RETURN QUERY SELECT true, v_current_credits, v_current_state;
    RETURN;
  END IF;
  
  -- Check if credits available
  IF v_current_credits <= 0 THEN
    -- Update state to CREDITS_EXHAUSTED
    UPDATE public.tenants
    SET billing_state = 'CREDITS_EXHAUSTED',
        updated_at = now()
    WHERE id = p_tenant_id;
    
    RETURN QUERY SELECT false, 0, 'CREDITS_EXHAUSTED'::public.tenant_billing_state;
    RETURN;
  END IF;
  
  -- Deduct credit
  UPDATE public.tenants
  SET message_credits = message_credits - 1,
      updated_at = now()
  WHERE id = p_tenant_id
  RETURNING message_credits INTO v_current_credits;
  
  -- Check if credits exhausted after deduction
  IF v_current_credits <= 0 THEN
    UPDATE public.tenants
    SET billing_state = 'CREDITS_EXHAUSTED',
        updated_at = now()
    WHERE id = p_tenant_id;
    
    RETURN QUERY SELECT true, 0, 'CREDITS_EXHAUSTED'::public.tenant_billing_state;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_current_credits, 'ACTIVE_WITH_CREDITS'::public.tenant_billing_state;
END;
$$;


--
-- Name: emit_automation_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_automation_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _event_name TEXT;
  _entity_type TEXT;
  _entity_id UUID;
  _payload JSONB;
  _tenant_id UUID;
BEGIN
  -- Determine the table and operation
  _entity_type := TG_TABLE_NAME;
  
  -- Get tenant_id based on table
  IF TG_TABLE_NAME = 'events' THEN
    IF TG_OP = 'DELETE' THEN
      _tenant_id := OLD.tenant_id;
      _entity_id := OLD.id;
    ELSE
      _tenant_id := NEW.tenant_id;
      _entity_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'contacts' THEN
    IF TG_OP = 'DELETE' THEN
      _tenant_id := OLD.tenant_id;
      _entity_id := OLD.id;
    ELSE
      _tenant_id := NEW.tenant_id;
      _entity_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'contact_custom_field_values' THEN
    IF TG_OP = 'DELETE' THEN
      _entity_id := OLD.contact_id;
    ELSE
      _entity_id := NEW.contact_id;
    END IF;
    -- Get tenant_id from contact
    SELECT tenant_id INTO _tenant_id FROM public.contacts WHERE id = _entity_id;
  END IF;

  -- Skip if no tenant found
  IF _tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine event name and payload based on table and operation
  IF TG_TABLE_NAME = 'events' THEN
    IF TG_OP = 'INSERT' THEN
      _event_name := 'event.created';
      _payload := jsonb_build_object(
        'contact_id', NEW.contact_id,
        'event_id', NEW.id,
        'event_type', NEW.event_type,
        'status', NEW.status,
        'start_at', NEW.start_at,
        'title', NEW.title
      );
    ELSIF TG_OP = 'UPDATE' THEN
      -- Check if status changed to cancelled
      IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        _event_name := 'event.cancelled';
        _payload := jsonb_build_object(
          'contact_id', NEW.contact_id,
          'event_id', NEW.id,
          'event_type', NEW.event_type,
          'previous_status', OLD.status,
          'title', NEW.title
        );
      -- Check if status changed (rescheduled)
      ELSIF NEW.start_at != OLD.start_at THEN
        _event_name := 'event.rescheduled';
        _payload := jsonb_build_object(
          'contact_id', NEW.contact_id,
          'event_id', NEW.id,
          'previous_start_at', OLD.start_at,
          'new_start_at', NEW.start_at,
          'title', NEW.title
        );
      -- Check if status changed to confirmed
      ELSIF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        _event_name := 'event.confirmed';
        _payload := jsonb_build_object(
          'contact_id', NEW.contact_id,
          'event_id', NEW.id,
          'event_type', NEW.event_type,
          'title', NEW.title
        );
      -- Check if status changed to completed
      ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        _event_name := 'event.completed';
        _payload := jsonb_build_object(
          'contact_id', NEW.contact_id,
          'event_id', NEW.id,
          'event_type', NEW.event_type,
          'title', NEW.title
        );
      ELSE
        -- No relevant change
        RETURN NEW;
      END IF;
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'contacts' THEN
    IF TG_OP = 'UPDATE' THEN
      -- Check for tag changes
      IF NEW.tags IS DISTINCT FROM OLD.tags THEN
        DECLARE
          _added_tags TEXT[];
          _removed_tags TEXT[];
        BEGIN
          _added_tags := ARRAY(
            SELECT unnest(COALESCE(NEW.tags, ARRAY[]::TEXT[])) 
            EXCEPT 
            SELECT unnest(COALESCE(OLD.tags, ARRAY[]::TEXT[]))
          );
          _removed_tags := ARRAY(
            SELECT unnest(COALESCE(OLD.tags, ARRAY[]::TEXT[]))
            EXCEPT 
            SELECT unnest(COALESCE(NEW.tags, ARRAY[]::TEXT[]))
          );
          
          -- Emit tag_added for each new tag
          IF array_length(_added_tags, 1) > 0 THEN
            INSERT INTO public.system_event_bus (tenant_id, event_name, entity_type, entity_id, payload, status)
            VALUES (
              _tenant_id,
              'tag_added',
              'contact',
              NEW.id,
              jsonb_build_object(
                'contact_id', NEW.id,
                'tags_added', _added_tags,
                'current_tags', NEW.tags
              ),
              'pending'
            );
          END IF;
          
          -- Emit tag_removed for each removed tag
          IF array_length(_removed_tags, 1) > 0 THEN
            INSERT INTO public.system_event_bus (tenant_id, event_name, entity_type, entity_id, payload, status)
            VALUES (
              _tenant_id,
              'tag_removed',
              'contact',
              NEW.id,
              jsonb_build_object(
                'contact_id', NEW.id,
                'tags_removed', _removed_tags,
                'current_tags', NEW.tags
              ),
              'pending'
            );
          END IF;
        END;
      END IF;
      
      -- Check for field changes (standard fields)
      IF NEW.name IS DISTINCT FROM OLD.name OR
         NEW.email IS DISTINCT FROM OLD.email OR
         NEW.phone IS DISTINCT FROM OLD.phone OR
         NEW.country IS DISTINCT FROM OLD.country OR
         NEW.status IS DISTINCT FROM OLD.status THEN
        _event_name := 'field_changed';
        _payload := jsonb_build_object(
          'contact_id', NEW.id,
          'changes', jsonb_build_object(
            'name', CASE WHEN NEW.name IS DISTINCT FROM OLD.name 
                    THEN jsonb_build_object('old', OLD.name, 'new', NEW.name) END,
            'email', CASE WHEN NEW.email IS DISTINCT FROM OLD.email 
                     THEN jsonb_build_object('old', OLD.email, 'new', NEW.email) END,
            'phone', CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone 
                     THEN jsonb_build_object('old', OLD.phone, 'new', NEW.phone) END,
            'country', CASE WHEN NEW.country IS DISTINCT FROM OLD.country 
                       THEN jsonb_build_object('old', OLD.country, 'new', NEW.country) END,
            'status', CASE WHEN NEW.status IS DISTINCT FROM OLD.status 
                      THEN jsonb_build_object('old', OLD.status::text, 'new', NEW.status::text) END
          )
        );
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'contact_custom_field_values' THEN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      _event_name := 'field_changed';
      _entity_type := 'contact';
      _payload := jsonb_build_object(
        'contact_id', NEW.contact_id,
        'field_id', NEW.field_id,
        'old_value', CASE WHEN TG_OP = 'UPDATE' THEN OLD.value_text END,
        'new_value', NEW.value_text,
        'is_custom_field', true
      );
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- Insert the event if we have one
  IF _event_name IS NOT NULL THEN
    INSERT INTO public.system_event_bus (tenant_id, event_name, entity_type, entity_id, payload, status)
    VALUES (_tenant_id, _event_name, COALESCE(_entity_type, TG_TABLE_NAME), _entity_id, _payload, 'pending');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: fn_add_extra_credits(uuid, integer, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_add_extra_credits(p_tenant_id uuid, p_amount integer, p_reason text DEFAULT 'credit_pack_purchase'::text, p_source_table text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(success boolean, new_total integer, new_extra integer, error_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tenant RECORD;
  v_total_before integer;
  v_total_after integer;
  v_extra_after integer;
  v_existing_ledger uuid;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'INVALID_AMOUNT'::text;
    RETURN;
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_ledger
    FROM public.wallet_ledger
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_ledger IS NOT NULL THEN
      -- Already processed, return current state
      SELECT 
        t.monthly_credits_remaining + t.accumulated_credits + COALESCE(t.extra_credits, 0),
        COALESCE(t.extra_credits, 0)
      INTO v_total_after, v_extra_after
      FROM public.tenants t
      WHERE t.id = p_tenant_id;
      
      RETURN QUERY SELECT true, v_total_after, v_extra_after, NULL::text;
      RETURN;
    END IF;
  END IF;

  -- Lock row
  SELECT 
    t.monthly_credits_remaining, 
    t.accumulated_credits, 
    COALESCE(t.extra_credits, 0) as extra_credits,
    t.billing_state
  INTO v_tenant
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'TENANT_NOT_FOUND'::text;
    RETURN;
  END IF;
  
  v_total_before := v_tenant.monthly_credits_remaining + v_tenant.accumulated_credits + v_tenant.extra_credits;
  v_extra_after := v_tenant.extra_credits + p_amount;
  v_total_after := v_tenant.monthly_credits_remaining + v_tenant.accumulated_credits + v_extra_after;
  
  -- Update tenants
  UPDATE public.tenants t
  SET 
    extra_credits = v_extra_after,
    message_credits = v_total_after,
    billing_state = CASE 
      WHEN t.billing_state = 'CREDITS_EXHAUSTED' AND v_total_after > 0 THEN 'ACTIVE_WITH_CREDITS'::public.tenant_billing_state
      ELSE t.billing_state 
    END,
    updated_at = now()
  WHERE t.id = p_tenant_id;
  
  -- Sync wallets
  UPDATE public.wallets
  SET 
    balance_messages = v_total_after,
    status = CASE 
      WHEN v_total_after <= 0 THEN 'blocked'::wallet_status
      WHEN v_total_after <= low_threshold THEN 'low'::wallet_status
      ELSE 'active'::wallet_status
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Record in wallet_ledger
  INSERT INTO public.wallet_ledger (
    tenant_id, movement_type, amount, reason, source_table, source_id, 
    idempotency_key, balance_before, balance_after, bucket
  ) VALUES (
    p_tenant_id, 'credit', p_amount, p_reason, p_source_table, p_source_id,
    p_idempotency_key, v_total_before, v_total_after, 'extra'
  );
  
  RETURN QUERY SELECT true, v_total_after, v_extra_after, NULL::text;
END;
$$;


--
-- Name: fn_apply_credit_movement(uuid, text, integer, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_apply_credit_movement(p_tenant_id uuid, p_movement_type text, p_amount integer, p_reason text DEFAULT NULL::text, p_source_table text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(success boolean, new_balance integer, billing_state public.tenant_billing_state, error_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_monthly integer;
  v_accumulated integer;
  v_extra integer;
  v_total integer;
  v_current_state public.tenant_billing_state;
  v_new_monthly integer;
  v_new_accumulated integer;
  v_new_extra integer;
  v_new_total integer;
  v_amount_from_monthly integer := 0;
  v_amount_from_accumulated integer := 0;
  v_amount_from_extra integer := 0;
  v_remaining integer;
  v_existing_ledger uuid;
  v_bucket text;
BEGIN
  -- Validar inputs
  IF p_movement_type NOT IN ('credit', 'debit') THEN
    RETURN QUERY SELECT false, 0, 'ONBOARDING_PAID'::public.tenant_billing_state, 'INVALID_MOVEMENT_TYPE'::text;
    RETURN;
  END IF;

  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 'ONBOARDING_PAID'::public.tenant_billing_state, 'INVALID_AMOUNT'::text;
    RETURN;
  END IF;

  -- Verificar idempotencia
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_ledger
    FROM public.wallet_ledger
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_ledger IS NOT NULL THEN
      -- Ya existe, retornar el balance actual sin hacer nada
      SELECT (t.monthly_credits_remaining + t.accumulated_credits + COALESCE(t.extra_credits, 0)), t.billing_state
      INTO v_total, v_current_state
      FROM public.tenants t
      WHERE t.id = p_tenant_id;

      RETURN QUERY SELECT true, v_total, v_current_state, NULL::text;
      RETURN;
    END IF;
  END IF;

  -- Lock row para evitar race conditions
  SELECT t.monthly_credits_remaining, t.accumulated_credits, COALESCE(t.extra_credits, 0), t.billing_state
  INTO v_monthly, v_accumulated, v_extra, v_current_state
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'ONBOARDING_PAID'::public.tenant_billing_state, 'TENANT_NOT_FOUND'::text;
    RETURN;
  END IF;

  v_total := v_monthly + v_accumulated + v_extra;

  -- Procesar según tipo de movimiento
  IF p_movement_type = 'credit' THEN
    -- Los créditos revertidos van a accumulated_credits
    v_new_monthly := v_monthly;
    v_new_accumulated := v_accumulated + p_amount;
    v_new_extra := v_extra;
    v_new_total := v_new_monthly + v_new_accumulated + v_new_extra;
    v_bucket := 'rollover';
  ELSE
    -- DEBIT: verificar saldo suficiente
    IF v_total < p_amount THEN
      -- Actualizar estado a CREDITS_EXHAUSTED
      UPDATE public.tenants t
      SET billing_state = 'CREDITS_EXHAUSTED', updated_at = now()
      WHERE t.id = p_tenant_id;

      RETURN QUERY SELECT false, v_total, 'CREDITS_EXHAUSTED'::public.tenant_billing_state, 'INSUFFICIENT_CREDITS'::text;
      RETURN;
    END IF;

    -- ============================================
    -- CONSUMPTION ORDER: MONTHLY -> ACCUMULATED -> EXTRA
    -- (Consistent with fn_debit_credits)
    -- ============================================
    v_remaining := p_amount;
    
    -- Step 1: Debit from monthly first
    IF v_monthly > 0 AND v_remaining > 0 THEN
      v_amount_from_monthly := LEAST(v_monthly, v_remaining);
      v_remaining := v_remaining - v_amount_from_monthly;
    END IF;
    
    -- Step 2: Debit from accumulated
    IF v_accumulated > 0 AND v_remaining > 0 THEN
      v_amount_from_accumulated := LEAST(v_accumulated, v_remaining);
      v_remaining := v_remaining - v_amount_from_accumulated;
    END IF;
    
    -- Step 3: Debit from extra (credit packs)
    IF v_extra > 0 AND v_remaining > 0 THEN
      v_amount_from_extra := LEAST(v_extra, v_remaining);
      v_remaining := v_remaining - v_amount_from_extra;
    END IF;

    v_new_monthly := v_monthly - v_amount_from_monthly;
    v_new_accumulated := v_accumulated - v_amount_from_accumulated;
    v_new_extra := v_extra - v_amount_from_extra;
    v_new_total := v_new_monthly + v_new_accumulated + v_new_extra;
    
    -- Determine bucket for ledger
    IF v_amount_from_monthly > 0 AND v_amount_from_accumulated = 0 AND v_amount_from_extra = 0 THEN
      v_bucket := 'monthly';
    ELSIF v_amount_from_accumulated > 0 AND v_amount_from_monthly = 0 AND v_amount_from_extra = 0 THEN
      v_bucket := 'rollover';
    ELSIF v_amount_from_extra > 0 AND v_amount_from_monthly = 0 AND v_amount_from_accumulated = 0 THEN
      v_bucket := 'extra';
    ELSE
      v_bucket := 'mixed';
    END IF;
  END IF;

  -- Actualizar tenants con las nuevas columnas
  UPDATE public.tenants t
  SET
    monthly_credits_remaining = v_new_monthly,
    accumulated_credits = v_new_accumulated,
    extra_credits = v_new_extra,
    message_credits = v_new_total,
    billing_state = CASE
      WHEN v_new_total <= 0 THEN 'CREDITS_EXHAUSTED'::public.tenant_billing_state
      WHEN v_current_state = 'CREDITS_EXHAUSTED' AND v_new_total > 0 THEN 'ACTIVE_WITH_CREDITS'::public.tenant_billing_state
      ELSE t.billing_state
    END,
    updated_at = now()
  WHERE t.id = p_tenant_id
  RETURNING t.billing_state INTO v_current_state;

  -- Sincronizar wallets
  UPDATE public.wallets
  SET
    balance_messages = v_new_total,
    balance_monthly = v_new_monthly,
    balance_rollover = v_new_accumulated,
    status = CASE
      WHEN v_new_total <= 0 THEN 'blocked'::wallet_status
      WHEN v_new_total <= low_threshold THEN 'low'::wallet_status
      ELSE 'active'::wallet_status
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  -- Insertar en wallet_ledger
  INSERT INTO public.wallet_ledger (
    tenant_id, movement_type, amount, reason, source_table, source_id,
    idempotency_key, balance_before, balance_after, bucket
  ) VALUES (
    p_tenant_id, p_movement_type, p_amount, p_reason, p_source_table, p_source_id,
    p_idempotency_key, v_total, v_new_total, v_bucket
  );

  RETURN QUERY SELECT true, v_new_total, v_current_state, NULL::text;
END;
$$;


--
-- Name: fn_debit_credits(uuid, integer, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_debit_credits(p_tenant_id uuid, p_amount integer DEFAULT 1, p_reason text DEFAULT 'message'::text, p_source_table text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(success boolean, total_remaining integer, monthly_remaining integer, accumulated integer, extra integer, billing_state public.tenant_billing_state, error_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tenant RECORD;
  v_total integer;
  v_monthly_after integer;
  v_accumulated_after integer;
  v_extra_after integer;
  v_amount_from_monthly integer := 0;
  v_amount_from_accumulated integer := 0;
  v_amount_from_extra integer := 0;
  v_remaining integer;
  v_existing_ledger uuid;
  v_result_billing_state public.tenant_billing_state;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, 'ONBOARDING_PAID'::public.tenant_billing_state, 'INVALID_AMOUNT'::text;
    RETURN;
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_ledger
    FROM public.wallet_ledger
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_ledger IS NOT NULL THEN
      -- Already processed, return current state
      SELECT t.monthly_credits_remaining, t.accumulated_credits, COALESCE(t.extra_credits, 0), t.billing_state
      INTO v_tenant
      FROM public.tenants t
      WHERE t.id = p_tenant_id;
      
      v_total := v_tenant.monthly_credits_remaining + v_tenant.accumulated_credits + v_tenant.extra_credits;
      RETURN QUERY SELECT true, v_total, v_tenant.monthly_credits_remaining, v_tenant.accumulated_credits, v_tenant.extra_credits, v_tenant.billing_state, NULL::text;
      RETURN;
    END IF;
  END IF;

  -- Lock row
  SELECT t.monthly_credits_remaining, t.accumulated_credits, COALESCE(t.extra_credits, 0) as extra_credits, t.billing_state, t.message_credits
  INTO v_tenant
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0, 'ONBOARDING_PAID'::public.tenant_billing_state, 'TENANT_NOT_FOUND'::text;
    RETURN;
  END IF;
  
  v_total := v_tenant.monthly_credits_remaining + v_tenant.accumulated_credits + v_tenant.extra_credits;
  
  -- Check sufficient balance
  IF v_total < p_amount THEN
    -- Update state to CREDITS_EXHAUSTED
    UPDATE public.tenants
    SET billing_state = 'CREDITS_EXHAUSTED', updated_at = now()
    WHERE id = p_tenant_id;
    
    RETURN QUERY SELECT false, v_total, v_tenant.monthly_credits_remaining, v_tenant.accumulated_credits, v_tenant.extra_credits, 'CREDITS_EXHAUSTED'::public.tenant_billing_state, 'INSUFFICIENT_CREDITS'::text;
    RETURN;
  END IF;
  
  -- CONSUMPTION ORDER: monthly -> accumulated -> extra
  v_remaining := p_amount;
  
  -- Step 1: Debit from monthly first
  IF v_tenant.monthly_credits_remaining > 0 AND v_remaining > 0 THEN
    v_amount_from_monthly := LEAST(v_tenant.monthly_credits_remaining, v_remaining);
    v_remaining := v_remaining - v_amount_from_monthly;
  END IF;
  
  -- Step 2: Debit from accumulated
  IF v_tenant.accumulated_credits > 0 AND v_remaining > 0 THEN
    v_amount_from_accumulated := LEAST(v_tenant.accumulated_credits, v_remaining);
    v_remaining := v_remaining - v_amount_from_accumulated;
  END IF;
  
  -- Step 3: Debit from extra (credit packs)
  IF v_tenant.extra_credits > 0 AND v_remaining > 0 THEN
    v_amount_from_extra := LEAST(v_tenant.extra_credits, v_remaining);
    v_remaining := v_remaining - v_amount_from_extra;
  END IF;
  
  v_monthly_after := v_tenant.monthly_credits_remaining - v_amount_from_monthly;
  v_accumulated_after := v_tenant.accumulated_credits - v_amount_from_accumulated;
  v_extra_after := v_tenant.extra_credits - v_amount_from_extra;
  v_total := v_monthly_after + v_accumulated_after + v_extra_after;
  
  -- Update tenants
  UPDATE public.tenants t
  SET 
    monthly_credits_remaining = v_monthly_after,
    accumulated_credits = v_accumulated_after,
    extra_credits = v_extra_after,
    message_credits = v_total,
    billing_state = CASE 
      WHEN v_total <= 0 THEN 'CREDITS_EXHAUSTED'::public.tenant_billing_state
      ELSE t.billing_state 
    END,
    updated_at = now()
  WHERE t.id = p_tenant_id
  RETURNING t.billing_state INTO v_result_billing_state;
  
  -- Sync wallets
  UPDATE public.wallets
  SET 
    balance_messages = v_total,
    balance_monthly = v_monthly_after,
    balance_rollover = v_accumulated_after,
    status = CASE 
      WHEN v_total <= 0 THEN 'blocked'::wallet_status
      WHEN v_total <= low_threshold THEN 'low'::wallet_status
      ELSE 'active'::wallet_status
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Record in wallet_ledger with bucket info
  INSERT INTO public.wallet_ledger (
    tenant_id, movement_type, amount, reason, source_table, source_id, 
    idempotency_key, balance_before, balance_after, bucket
  ) VALUES (
    p_tenant_id, 'debit', p_amount, p_reason, p_source_table, p_source_id,
    p_idempotency_key, 
    v_tenant.monthly_credits_remaining + v_tenant.accumulated_credits + v_tenant.extra_credits, 
    v_total,
    CASE 
      WHEN v_amount_from_monthly > 0 AND v_amount_from_accumulated = 0 AND v_amount_from_extra = 0 THEN 'monthly'
      WHEN v_amount_from_accumulated > 0 AND v_amount_from_monthly = 0 AND v_amount_from_extra = 0 THEN 'accumulated'
      WHEN v_amount_from_extra > 0 AND v_amount_from_monthly = 0 AND v_amount_from_accumulated = 0 THEN 'extra'
      ELSE 'mixed'
    END
  );
  
  RETURN QUERY SELECT true, v_total, v_monthly_after, v_accumulated_after, v_extra_after, v_result_billing_state, NULL::text;
END;
$$;


--
-- Name: fn_get_tenant_credits(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_tenant_credits(p_tenant_id uuid) RETURNS TABLE(total integer, monthly_remaining integer, accumulated integer, extra integer, billing_state public.tenant_billing_state, last_refill_at timestamp with time zone, next_refill_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    (t.monthly_credits_remaining + t.accumulated_credits + COALESCE(t.extra_credits, 0))::integer as total,
    t.monthly_credits_remaining,
    t.accumulated_credits,
    COALESCE(t.extra_credits, 0) as extra,
    t.billing_state,
    t.last_refill_at,
    t.next_refill_at
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
END;
$$;


--
-- Name: fn_get_wallet_balances(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_wallet_balances(p_tenant_id uuid) RETURNS TABLE(balance_rollover integer, balance_monthly integer, total integer, status public.wallet_status)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.balance_rollover,
    w.balance_monthly,
    (w.balance_rollover + w.balance_monthly)::integer as total,
    w.status
  FROM public.wallets w
  WHERE w.tenant_id = p_tenant_id;
END;
$$;


--
-- Name: fn_refill_monthly_credits(uuid, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_refill_monthly_credits(p_tenant_id uuid, p_refill_at timestamp with time zone DEFAULT now(), p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(success boolean, total_credits integer, monthly_remaining integer, accumulated integer, error_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tenant RECORD;
  v_cycle_key text;
  v_new_accumulated integer;
  v_new_monthly integer;
  v_total integer;
  v_existing_refill timestamptz;
BEGIN
  -- Lock row para evitar race conditions
  SELECT t.plan, t.monthly_credits_remaining, t.accumulated_credits, t.last_refill_at, t.billing_state
  INTO v_tenant
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'TENANT_NOT_FOUND'::text;
    RETURN;
  END IF;
  
  -- Generar idempotency key basado en mes/año si no se proporciona
  v_cycle_key := COALESCE(p_idempotency_key, p_tenant_id::text || '-' || to_char(p_refill_at, 'YYYY-MM'));
  
  -- Verificar si ya se hizo refill este ciclo (mismo mes)
  IF v_tenant.last_refill_at IS NOT NULL AND 
     date_trunc('month', v_tenant.last_refill_at) = date_trunc('month', p_refill_at) THEN
    -- Ya se recargó este mes, retornar valores actuales sin modificar
    v_total := v_tenant.monthly_credits_remaining + v_tenant.accumulated_credits;
    RETURN QUERY SELECT true, v_total, v_tenant.monthly_credits_remaining, v_tenant.accumulated_credits, NULL::text;
    RETURN;
  END IF;
  
  -- Calcular nuevos valores con rollover
  v_new_accumulated := v_tenant.accumulated_credits + v_tenant.monthly_credits_remaining;
  v_new_monthly := get_plan_monthly_credits(v_tenant.plan);
  v_total := v_new_accumulated + v_new_monthly;
  
  -- Actualizar tenants
  UPDATE public.tenants
  SET 
    monthly_credits_remaining = v_new_monthly,
    accumulated_credits = v_new_accumulated,
    message_credits = v_total,
    last_refill_at = p_refill_at,
    next_refill_at = p_refill_at + interval '1 month',
    billing_state = CASE 
      WHEN v_total > 0 THEN 'ACTIVE_WITH_CREDITS'::public.tenant_billing_state
      ELSE billing_state 
    END,
    updated_at = now()
  WHERE id = p_tenant_id;
  
  -- Sincronizar wallets (legacy)
  UPDATE public.wallets
  SET 
    balance_messages = v_total,
    status = CASE 
      WHEN v_total <= 0 THEN 'blocked'::wallet_status
      WHEN v_total <= low_threshold THEN 'low'::wallet_status
      ELSE 'active'::wallet_status
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  RETURN QUERY SELECT true, v_total, v_new_monthly, v_new_accumulated, NULL::text;
END;
$$;


--
-- Name: fn_wallet_debit_credits(uuid, integer, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_wallet_debit_credits(p_tenant_id uuid, p_amount integer DEFAULT 1, p_reason text DEFAULT 'message'::text, p_related_entity_type text DEFAULT NULL::text, p_related_entity_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(success boolean, duplicated boolean, debited_rollover integer, debited_monthly integer, balance_rollover_after integer, balance_monthly_after integer, total_after integer, error_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_wallet RECORD;
  v_rollover integer;
  v_monthly integer;
  v_total integer;
  v_debit_rollover integer := 0;
  v_debit_monthly integer := 0;
  v_remaining integer;
  v_new_rollover integer;
  v_new_monthly integer;
  v_new_total integer;
  v_conflict boolean := false;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, false, 0, 0, 0, 0, 0, 'INVALID_AMOUNT'::text;
    RETURN;
  END IF;

  -- Check idempotency (if key provided)
  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.wallet_idempotency (tenant_id, idempotency_key)
      VALUES (p_tenant_id, p_idempotency_key);
    EXCEPTION WHEN unique_violation THEN
      -- Already processed, return success without debiting
      SELECT w.balance_rollover, w.balance_monthly
      INTO v_rollover, v_monthly
      FROM public.wallets w
      WHERE w.tenant_id = p_tenant_id;
      
      v_total := COALESCE(v_rollover, 0) + COALESCE(v_monthly, 0);
      RETURN QUERY SELECT true, true, 0, 0, v_rollover, v_monthly, v_total, NULL::text;
      RETURN;
    END;
  END IF;

  -- Lock wallet row to prevent race conditions
  SELECT w.balance_rollover, w.balance_monthly, w.balance_messages
  INTO v_wallet
  FROM public.wallets w
  WHERE w.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 0, 0, 0, 0, 0, 'WALLET_NOT_FOUND'::text;
    RETURN;
  END IF;

  v_rollover := COALESCE(v_wallet.balance_rollover, 0);
  v_monthly := COALESCE(v_wallet.balance_monthly, 0);
  v_total := v_rollover + v_monthly;

  -- Check sufficient balance
  IF v_total < p_amount THEN
    -- Update tenant billing state to CREDITS_EXHAUSTED
    UPDATE public.tenants t
    SET billing_state = 'CREDITS_EXHAUSTED', updated_at = now()
    WHERE t.id = p_tenant_id;
    
    RETURN QUERY SELECT false, false, 0, 0, v_rollover, v_monthly, v_total, 'INSUFFICIENT_CREDITS'::text;
    RETURN;
  END IF;

  -- CONSUMPTION ORDER: ROLLOVER FIRST, THEN MONTHLY
  v_remaining := p_amount;
  
  -- Step 1: Debit from rollover (accumulated) first
  IF v_rollover > 0 AND v_remaining > 0 THEN
    v_debit_rollover := LEAST(v_rollover, v_remaining);
    v_remaining := v_remaining - v_debit_rollover;
  END IF;
  
  -- Step 2: Debit from monthly if needed
  IF v_remaining > 0 THEN
    v_debit_monthly := LEAST(v_monthly, v_remaining);
    v_remaining := v_remaining - v_debit_monthly;
  END IF;

  -- Calculate new balances
  v_new_rollover := v_rollover - v_debit_rollover;
  v_new_monthly := v_monthly - v_debit_monthly;
  v_new_total := v_new_rollover + v_new_monthly;

  -- Update wallets table
  UPDATE public.wallets w
  SET 
    balance_rollover = v_new_rollover,
    balance_monthly = v_new_monthly,
    balance_messages = v_new_total,
    status = CASE 
      WHEN v_new_total <= 0 THEN 'blocked'::wallet_status
      WHEN v_new_total <= w.low_threshold THEN 'low'::wallet_status
      ELSE 'active'::wallet_status
    END,
    updated_at = now()
  WHERE w.tenant_id = p_tenant_id;

  -- Sync with tenants table
  UPDATE public.tenants t
  SET 
    accumulated_credits = v_new_rollover,
    monthly_credits_remaining = v_new_monthly,
    message_credits = v_new_total,
    billing_state = CASE 
      WHEN v_new_total <= 0 THEN 'CREDITS_EXHAUSTED'::public.tenant_billing_state
      ELSE t.billing_state 
    END,
    updated_at = now()
  WHERE t.id = p_tenant_id;

  -- Write ledger entries for traceability
  IF v_debit_rollover > 0 THEN
    INSERT INTO public.wallet_ledger (
      tenant_id, movement_type, amount, reason, source_table, source_id,
      idempotency_key, balance_before, balance_after, bucket
    ) VALUES (
      p_tenant_id, 'debit', v_debit_rollover, p_reason, p_related_entity_type, p_related_entity_id,
      p_idempotency_key, v_total, v_new_total, 'rollover'
    );
  END IF;

  IF v_debit_monthly > 0 THEN
    INSERT INTO public.wallet_ledger (
      tenant_id, movement_type, amount, reason, source_table, source_id,
      idempotency_key, balance_before, balance_after, bucket
    ) VALUES (
      p_tenant_id, 'debit', v_debit_monthly, p_reason, p_related_entity_type, p_related_entity_id,
      CASE WHEN v_debit_rollover > 0 THEN p_idempotency_key || '_monthly' ELSE p_idempotency_key END,
      v_total, v_new_total, 'monthly'
    );
  END IF;

  RETURN QUERY SELECT true, false, v_debit_rollover, v_debit_monthly, v_new_rollover, v_new_monthly, v_new_total, NULL::text;
END;
$$;


--
-- Name: get_plan_monthly_credits(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_plan_monthly_credits(plan_name text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  CASE plan_name
    WHEN 'trial' THEN RETURN 100;
    WHEN 'starter' THEN RETURN 1000;
    WHEN 'growth' THEN RETURN 3000;
    WHEN 'pro' THEN RETURN 6000;
    WHEN 'scale' THEN RETURN 12000;
    WHEN 'enterprise' THEN RETURN 25000;
    ELSE RETURN 0;
  END CASE;
END;
$$;


--
-- Name: get_user_tenant_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tenant_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id;
$$;


--
-- Name: grant_initial_credits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_initial_credits() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_plan_credits integer;
BEGIN
  -- When transitioning from ONBOARDING_PAID to ACTIVE_WITH_CREDITS
  IF NEW.billing_state = 'ACTIVE_WITH_CREDITS' 
     AND OLD.billing_state = 'ONBOARDING_PAID'
     AND NEW.initial_credits_granted = false THEN
    
    -- Get credits based on plan
    v_plan_credits := get_plan_monthly_credits(NEW.plan);
    
    -- Set monthly credits (first month)
    NEW.monthly_credits_remaining := v_plan_credits;
    NEW.accumulated_credits := 0;
    NEW.message_credits := v_plan_credits;
    NEW.initial_credits_granted := true;
    NEW.last_refill_at := now();
    NEW.next_refill_at := now() + interval '1 month';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _tenant_id UUID;
  _global_role public.global_role;
  _tenant_role public.tenant_role;
BEGIN
  -- Obtener metadata del usuario
  _tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::UUID;
  _global_role := COALESCE((NEW.raw_user_meta_data ->> 'global_role')::public.global_role, 'user');
  _tenant_role := (NEW.raw_user_meta_data ->> 'tenant_role')::public.tenant_role;
  
  -- Si es super_admin, no tiene tenant ni tenant_role
  IF _global_role = 'super_admin' THEN
    _tenant_id := NULL;
    _tenant_role := NULL;
  END IF;
  
  -- Crear perfil
  INSERT INTO public.profiles (id, tenant_id, name, email)
  VALUES (
    NEW.id,
    _tenant_id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  
  -- Crear rol
  INSERT INTO public.user_roles (user_id, global_role, tenant_role)
  VALUES (NEW.id, _global_role, _tenant_role);
  
  RETURN NEW;
END;
$$;


--
-- Name: has_any_tenant_role(uuid, public.tenant_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_any_tenant_role(_user_id uuid, _roles public.tenant_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_role = ANY(_roles)
  );
$$;


--
-- Name: has_tenant_role(uuid, public.tenant_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_tenant_role(_user_id uuid, _role public.tenant_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_role = _role
  );
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND global_role = 'super_admin'
  );
$$;


--
-- Name: prevent_role_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_role_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_is_super_admin boolean;
  v_actor_is_owner boolean;
  v_target_tenant_id uuid;
BEGIN
  v_actor_is_super_admin := is_super_admin(auth.uid());
  v_actor_is_owner := has_tenant_role(auth.uid(), 'owner');
  
  -- Get target user's tenant
  SELECT tenant_id INTO v_target_tenant_id 
  FROM public.profiles 
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Super admin can do anything
  IF v_actor_is_super_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- For INSERT/UPDATE
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- No one except super_admin can grant super_admin role
    IF NEW.global_role = 'super_admin' THEN
      INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
      VALUES (v_target_tenant_id, auth.uid(), 'blocked_privilege_escalation', 
        jsonb_build_object('attempted_role', 'super_admin', 'target_user', NEW.user_id));
      RAISE EXCEPTION 'Cannot grant super_admin role';
    END IF;
    
    -- Owners can only manage roles in their own tenant
    IF v_actor_is_owner THEN
      IF v_target_tenant_id != get_user_tenant_id(auth.uid()) THEN
        INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
        VALUES (v_target_tenant_id, auth.uid(), 'blocked_cross_tenant_role_change',
          jsonb_build_object('target_tenant', v_target_tenant_id, 'target_user', NEW.user_id));
        RAISE EXCEPTION 'Cannot modify roles in another tenant';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: prevent_tenant_id_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_tenant_id_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    -- Log the blocked attempt
    INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
    VALUES (
      OLD.tenant_id,
      auth.uid(),
      'blocked_tenant_id_change',
      jsonb_build_object(
        'target_table', TG_TABLE_NAME,
        'old_tenant_id', OLD.tenant_id,
        'attempted_tenant_id', NEW.tenant_id
      )
    );
    
    IF NOT is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Changing tenant_id is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_tenant_sensitive_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_tenant_sensitive_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
  v_db_role text := current_user;
BEGIN
  -- Bypass protection for backend/service operations
  -- Depending on context, PostgREST may set either JWT role or DB role
  IF v_jwt_role = 'service_role' OR v_db_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Allow super admins to modify billing fields
  IF is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block regular users from modifying sensitive billing fields
  IF NEW.plan IS DISTINCT FROM OLD.plan OR
     NEW.billing_state IS DISTINCT FROM OLD.billing_state OR
     NEW.message_credits IS DISTINCT FROM OLD.message_credits OR
     NEW.initial_credits_granted IS DISTINCT FROM OLD.initial_credits_granted OR
     NEW.monthly_credits_remaining IS DISTINCT FROM OLD.monthly_credits_remaining OR
     NEW.accumulated_credits IS DISTINCT FROM OLD.accumulated_credits OR
     NEW.extra_credits IS DISTINCT FROM OLD.extra_credits THEN

    INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
    VALUES (
      OLD.id,
      auth.uid(),
      'blocked_billing_field_change',
      jsonb_build_object(
        'db_role', v_db_role,
        'jwt_role', v_jwt_role,
        'attempted_changes', jsonb_build_object(
          'plan', CASE WHEN NEW.plan IS DISTINCT FROM OLD.plan THEN jsonb_build_object('old', OLD.plan, 'new', NEW.plan) END,
          'billing_state', CASE WHEN NEW.billing_state IS DISTINCT FROM OLD.billing_state THEN jsonb_build_object('old', OLD.billing_state, 'new', NEW.billing_state) END,
          'message_credits', CASE WHEN NEW.message_credits IS DISTINCT FROM OLD.message_credits THEN jsonb_build_object('old', OLD.message_credits, 'new', NEW.message_credits) END,
          'extra_credits', CASE WHEN NEW.extra_credits IS DISTINCT FROM OLD.extra_credits THEN jsonb_build_object('old', OLD.extra_credits, 'new', NEW.extra_credits) END
        )
      )
    );

    RAISE EXCEPTION 'Modifying billing fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: protect_wallet_balances(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_wallet_balances() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_super_admin(auth.uid()) THEN
    IF NEW.balance_messages IS DISTINCT FROM OLD.balance_messages OR
       NEW.balance_monthly IS DISTINCT FROM OLD.balance_monthly OR
       NEW.balance_rollover IS DISTINCT FROM OLD.balance_rollover THEN
      
      -- Log the blocked attempt
      INSERT INTO public.security_events (tenant_id, user_id, event_type, metadata)
      VALUES (
        OLD.tenant_id,
        auth.uid(),
        'blocked_wallet_balance_change',
        jsonb_build_object(
          'wallet_id', OLD.id,
          'attempted_balance_messages', NEW.balance_messages,
          'old_balance_messages', OLD.balance_messages
        )
      );
      
      RAISE EXCEPTION 'Changing wallet balance is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_tenant_limits_on_plan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_tenant_limits_on_plan() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Set max_users based on plan
  NEW.max_users := CASE 
    WHEN NEW.plan = 'trial' THEN 1
    WHEN NEW.plan = 'starter' THEN 2
    WHEN NEW.plan = 'growth' THEN 5
    WHEN NEW.plan = 'pro' THEN 10
    WHEN NEW.plan = 'scale' THEN 20
    WHEN NEW.plan = 'enterprise' THEN 30
    ELSE 1
  END;
  
  -- Set max_contacts based on plan
  NEW.max_contacts := CASE 
    WHEN NEW.plan = 'trial' THEN 100
    WHEN NEW.plan = 'starter' THEN 500
    WHEN NEW.plan = 'growth' THEN 2000
    WHEN NEW.plan = 'pro' THEN 10000
    WHEN NEW.plan = 'scale' THEN 25000
    WHEN NEW.plan = 'enterprise' THEN 50000
    ELSE 100
  END;
  
  -- Set status based on plan for new tenants
  IF TG_OP = 'INSERT' THEN
    IF NEW.plan = 'trial' THEN
      NEW.status := 'trial';
    ELSE
      NEW.status := 'active';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: sync_wallet_from_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_wallet_from_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total integer;
BEGIN
  -- Calcular total desde las nuevas columnas
  v_total := COALESCE(NEW.monthly_credits_remaining, 0) + COALESCE(NEW.accumulated_credits, 0);
  
  -- Sincronizar wallets.balance_messages cuando cambia tenants
  UPDATE public.wallets
  SET balance_messages = v_total,
      status = CASE 
        WHEN v_total <= 0 THEN 'blocked'::wallet_status
        WHEN v_total <= low_threshold THEN 'low'::wallet_status
        ELSE 'active'::wallet_status
      END,
      updated_at = now()
  WHERE tenant_id = NEW.id;
  
  RETURN NEW;
END;
$$;


--
-- Name: sync_wallets_from_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_wallets_from_tenant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Sync wallets when tenants credits change
  UPDATE public.wallets
  SET 
    balance_monthly = COALESCE(NEW.monthly_credits_remaining, 0),
    balance_rollover = COALESCE(NEW.accumulated_credits, 0),
    balance_messages = COALESCE(NEW.monthly_credits_remaining, 0) + COALESCE(NEW.accumulated_credits, 0) + COALESCE(NEW.extra_credits, 0),
    status = CASE 
      WHEN (COALESCE(NEW.monthly_credits_remaining, 0) + COALESCE(NEW.accumulated_credits, 0) + COALESCE(NEW.extra_credits, 0)) <= 0 THEN 'blocked'::wallet_status
      WHEN (COALESCE(NEW.monthly_credits_remaining, 0) + COALESCE(NEW.accumulated_credits, 0) + COALESCE(NEW.extra_credits, 0)) <= low_threshold THEN 'low'::wallet_status
      ELSE 'active'::wallet_status
    END,
    updated_at = now()
  WHERE tenant_id = NEW.id;
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_automation_worker(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_automation_worker() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _supabase_url TEXT;
  _anon_key TEXT;
BEGIN
  -- Only trigger for pending events
  IF NEW.status = 'pending' THEN
    -- Get URL and key from config table
    SELECT value INTO _supabase_url 
    FROM public.system_config 
    WHERE key = 'supabase_url' 
    LIMIT 1;
    
    SELECT value INTO _anon_key 
    FROM public.system_config 
    WHERE key = 'supabase_anon_key' 
    LIMIT 1;
    
    -- Call edge function asynchronously via pg_net
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/automation-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', _anon_key,
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('event_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_wallet_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_wallet_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.balance_messages <= 0 THEN
    NEW.status := 'blocked';
  ELSIF NEW.balance_messages <= NEW.low_threshold THEN
    NEW.status := 'low';
  ELSE
    NEW.status := 'active';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: update_warmup_level(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_warmup_level() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Reset daily counter if it's a new day
  IF NEW.daily_messages_date < CURRENT_DATE THEN
    NEW.daily_messages_sent := 0;
    NEW.daily_messages_date := CURRENT_DATE;
    
    -- Increase warmup level based on total messages sent
    IF NEW.total_messages_sent >= 2000 THEN
      NEW.warmup_level := 4;
      NEW.max_messages_per_day := 10000;
    ELSIF NEW.total_messages_sent >= 800 THEN
      NEW.warmup_level := 3;
      NEW.max_messages_per_day := 1000;
    ELSIF NEW.total_messages_sent >= 400 THEN
      NEW.warmup_level := 2;
      NEW.max_messages_per_day := 500;
    ELSE
      NEW.warmup_level := 1;
      NEW.max_messages_per_day := 200;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: ai_interaction_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_interaction_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    message_id uuid,
    inbound_message text NOT NULL,
    ai_response text,
    knowledge_base_entry_id uuid,
    was_escalated boolean DEFAULT false NOT NULL,
    escalation_reason text,
    response_time_ms integer,
    wallet_debited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_base (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    category public.kb_category DEFAULT 'general_info'::public.kb_category NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    token_hash text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    event_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_idempotency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    automation_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_run_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_run_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    step_index integer NOT NULL,
    action_type public.automation_action_type NOT NULL,
    action_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public.automation_step_status DEFAULT 'queued'::public.automation_step_status NOT NULL,
    result jsonb,
    error_message text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    automation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    conversation_id uuid,
    trigger_event_id text,
    status public.automation_run_status DEFAULT 'queued'::public.automation_run_status NOT NULL,
    wallet_consumed integer DEFAULT 0 NOT NULL,
    error_code text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resume_at timestamp with time zone
);


--
-- Name: automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    status public.automation_status DEFAULT 'draft'::public.automation_status NOT NULL,
    trigger_type public.automation_trigger_type NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    rate_limits jsonb DEFAULT '{"per_hour": 200, "per_minute": 10, "per_contact_day": 3}'::jsonb NOT NULL,
    schedule jsonb,
    cooldown_hours integer DEFAULT 24,
    allowed_hours jsonb DEFAULT '{"end": "18:00", "days": [1, 2, 3, 4, 5], "start": "09:00", "timezone": "America/Mexico_City"}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    twilio_message_sid text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    error_code text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    conversation_id uuid,
    message_id uuid,
    status text DEFAULT 'queued'::text NOT NULL,
    skipped_reason text,
    provider_message_sid text,
    error_code text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    phone text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 2 NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    error_code text,
    error_message text,
    twilio_message_sid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    messages_sent integer DEFAULT 0 NOT NULL,
    messages_delivered integer DEFAULT 0 NOT NULL,
    messages_read integer DEFAULT 0 NOT NULL,
    messages_failed integer DEFAULT 0 NOT NULL,
    responses integer DEFAULT 0 NOT NULL,
    opt_outs integer DEFAULT 0 NOT NULL,
    cost_estimated numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    campaign_type text DEFAULT 'marketing'::text NOT NULL,
    template_id uuid,
    segment_id uuid,
    audience_type text DEFAULT 'all'::text NOT NULL,
    audience_filters jsonb DEFAULT '{}'::jsonb,
    variable_mapping jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    paused_at timestamp with time zone,
    pause_reason text,
    total_contacts integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    delivered_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    batch_size integer DEFAULT 20,
    batch_delay_seconds integer DEFAULT 45,
    current_batch integer DEFAULT 0,
    last_batch_at timestamp with time zone,
    queue_total integer DEFAULT 0,
    queue_processed integer DEFAULT 0
);


--
-- Name: contact_consent_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_consent_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    channel public.consent_channel DEFAULT 'whatsapp'::public.consent_channel NOT NULL,
    prev_status public.consent_status,
    new_status public.consent_status NOT NULL,
    prev_dnd_until timestamp with time zone,
    new_dnd_until timestamp with time zone,
    reason text,
    source text DEFAULT 'ui'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_type text DEFAULT 'system'::text NOT NULL,
    actor_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    channel public.consent_channel DEFAULT 'whatsapp'::public.consent_channel NOT NULL,
    status public.consent_status DEFAULT 'allowed'::public.consent_status NOT NULL,
    dnd_until timestamp with time zone,
    reason text,
    source text DEFAULT 'ui'::text NOT NULL,
    note text,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_custom_field_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_custom_field_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    field_id uuid NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_custom_field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_custom_field_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    field_id uuid NOT NULL,
    value_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    data_type public.custom_field_type DEFAULT 'short_text'::public.custom_field_type NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    is_visible_in_list boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category text
);


--
-- Name: contact_opt_out; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_opt_out (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    channel text DEFAULT 'whatsapp'::text NOT NULL,
    opted_out boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    country text,
    tags text[] DEFAULT '{}'::text[],
    notes text,
    status public.contact_status DEFAULT 'active'::public.contact_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    actor_user_id uuid,
    actor_type text DEFAULT 'system'::text NOT NULL,
    event_type text NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_activity_actor_type_check CHECK ((actor_type = ANY (ARRAY['system'::text, 'user'::text, 'ai'::text])))
);


--
-- Name: conversation_followups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    assigned_user_id uuid,
    status text DEFAULT 'scheduled'::text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    canceled_at timestamp with time zone,
    CONSTRAINT conversation_followups_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'canceled'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    twilio_subaccount_sid text,
    twilio_whatsapp_number text,
    customer_whatsapp text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    last_customer_message_at timestamp with time zone,
    last_agent_message_at timestamp with time zone,
    last_message_preview text,
    unread_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_direction text,
    last_message_source text,
    ai_enabled boolean DEFAULT true NOT NULL,
    ai_state text DEFAULT 'active'::text,
    needs_human boolean DEFAULT false,
    ai_pause_reason text,
    ai_paused_at timestamp with time zone,
    ai_paused_by uuid
);


--
-- Name: event_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    diff jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    event_type text DEFAULT 'appointment'::text NOT NULL,
    title text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    timezone text DEFAULT 'America/Mexico_City'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT events_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'api'::text, 'import'::text, 'ai'::text]))),
    CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'canceled'::text, 'completed'::text, 'no_show'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    direction text NOT NULL,
    channel text DEFAULT 'whatsapp'::text NOT NULL,
    provider text DEFAULT 'twilio'::text NOT NULL,
    twilio_message_sid text,
    from_number text NOT NULL,
    to_number text NOT NULL,
    body text,
    media_urls text[] DEFAULT '{}'::text[],
    status text DEFAULT 'received'::text NOT NULL,
    error_code text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    campaign_id uuid,
    template_id uuid,
    contact_id uuid,
    ai_generated boolean DEFAULT false NOT NULL,
    media_type text,
    media_mime_type text,
    media_filename text,
    media_size_bytes integer,
    media_duration_sec integer,
    location_lat numeric(10,8),
    location_lng numeric(11,8)
);


--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_resets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    user_id uuid,
    email text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    request_count integer DEFAULT 1 NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    tenant_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_login_required boolean DEFAULT true NOT NULL,
    password_set_at timestamp with time zone,
    invited_at timestamp with time zone,
    invited_by uuid
);


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    user_id uuid,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: segment_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segment_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    segment_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    type public.segment_type DEFAULT 'dynamic'::public.segment_type NOT NULL,
    rules_json jsonb,
    status public.segment_status DEFAULT 'active'::public.segment_status NOT NULL,
    last_calculated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fingerprint text,
    reuse_count integer DEFAULT 0 NOT NULL
);


--
-- Name: support_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    message_id uuid,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path text
);


--
-- Name: support_internal_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_internal_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_by uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_type public.ticket_sender_type NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    has_attachments boolean DEFAULT false NOT NULL
);


--
-- Name: support_ticket_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    created_by uuid NOT NULL,
    subject text NOT NULL,
    category public.ticket_category DEFAULT 'other'::public.ticket_category NOT NULL,
    priority public.ticket_priority DEFAULT 'medium'::public.ticket_priority NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    type text NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    entity_type text,
    entity_id uuid,
    severity integer DEFAULT 1 NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_alerts_entity_type_check CHECK ((entity_type = ANY (ARRAY['campaign'::text, 'account'::text, 'template'::text, 'credits'::text, 'inbox'::text]))),
    CONSTRAINT system_alerts_type_check CHECK ((type = ANY (ARRAY['warning'::text, 'error'::text, 'success'::text, 'info'::text])))
);


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_event_bus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_event_bus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_name text NOT NULL,
    entity_type text DEFAULT 'event'::text NOT NULL,
    entity_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    CONSTRAINT system_event_bus_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'utility'::text NOT NULL,
    label text,
    header_type text DEFAULT 'none'::text,
    header_text text,
    body text NOT NULL,
    footer text,
    buttons jsonb DEFAULT '[]'::jsonb,
    variables text[] DEFAULT '{}'::text[],
    twilio_template_sid text,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    rejection_reason text,
    last_synced_at timestamp with time zone,
    used_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    media_url text,
    media_filename text,
    media_mime_type text,
    media_size_bytes integer,
    created_source text DEFAULT 'manual'::text NOT NULL,
    created_by_module text,
    created_by_user_id uuid,
    ai_conversation_id uuid,
    display_name text,
    fingerprint text,
    last_upsert_idempotency_key text,
    last_submit_idempotency_key text,
    CONSTRAINT templates_created_source_check CHECK ((created_source = ANY (ARRAY['manual'::text, 'ai'::text])))
);


--
-- Name: tenant_ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_ai_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    agent_name text DEFAULT 'Asistente'::text NOT NULL,
    company_name text,
    timezone text DEFAULT 'America/Mexico_City'::text NOT NULL,
    response_delay_seconds integer DEFAULT 2 NOT NULL,
    tone public.ai_tone DEFAULT 'professional'::public.ai_tone NOT NULL,
    use_emojis boolean DEFAULT true NOT NULL,
    max_emojis_per_message integer DEFAULT 2 NOT NULL,
    never_reveal_ai boolean DEFAULT true NOT NULL,
    use_customer_name boolean DEFAULT true NOT NULL,
    escalate_on_frustration boolean DEFAULT true NOT NULL,
    escalate_on_no_answer boolean DEFAULT true NOT NULL,
    escalate_on_human_request boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    behavior_prompt text,
    fallback_message text DEFAULT 'Enseguida te atiende un asesor.'::text,
    CONSTRAINT tenant_ai_settings_response_delay_seconds_check CHECK (((response_delay_seconds >= 1) AND (response_delay_seconds <= 10)))
);


--
-- Name: tenant_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider text DEFAULT 'ycloud'::text NOT NULL,
    api_key text,
    waba_id text,
    phone_number_id text,
    phone_number text,
    phone_number_name text,
    webhook_url text,
    webhook_secret text,
    balance numeric(12,2),
    currency text DEFAULT 'USD'::text,
    status public.integration_status DEFAULT 'pending_setup'::public.integration_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_sid text,
    auth_token_encrypted text,
    messaging_service_sid text,
    daily_messages_sent integer DEFAULT 0,
    daily_messages_date date DEFAULT CURRENT_DATE,
    total_messages_sent integer DEFAULT 0,
    warmup_level integer DEFAULT 1,
    max_messages_per_day integer DEFAULT 200
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    plan public.tenant_plan DEFAULT 'trial'::public.tenant_plan NOT NULL,
    status public.tenant_status DEFAULT 'active'::public.tenant_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_users integer DEFAULT 1 NOT NULL,
    max_contacts integer DEFAULT 1000 NOT NULL,
    billing_state public.tenant_billing_state DEFAULT 'ONBOARDING_PAID'::public.tenant_billing_state NOT NULL,
    message_credits integer DEFAULT 0 NOT NULL,
    initial_credits_granted boolean DEFAULT false NOT NULL,
    monthly_credits_remaining integer DEFAULT 0 NOT NULL,
    accumulated_credits integer DEFAULT 0 NOT NULL,
    last_refill_at timestamp with time zone,
    next_refill_at timestamp with time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    subscription_status text,
    current_period_end timestamp with time zone,
    last_invoice_id text,
    last_payment_at timestamp with time zone,
    extra_credits integer DEFAULT 0 NOT NULL,
    pending_plan text,
    pending_stripe_price_id text,
    pending_plan_effective_at timestamp with time zone,
    last_upgrade_grant_key text,
    cancellation_reason text,
    cancellation_comment text,
    cancellation_requested_at timestamp with time zone,
    canceled_at timestamp with time zone
);

ALTER TABLE ONLY public.tenants REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    global_role public.global_role DEFAULT 'user'::public.global_role NOT NULL,
    tenant_role public.tenant_role,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_idempotency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    movement_type text NOT NULL,
    amount integer NOT NULL,
    reason text NOT NULL,
    source_table text,
    source_id uuid,
    idempotency_key text,
    balance_before integer NOT NULL,
    balance_after integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bucket text,
    CONSTRAINT wallet_ledger_amount_check CHECK ((amount > 0)),
    CONSTRAINT wallet_ledger_movement_type_check CHECK ((movement_type = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    wallet_id uuid NOT NULL,
    type public.wallet_transaction_type NOT NULL,
    messages integer NOT NULL,
    reason public.wallet_transaction_reason NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    balance_messages integer DEFAULT 0 NOT NULL,
    status public.wallet_status DEFAULT 'blocked'::public.wallet_status NOT NULL,
    low_threshold integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    balance_monthly integer DEFAULT 0 NOT NULL,
    balance_rollover integer DEFAULT 0 NOT NULL
);


--
-- Name: ai_interaction_logs ai_interaction_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interaction_logs
    ADD CONSTRAINT ai_interaction_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_base ai_knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_base
    ADD CONSTRAINT ai_knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: api_tokens api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);


--
-- Name: automation_events automation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_events
    ADD CONSTRAINT automation_events_pkey PRIMARY KEY (id);


--
-- Name: automation_idempotency automation_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_idempotency
    ADD CONSTRAINT automation_idempotency_pkey PRIMARY KEY (id);


--
-- Name: automation_idempotency automation_idempotency_tenant_id_idempotency_key_automation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_idempotency
    ADD CONSTRAINT automation_idempotency_tenant_id_idempotency_key_automation_key UNIQUE (tenant_id, idempotency_key, automation_id);


--
-- Name: automation_run_steps automation_run_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_run_steps
    ADD CONSTRAINT automation_run_steps_pkey PRIMARY KEY (id);


--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: campaign_contacts campaign_contacts_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_contacts
    ADD CONSTRAINT campaign_contacts_campaign_id_contact_id_key UNIQUE (campaign_id, contact_id);


--
-- Name: campaign_contacts campaign_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_contacts
    ADD CONSTRAINT campaign_contacts_pkey PRIMARY KEY (id);


--
-- Name: campaign_deliveries campaign_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_pkey PRIMARY KEY (id);


--
-- Name: campaign_deliveries campaign_deliveries_tenant_id_campaign_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_tenant_id_campaign_id_contact_id_key UNIQUE (tenant_id, campaign_id, contact_id);


--
-- Name: campaign_queue campaign_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_queue
    ADD CONSTRAINT campaign_queue_pkey PRIMARY KEY (id);


--
-- Name: campaign_stats campaign_stats_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_stats
    ADD CONSTRAINT campaign_stats_campaign_id_key UNIQUE (campaign_id);


--
-- Name: campaign_stats campaign_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_stats
    ADD CONSTRAINT campaign_stats_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: contact_consent_events contact_consent_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consent_events
    ADD CONSTRAINT contact_consent_events_pkey PRIMARY KEY (id);


--
-- Name: contact_consents contact_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consents
    ADD CONSTRAINT contact_consents_pkey PRIMARY KEY (id);


--
-- Name: contact_custom_field_options contact_custom_field_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_field_options
    ADD CONSTRAINT contact_custom_field_options_pkey PRIMARY KEY (id);


--
-- Name: contact_custom_field_values contact_custom_field_values_contact_id_field_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_field_values
    ADD CONSTRAINT contact_custom_field_values_contact_id_field_id_key UNIQUE (contact_id, field_id);


--
-- Name: contact_custom_field_values contact_custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_field_values
    ADD CONSTRAINT contact_custom_field_values_pkey PRIMARY KEY (id);


--
-- Name: contact_custom_fields contact_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_fields
    ADD CONSTRAINT contact_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: contact_custom_fields contact_custom_fields_tenant_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_fields
    ADD CONSTRAINT contact_custom_fields_tenant_id_key_key UNIQUE (tenant_id, key);


--
-- Name: contact_opt_out contact_opt_out_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_opt_out
    ADD CONSTRAINT contact_opt_out_pkey PRIMARY KEY (id);


--
-- Name: contact_opt_out contact_opt_out_tenant_id_contact_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_opt_out
    ADD CONSTRAINT contact_opt_out_tenant_id_contact_id_channel_key UNIQUE (tenant_id, contact_id, channel);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: conversation_activity conversation_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_activity
    ADD CONSTRAINT conversation_activity_pkey PRIMARY KEY (id);


--
-- Name: conversation_followups conversation_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_followups
    ADD CONSTRAINT conversation_followups_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: event_audit_logs event_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_audit_logs
    ADD CONSTRAINT event_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: messages messages_twilio_message_sid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_twilio_message_sid_key UNIQUE (twilio_message_sid);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: segment_contacts segment_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segment_contacts
    ADD CONSTRAINT segment_contacts_pkey PRIMARY KEY (id);


--
-- Name: segment_contacts segment_contacts_segment_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segment_contacts
    ADD CONSTRAINT segment_contacts_segment_id_contact_id_key UNIQUE (segment_id, contact_id);


--
-- Name: segments segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_pkey PRIMARY KEY (id);


--
-- Name: support_attachments support_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT support_attachments_pkey PRIMARY KEY (id);


--
-- Name: support_internal_notes support_internal_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_internal_notes
    ADD CONSTRAINT support_internal_notes_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_reads support_ticket_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_reads
    ADD CONSTRAINT support_ticket_reads_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_reads support_ticket_reads_ticket_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_reads
    ADD CONSTRAINT support_ticket_reads_ticket_id_user_id_key UNIQUE (ticket_id, user_id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_alerts system_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: system_event_bus system_event_bus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_event_bus
    ADD CONSTRAINT system_event_bus_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: tenant_ai_settings tenant_ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_ai_settings
    ADD CONSTRAINT tenant_ai_settings_pkey PRIMARY KEY (id);


--
-- Name: tenant_ai_settings tenant_ai_settings_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_ai_settings
    ADD CONSTRAINT tenant_ai_settings_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenant_integrations tenant_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_pkey PRIMARY KEY (id);


--
-- Name: tenant_integrations tenant_integrations_tenant_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_tenant_id_provider_key UNIQUE (tenant_id, provider);


--
-- Name: tenant_integrations tenant_integrations_tenant_provider_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_tenant_provider_unique UNIQUE (tenant_id, provider);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: wallet_idempotency wallet_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_idempotency
    ADD CONSTRAINT wallet_idempotency_pkey PRIMARY KEY (id);


--
-- Name: wallet_idempotency wallet_idempotency_tenant_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_idempotency
    ADD CONSTRAINT wallet_idempotency_tenant_id_idempotency_key_key UNIQUE (tenant_id, idempotency_key);


--
-- Name: wallet_ledger wallet_ledger_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: wallet_ledger wallet_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_tenant_id_key UNIQUE (tenant_id);


--
-- Name: api_tokens_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_tokens_tenant_id_idx ON public.api_tokens USING btree (tenant_id);


--
-- Name: api_tokens_tenant_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_tokens_tenant_name_uq ON public.api_tokens USING btree (tenant_id, name);


--
-- Name: api_tokens_token_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_tokens_token_hash_idx ON public.api_tokens USING btree (token_hash);


--
-- Name: contact_consent_events_by_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_consent_events_by_contact ON public.contact_consent_events USING btree (tenant_id, contact_id, created_at DESC);


--
-- Name: contact_consents_by_channel_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_consents_by_channel_status ON public.contact_consents USING btree (tenant_id, channel, status);


--
-- Name: contact_consents_by_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_consents_by_status ON public.contact_consents USING btree (tenant_id, status);


--
-- Name: contact_consents_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contact_consents_unique ON public.contact_consents USING btree (tenant_id, contact_id, channel);


--
-- Name: idx_activity_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_contact ON public.conversation_activity USING btree (tenant_id, contact_id, created_at DESC);


--
-- Name: idx_activity_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_conversation ON public.conversation_activity USING btree (tenant_id, conversation_id, created_at DESC);


--
-- Name: idx_ai_interaction_logs_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_interaction_logs_conversation ON public.ai_interaction_logs USING btree (conversation_id);


--
-- Name: idx_ai_interaction_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_interaction_logs_created ON public.ai_interaction_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_ai_interaction_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_interaction_logs_tenant ON public.ai_interaction_logs USING btree (tenant_id);


--
-- Name: idx_ai_knowledge_base_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_base_active ON public.ai_knowledge_base USING btree (tenant_id, is_active);


--
-- Name: idx_ai_knowledge_base_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_base_category ON public.ai_knowledge_base USING btree (tenant_id, category);


--
-- Name: idx_ai_knowledge_base_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_knowledge_base_tenant ON public.ai_knowledge_base USING btree (tenant_id);


--
-- Name: idx_ai_logs_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_logs_tenant_created ON public.ai_interaction_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_ai_logs_tenant_escalated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_logs_tenant_escalated ON public.ai_interaction_logs USING btree (tenant_id, was_escalated, created_at DESC) WHERE (was_escalated = true);


--
-- Name: idx_automation_events_tenant_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_events_tenant_processed ON public.automation_events USING btree (tenant_id, processed_at);


--
-- Name: idx_automation_idempotency_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_idempotency_lookup ON public.automation_idempotency USING btree (tenant_id, idempotency_key, automation_id);


--
-- Name: idx_automation_run_steps_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_run_steps_run ON public.automation_run_steps USING btree (run_id);


--
-- Name: idx_automation_runs_automation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_automation ON public.automation_runs USING btree (automation_id);


--
-- Name: idx_automation_runs_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_contact ON public.automation_runs USING btree (contact_id);


--
-- Name: idx_automation_runs_resume_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_resume_at ON public.automation_runs USING btree (resume_at) WHERE ((status = 'paused'::public.automation_run_status) AND (resume_at IS NOT NULL));


--
-- Name: idx_automation_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_status ON public.automation_runs USING btree (status);


--
-- Name: idx_automation_runs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_tenant ON public.automation_runs USING btree (tenant_id);


--
-- Name: idx_automation_runs_tenant_automation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_tenant_automation ON public.automation_runs USING btree (tenant_id, automation_id, created_at DESC);


--
-- Name: idx_automation_runs_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_runs_tenant_status ON public.automation_runs USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_automations_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automations_tenant_status ON public.automations USING btree (tenant_id, status);


--
-- Name: idx_campaign_contacts_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_contacts_campaign_id ON public.campaign_contacts USING btree (campaign_id);


--
-- Name: idx_campaign_contacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_contacts_status ON public.campaign_contacts USING btree (status);


--
-- Name: idx_campaign_deliveries_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_deliveries_contact ON public.campaign_deliveries USING btree (contact_id);


--
-- Name: idx_campaign_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_deliveries_status ON public.campaign_deliveries USING btree (status);


--
-- Name: idx_campaign_deliveries_tenant_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_deliveries_tenant_campaign ON public.campaign_deliveries USING btree (tenant_id, campaign_id);


--
-- Name: idx_campaign_deliveries_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_deliveries_tenant_status ON public.campaign_deliveries USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_campaign_queue_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_queue_campaign ON public.campaign_queue USING btree (campaign_id);


--
-- Name: idx_campaign_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_queue_pending ON public.campaign_queue USING btree (tenant_id, campaign_id, status, scheduled_at) WHERE (status = 'pending'::text);


--
-- Name: idx_campaign_stats_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_stats_campaign ON public.campaign_stats USING btree (campaign_id);


--
-- Name: idx_campaign_stats_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_stats_tenant ON public.campaign_stats USING btree (tenant_id);


--
-- Name: idx_campaigns_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_scheduled_at ON public.campaigns USING btree (scheduled_at);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_campaigns_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_tenant_id ON public.campaigns USING btree (tenant_id);


--
-- Name: idx_campaigns_tenant_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_tenant_scheduled ON public.campaigns USING btree (tenant_id, scheduled_at DESC) WHERE (scheduled_at IS NOT NULL);


--
-- Name: idx_campaigns_tenant_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_tenant_status_created ON public.campaigns USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_contact_custom_field_options_field_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_custom_field_options_field_id ON public.contact_custom_field_options USING btree (field_id);


--
-- Name: idx_contact_custom_field_values_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_custom_field_values_contact_id ON public.contact_custom_field_values USING btree (contact_id);


--
-- Name: idx_contact_custom_fields_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_custom_fields_tenant_id ON public.contact_custom_fields USING btree (tenant_id);


--
-- Name: idx_contacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_status ON public.contacts USING btree (status);


--
-- Name: idx_contacts_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tenant_created ON public.contacts USING btree (tenant_id, created_at DESC);


--
-- Name: idx_contacts_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tenant_id ON public.contacts USING btree (tenant_id);


--
-- Name: idx_contacts_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tenant_name ON public.contacts USING btree (tenant_id, name);


--
-- Name: idx_contacts_tenant_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tenant_phone ON public.contacts USING btree (tenant_id, phone);


--
-- Name: idx_contacts_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tenant_status ON public.contacts USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_conversation_activity_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_activity_contact ON public.conversation_activity USING btree (tenant_id, contact_id, created_at DESC);


--
-- Name: idx_conversations_needs_human; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_needs_human ON public.conversations USING btree (tenant_id, needs_human, updated_at DESC) WHERE (needs_human = true);


--
-- Name: idx_conversations_tenant_ai_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_ai_enabled ON public.conversations USING btree (tenant_id, ai_enabled, updated_at DESC);


--
-- Name: idx_conversations_tenant_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_customer ON public.conversations USING btree (tenant_id, customer_whatsapp);


--
-- Name: idx_conversations_tenant_last_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_last_customer ON public.conversations USING btree (tenant_id, last_customer_message_at DESC);


--
-- Name: idx_conversations_tenant_needs_human; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_needs_human ON public.conversations USING btree (tenant_id, needs_human, updated_at DESC) WHERE (needs_human = true);


--
-- Name: idx_conversations_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_status ON public.conversations USING btree (tenant_id, status, updated_at DESC);


--
-- Name: idx_conversations_tenant_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_unread ON public.conversations USING btree (tenant_id, unread_count DESC) WHERE (unread_count > 0);


--
-- Name: idx_conversations_tenant_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_updated ON public.conversations USING btree (tenant_id, updated_at DESC);


--
-- Name: idx_event_audit_logs_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_audit_logs_event ON public.event_audit_logs USING btree (event_id);


--
-- Name: idx_event_audit_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_audit_logs_tenant ON public.event_audit_logs USING btree (tenant_id);


--
-- Name: idx_events_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_contact ON public.events USING btree (contact_id);


--
-- Name: idx_events_tenant_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_tenant_start ON public.events USING btree (tenant_id, start_at);


--
-- Name: idx_events_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_tenant_status ON public.events USING btree (tenant_id, status);


--
-- Name: idx_events_tenant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_tenant_type ON public.events USING btree (tenant_id, event_type);


--
-- Name: idx_followups_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_assigned ON public.conversation_followups USING btree (tenant_id, assigned_user_id, status, due_at);


--
-- Name: idx_followups_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_conversation ON public.conversation_followups USING btree (tenant_id, conversation_id, created_at DESC);


--
-- Name: idx_followups_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_due ON public.conversation_followups USING btree (tenant_id, status, due_at);


--
-- Name: idx_followups_tenant_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_tenant_status_due ON public.conversation_followups USING btree (tenant_id, status, due_at) WHERE (status = 'scheduled'::text);


--
-- Name: idx_messages_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_campaign ON public.messages USING btree (campaign_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (tenant_id, conversation_id, created_at);


--
-- Name: idx_messages_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_source ON public.messages USING btree (source);


--
-- Name: idx_messages_tenant_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_tenant_conversation ON public.messages USING btree (tenant_id, conversation_id, created_at DESC);


--
-- Name: idx_messages_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_tenant_created ON public.messages USING btree (tenant_id, created_at DESC);


--
-- Name: idx_messages_tenant_direction_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_tenant_direction_created ON public.messages USING btree (tenant_id, direction, created_at DESC);


--
-- Name: idx_messages_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_tenant_status ON public.messages USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_messages_twilio_sid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_twilio_sid ON public.messages USING btree (twilio_message_sid);


--
-- Name: idx_password_resets_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_resets_email ON public.password_resets USING btree (email);


--
-- Name: idx_password_resets_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_resets_expires_at ON public.password_resets USING btree (expires_at);


--
-- Name: idx_password_resets_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_resets_token_hash ON public.password_resets USING btree (token_hash);


--
-- Name: idx_password_resets_unused; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_resets_unused ON public.password_resets USING btree (email, used_at) WHERE (used_at IS NULL);


--
-- Name: idx_security_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created_at ON public.security_events USING btree (created_at DESC);


--
-- Name: idx_security_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_event_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_user_id ON public.security_events USING btree (user_id);


--
-- Name: idx_segment_contacts_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_segment_contacts_contact_id ON public.segment_contacts USING btree (contact_id);


--
-- Name: idx_segment_contacts_segment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_segment_contacts_segment_id ON public.segment_contacts USING btree (segment_id);


--
-- Name: idx_segments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_segments_status ON public.segments USING btree (status);


--
-- Name: idx_segments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_segments_tenant_id ON public.segments USING btree (tenant_id);


--
-- Name: idx_segments_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_segments_tenant_status ON public.segments USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_support_attachments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_attachments_ticket_id ON public.support_attachments USING btree (ticket_id);


--
-- Name: idx_support_internal_notes_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_internal_notes_ticket_id ON public.support_internal_notes USING btree (ticket_id);


--
-- Name: idx_support_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_created_at ON public.support_messages USING btree (created_at);


--
-- Name: idx_support_messages_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_ticket_id ON public.support_messages USING btree (ticket_id);


--
-- Name: idx_support_ticket_reads_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_reads_ticket_id ON public.support_ticket_reads USING btree (ticket_id);


--
-- Name: idx_support_ticket_reads_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_reads_user_id ON public.support_ticket_reads USING btree (user_id);


--
-- Name: idx_support_tickets_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets USING btree (assigned_to);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_by ON public.support_tickets USING btree (created_by);


--
-- Name: idx_support_tickets_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_priority ON public.support_tickets USING btree (priority);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_support_tickets_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_tenant_id ON public.support_tickets USING btree (tenant_id);


--
-- Name: idx_system_alerts_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alerts_resolved ON public.system_alerts USING btree (tenant_id, resolved) WHERE (resolved = false);


--
-- Name: idx_system_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alerts_severity ON public.system_alerts USING btree (tenant_id, severity DESC);


--
-- Name: idx_system_alerts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alerts_tenant ON public.system_alerts USING btree (tenant_id);


--
-- Name: idx_system_event_bus_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_event_bus_entity ON public.system_event_bus USING btree (entity_type, entity_id);


--
-- Name: idx_system_event_bus_event_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_event_bus_event_name ON public.system_event_bus USING btree (event_name);


--
-- Name: idx_system_event_bus_status_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_event_bus_status_pending ON public.system_event_bus USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_system_event_bus_tenant_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_event_bus_tenant_pending ON public.system_event_bus USING btree (tenant_id, status, created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_system_event_bus_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_event_bus_tenant_status ON public.system_event_bus USING btree (tenant_id, status, created_at);


--
-- Name: idx_templates_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_approval_status ON public.templates USING btree (approval_status);


--
-- Name: idx_templates_created_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_created_source ON public.templates USING btree (created_source);


--
-- Name: idx_templates_tenant_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_tenant_fingerprint ON public.templates USING btree (tenant_id, fingerprint) WHERE (fingerprint IS NOT NULL);


--
-- Name: idx_templates_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_tenant_id ON public.templates USING btree (tenant_id);


--
-- Name: idx_templates_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_tenant_status ON public.templates USING btree (tenant_id, approval_status, created_at DESC);


--
-- Name: idx_tenant_ai_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_ai_settings_tenant ON public.tenant_ai_settings USING btree (tenant_id);


--
-- Name: idx_tenants_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_stripe_customer_id ON public.tenants USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- Name: idx_tenants_stripe_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_stripe_subscription_id ON public.tenants USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);


--
-- Name: idx_wallet_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_idempotency_key ON public.wallet_idempotency USING btree (tenant_id, idempotency_key);


--
-- Name: idx_wallet_ledger_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_ledger_created_at ON public.wallet_ledger USING btree (created_at);


--
-- Name: idx_wallet_ledger_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_ledger_idempotency ON public.wallet_ledger USING btree (idempotency_key);


--
-- Name: idx_wallet_ledger_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_ledger_reason ON public.wallet_ledger USING btree (reason);


--
-- Name: idx_wallet_ledger_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_ledger_tenant ON public.wallet_ledger USING btree (tenant_id);


--
-- Name: idx_wallet_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_created_at ON public.wallet_transactions USING btree (created_at DESC);


--
-- Name: idx_wallet_transactions_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_tenant_created ON public.wallet_transactions USING btree (tenant_id, created_at DESC);


--
-- Name: idx_wallet_transactions_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_tenant_id ON public.wallet_transactions USING btree (tenant_id);


--
-- Name: idx_wallet_transactions_tenant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_tenant_type ON public.wallet_transactions USING btree (tenant_id, type, created_at DESC);


--
-- Name: idx_wallet_transactions_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_wallet_id ON public.wallet_transactions USING btree (wallet_id);


--
-- Name: idx_wallets_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallets_tenant_id ON public.wallets USING btree (tenant_id);


--
-- Name: segments_tenant_fingerprint_ux; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX segments_tenant_fingerprint_ux ON public.segments USING btree (tenant_id, fingerprint) WHERE (fingerprint IS NOT NULL);


--
-- Name: tenants audit_tenant_access; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_tenant_access AFTER INSERT OR DELETE OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.audit_cross_tenant_access();


--
-- Name: wallets audit_wallet_access; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_wallet_access AFTER INSERT OR DELETE OR UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.audit_cross_tenant_access();


--
-- Name: contacts automation_contacts_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER automation_contacts_trigger AFTER UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.emit_automation_event();


--
-- Name: contact_custom_field_values automation_custom_fields_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER automation_custom_fields_trigger AFTER INSERT OR UPDATE ON public.contact_custom_field_values FOR EACH ROW EXECUTE FUNCTION public.emit_automation_event();


--
-- Name: events automation_events_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER automation_events_trigger AFTER INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.emit_automation_event();


--
-- Name: contacts check_contact_limit_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_contact_limit_before_insert BEFORE INSERT ON public.contacts FOR EACH ROW WHEN ((new.status = 'active'::public.contact_status)) EXECUTE FUNCTION public.check_tenant_contact_limit();


--
-- Name: tenants create_wallet_for_new_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_wallet_for_new_tenant AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_tenant();


--
-- Name: system_event_bus on_automation_event_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_automation_event_insert AFTER INSERT ON public.system_event_bus FOR EACH ROW EXECUTE FUNCTION public.trigger_automation_worker();


--
-- Name: tenants on_billing_state_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_billing_state_change BEFORE UPDATE ON public.tenants FOR EACH ROW WHEN ((old.billing_state IS DISTINCT FROM new.billing_state)) EXECUTE FUNCTION public.grant_initial_credits();


--
-- Name: contacts prevent_contact_tenant_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_contact_tenant_change BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();


--
-- Name: conversations prevent_conversation_tenant_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_conversation_tenant_change BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();


--
-- Name: profiles prevent_profile_tenant_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_profile_tenant_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();


--
-- Name: user_roles prevent_role_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_role_escalation BEFORE INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();


--
-- Name: wallets prevent_wallet_tenant_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_wallet_tenant_change BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_id_change();


--
-- Name: tenants protect_tenant_billing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_tenant_billing BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_sensitive_fields();


--
-- Name: wallets protect_wallet_balance_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_wallet_balance_changes BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_balances();


--
-- Name: tenants sync_wallet_on_credits_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_wallet_on_credits_change AFTER UPDATE OF message_credits ON public.tenants FOR EACH ROW WHEN ((old.message_credits IS DISTINCT FROM new.message_credits)) EXECUTE FUNCTION public.sync_wallet_from_tenant();


--
-- Name: contact_consents trg_contact_consents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contact_consents_updated_at BEFORE UPDATE ON public.contact_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenants trg_sync_wallets_from_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_wallets_from_tenant AFTER UPDATE OF monthly_credits_remaining, accumulated_credits, message_credits ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.sync_wallets_from_tenant();


--
-- Name: profiles trigger_check_tenant_user_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_tenant_user_limit BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_tenant_user_limit();


--
-- Name: tenants trigger_set_tenant_limits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_tenant_limits BEFORE INSERT OR UPDATE OF plan ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_tenant_limits_on_plan();


--
-- Name: ai_knowledge_base update_ai_knowledge_base_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_knowledge_base_updated_at BEFORE UPDATE ON public.ai_knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: api_tokens update_api_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON public.api_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: automations update_automations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_deliveries update_campaign_deliveries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_deliveries_updated_at BEFORE UPDATE ON public.campaign_deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_queue update_campaign_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_queue_updated_at BEFORE UPDATE ON public.campaign_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_stats update_campaign_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_stats_updated_at BEFORE UPDATE ON public.campaign_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_custom_field_options update_contact_custom_field_options_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_custom_field_options_updated_at BEFORE UPDATE ON public.contact_custom_field_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_custom_field_values update_contact_custom_field_values_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_custom_field_values_updated_at BEFORE UPDATE ON public.contact_custom_field_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_custom_fields update_contact_custom_fields_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_custom_fields_updated_at BEFORE UPDATE ON public.contact_custom_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: segments update_segments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: support_tickets update_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: templates update_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_ai_settings update_tenant_ai_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_ai_settings_updated_at BEFORE UPDATE ON public.tenant_ai_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_integrations update_tenant_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_integrations_updated_at BEFORE UPDATE ON public.tenant_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_integrations update_tenant_warmup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_warmup BEFORE UPDATE ON public.tenant_integrations FOR EACH ROW EXECUTE FUNCTION public.update_warmup_level();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_roles update_user_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: wallets update_wallet_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wallet_status_trigger BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_wallet_status();


--
-- Name: ai_interaction_logs ai_interaction_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interaction_logs
    ADD CONSTRAINT ai_interaction_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: ai_interaction_logs ai_interaction_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interaction_logs
    ADD CONSTRAINT ai_interaction_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: ai_interaction_logs ai_interaction_logs_knowledge_base_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interaction_logs
    ADD CONSTRAINT ai_interaction_logs_knowledge_base_entry_id_fkey FOREIGN KEY (knowledge_base_entry_id) REFERENCES public.ai_knowledge_base(id) ON DELETE SET NULL;


--
-- Name: ai_interaction_logs ai_interaction_logs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interaction_logs
    ADD CONSTRAINT ai_interaction_logs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: ai_interaction_logs ai_interaction_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interaction_logs
    ADD CONSTRAINT ai_interaction_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_base ai_knowledge_base_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_base
    ADD CONSTRAINT ai_knowledge_base_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: api_tokens api_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: automation_events automation_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_events
    ADD CONSTRAINT automation_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: automation_idempotency automation_idempotency_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_idempotency
    ADD CONSTRAINT automation_idempotency_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_idempotency automation_idempotency_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_idempotency
    ADD CONSTRAINT automation_idempotency_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: automation_run_steps automation_run_steps_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_run_steps
    ADD CONSTRAINT automation_run_steps_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.automation_runs(id) ON DELETE CASCADE;


--
-- Name: automation_run_steps automation_run_steps_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_run_steps
    ADD CONSTRAINT automation_run_steps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: automation_runs automation_runs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: automations automations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: automations automations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaign_contacts campaign_contacts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_contacts
    ADD CONSTRAINT campaign_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_contacts campaign_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_contacts
    ADD CONSTRAINT campaign_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_contacts campaign_contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_contacts
    ADD CONSTRAINT campaign_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaign_deliveries campaign_deliveries_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_deliveries campaign_deliveries_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_deliveries campaign_deliveries_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: campaign_deliveries campaign_deliveries_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: campaign_deliveries campaign_deliveries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaign_queue campaign_queue_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_queue
    ADD CONSTRAINT campaign_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_queue campaign_queue_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_queue
    ADD CONSTRAINT campaign_queue_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_queue campaign_queue_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_queue
    ADD CONSTRAINT campaign_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaign_stats campaign_stats_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_stats
    ADD CONSTRAINT campaign_stats_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_stats campaign_stats_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_stats
    ADD CONSTRAINT campaign_stats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contact_consent_events contact_consent_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consent_events
    ADD CONSTRAINT contact_consent_events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_consent_events contact_consent_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consent_events
    ADD CONSTRAINT contact_consent_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contact_consents contact_consents_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consents
    ADD CONSTRAINT contact_consents_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_consents contact_consents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consents
    ADD CONSTRAINT contact_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contact_consents contact_consents_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_consents
    ADD CONSTRAINT contact_consents_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contact_custom_field_options contact_custom_field_options_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_field_options
    ADD CONSTRAINT contact_custom_field_options_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.contact_custom_fields(id) ON DELETE CASCADE;


--
-- Name: contact_custom_field_values contact_custom_field_values_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_field_values
    ADD CONSTRAINT contact_custom_field_values_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_custom_field_values contact_custom_field_values_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_field_values
    ADD CONSTRAINT contact_custom_field_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.contact_custom_fields(id) ON DELETE RESTRICT;


--
-- Name: contact_custom_fields contact_custom_fields_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_custom_fields
    ADD CONSTRAINT contact_custom_fields_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contact_opt_out contact_opt_out_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_opt_out
    ADD CONSTRAINT contact_opt_out_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_opt_out contact_opt_out_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_opt_out
    ADD CONSTRAINT contact_opt_out_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversation_activity conversation_activity_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_activity
    ADD CONSTRAINT conversation_activity_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: conversation_activity conversation_activity_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_activity
    ADD CONSTRAINT conversation_activity_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: conversation_activity conversation_activity_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_activity
    ADD CONSTRAINT conversation_activity_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_activity conversation_activity_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_activity
    ADD CONSTRAINT conversation_activity_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversation_followups conversation_followups_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_followups
    ADD CONSTRAINT conversation_followups_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: conversation_followups conversation_followups_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_followups
    ADD CONSTRAINT conversation_followups_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: conversation_followups conversation_followups_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_followups
    ADD CONSTRAINT conversation_followups_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_followups conversation_followups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_followups
    ADD CONSTRAINT conversation_followups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_audit_logs event_audit_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_audit_logs
    ADD CONSTRAINT event_audit_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_audit_logs event_audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_audit_logs
    ADD CONSTRAINT event_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: events events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: messages messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: messages messages_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;


--
-- Name: messages messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: password_resets password_resets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: password_resets password_resets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: security_events security_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: security_events security_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: segment_contacts segment_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segment_contacts
    ADD CONSTRAINT segment_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: segment_contacts segment_contacts_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segment_contacts
    ADD CONSTRAINT segment_contacts_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments(id) ON DELETE CASCADE;


--
-- Name: segments segments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: support_attachments support_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT support_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.support_messages(id) ON DELETE SET NULL;


--
-- Name: support_attachments support_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT support_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_attachments support_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_attachments
    ADD CONSTRAINT support_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_internal_notes support_internal_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_internal_notes
    ADD CONSTRAINT support_internal_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: support_internal_notes support_internal_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_internal_notes
    ADD CONSTRAINT support_internal_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: support_internal_notes support_internal_notes_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_internal_notes
    ADD CONSTRAINT support_internal_notes_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_reads support_ticket_reads_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_reads
    ADD CONSTRAINT support_ticket_reads_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_reads support_ticket_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_reads
    ADD CONSTRAINT support_ticket_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: support_tickets support_tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: system_alerts system_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: system_event_bus system_event_bus_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_event_bus
    ADD CONSTRAINT system_event_bus_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: templates templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_ai_settings tenant_ai_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_ai_settings
    ADD CONSTRAINT tenant_ai_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_integrations tenant_integrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_integrations
    ADD CONSTRAINT tenant_integrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wallet_idempotency wallet_idempotency_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_idempotency
    ADD CONSTRAINT wallet_idempotency_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wallet_ledger wallet_ledger_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_base Owners and marketers can manage knowledge base; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and marketers can manage knowledge base" ON public.ai_knowledge_base USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: support_attachments Owners can add attachments to their tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can add attachments to their tickets" ON public.support_attachments FOR INSERT WITH CHECK (((uploaded_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.support_tickets st
  WHERE ((st.id = support_attachments.ticket_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role))))));


--
-- Name: support_messages Owners can add messages to their tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can add messages to their tickets" ON public.support_messages FOR INSERT WITH CHECK (((is_internal = false) AND (sender_id = auth.uid()) AND (sender_type = 'owner'::public.ticket_sender_type) AND (EXISTS ( SELECT 1
   FROM public.support_tickets st
  WHERE ((st.id = support_messages.ticket_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role))))));


--
-- Name: api_tokens Owners can create api tokens in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can create api tokens in their tenant" ON public.api_tokens FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: support_tickets Owners can create tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can create tickets" ON public.support_tickets FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role) AND (created_by = auth.uid())));


--
-- Name: api_tokens Owners can delete api tokens in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete api tokens in their tenant" ON public.api_tokens FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: contact_custom_fields Owners can delete custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete custom fields" ON public.contact_custom_fields FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: tenant_integrations Owners can delete integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete integrations" ON public.tenant_integrations FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: contact_custom_field_options Owners can delete options for their tenant fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete options for their tenant fields" ON public.contact_custom_field_options FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.contact_custom_fields cf
  WHERE ((cf.id = contact_custom_field_options.field_id) AND (cf.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: contact_custom_fields Owners can insert custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert custom fields" ON public.contact_custom_fields FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: tenant_integrations Owners can insert integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert integrations" ON public.tenant_integrations FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: contact_custom_field_options Owners can insert options for their tenant fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert options for their tenant fields" ON public.contact_custom_field_options FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.contact_custom_fields cf
  WHERE ((cf.id = contact_custom_field_options.field_id) AND (cf.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: profiles Owners can insert profiles in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert profiles in their tenant" ON public.profiles FOR INSERT TO authenticated WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: user_roles Owners can insert roles for their tenant users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert roles for their tenant users" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: tenant_ai_settings Owners can manage AI settings in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage AI settings in their tenant" ON public.tenant_ai_settings USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: api_tokens Owners can update api tokens in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update api tokens in their tenant" ON public.api_tokens FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: contact_custom_fields Owners can update custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update custom fields" ON public.contact_custom_fields FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: tenant_integrations Owners can update integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update integrations" ON public.tenant_integrations FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: contact_custom_field_options Owners can update options for their tenant fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update options for their tenant fields" ON public.contact_custom_field_options FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.contact_custom_fields cf
  WHERE ((cf.id = contact_custom_field_options.field_id) AND (cf.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: profiles Owners can update profiles in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update profiles in their tenant" ON public.profiles FOR UPDATE TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: user_roles Owners can update roles in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update roles in their tenant" ON public.user_roles FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: support_tickets Owners can update their tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their tickets" ON public.support_tickets FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: api_tokens Owners can view api tokens in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view api tokens in their tenant" ON public.api_tokens FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: support_attachments Owners can view attachments on their tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view attachments on their tickets" ON public.support_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.support_tickets st
  WHERE ((st.id = support_attachments.ticket_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)))));


--
-- Name: support_messages Owners can view messages on their tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view messages on their tickets" ON public.support_messages FOR SELECT USING (((is_internal = false) AND (EXISTS ( SELECT 1
   FROM public.support_tickets st
  WHERE ((st.id = support_messages.ticket_id) AND (st.tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role))))));


--
-- Name: profiles Owners can view profiles in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view profiles in their tenant" ON public.profiles FOR SELECT TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: user_roles Owners can view roles in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view roles in their tenant" ON public.user_roles FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: security_events Owners can view tenant security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view tenant security events" ON public.security_events FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: support_tickets Owners can view their tenant tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view their tenant tickets" ON public.support_tickets FOR SELECT USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_tenant_role(auth.uid(), 'owner'::public.tenant_role)));


--
-- Name: security_events Service role insert only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role insert only" ON public.security_events FOR INSERT WITH CHECK (false);


--
-- Name: wallet_idempotency Service role only - insert idempotency; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only - insert idempotency" ON public.wallet_idempotency FOR INSERT WITH CHECK (false);


--
-- Name: wallet_idempotency Service role only - select idempotency; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only - select idempotency" ON public.wallet_idempotency FOR SELECT USING (false);


--
-- Name: password_resets Service role only access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only access" ON public.password_resets USING (false) WITH CHECK (false);


--
-- Name: tenants Super admins can delete tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can delete tenants" ON public.tenants FOR DELETE USING (public.is_super_admin(auth.uid()));


--
-- Name: tenants Super admins can insert tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can insert tenants" ON public.tenants FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: tenant_ai_settings Super admins can manage all AI settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all AI settings" ON public.tenant_ai_settings USING (public.is_super_admin(auth.uid()));


--
-- Name: conversation_activity Super admins can manage all activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all activity" ON public.conversation_activity USING (public.is_super_admin(auth.uid()));


--
-- Name: system_alerts Super admins can manage all alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all alerts" ON public.system_alerts USING (public.is_super_admin(auth.uid()));


--
-- Name: api_tokens Super admins can manage all api tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all api tokens" ON public.api_tokens USING (public.is_super_admin(auth.uid()));


--
-- Name: support_attachments Super admins can manage all attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all attachments" ON public.support_attachments USING (public.is_super_admin(auth.uid()));


--
-- Name: automation_events Super admins can manage all automation events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all automation events" ON public.automation_events USING (public.is_super_admin(auth.uid()));


--
-- Name: automation_run_steps Super admins can manage all automation run steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all automation run steps" ON public.automation_run_steps USING (public.is_super_admin(auth.uid()));


--
-- Name: automation_runs Super admins can manage all automation runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all automation runs" ON public.automation_runs USING (public.is_super_admin(auth.uid()));


--
-- Name: automations Super admins can manage all automations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all automations" ON public.automations USING (public.is_super_admin(auth.uid()));


--
-- Name: campaign_contacts Super admins can manage all campaign contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all campaign contacts" ON public.campaign_contacts USING (public.is_super_admin(auth.uid()));


--
-- Name: campaign_deliveries Super admins can manage all campaign deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all campaign deliveries" ON public.campaign_deliveries USING (public.is_super_admin(auth.uid()));


--
-- Name: campaign_stats Super admins can manage all campaign stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all campaign stats" ON public.campaign_stats USING (public.is_super_admin(auth.uid()));


--
-- Name: campaigns Super admins can manage all campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all campaigns" ON public.campaigns USING (public.is_super_admin(auth.uid()));


--
-- Name: contact_consent_events Super admins can manage all consent events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all consent events" ON public.contact_consent_events USING (public.is_super_admin(auth.uid()));


--
-- Name: contact_consents Super admins can manage all consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all consents" ON public.contact_consents USING (public.is_super_admin(auth.uid()));


--
-- Name: contacts Super admins can manage all contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all contacts" ON public.contacts USING (public.is_super_admin(auth.uid()));


--
-- Name: conversations Super admins can manage all conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all conversations" ON public.conversations TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: contact_custom_field_values Super admins can manage all custom field values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all custom field values" ON public.contact_custom_field_values USING (public.is_super_admin(auth.uid()));


--
-- Name: contact_custom_fields Super admins can manage all custom fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all custom fields" ON public.contact_custom_fields USING (public.is_super_admin(auth.uid()));


--
-- Name: event_audit_logs Super admins can manage all event audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all event audit logs" ON public.event_audit_logs USING (public.is_super_admin(auth.uid()));


--
-- Name: events Super admins can manage all events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all events" ON public.events USING (public.is_super_admin(auth.uid()));


--
-- Name: conversation_followups Super admins can manage all followups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all followups" ON public.conversation_followups USING (public.is_super_admin(auth.uid()));


--
-- Name: automation_idempotency Super admins can manage all idempotency records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all idempotency records" ON public.automation_idempotency USING (public.is_super_admin(auth.uid()));


--
-- Name: tenant_integrations Super admins can manage all integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all integrations" ON public.tenant_integrations USING (public.is_super_admin(auth.uid()));


--
-- Name: support_internal_notes Super admins can manage all internal notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all internal notes" ON public.support_internal_notes USING (public.is_super_admin(auth.uid()));


--
-- Name: ai_knowledge_base Super admins can manage all knowledge base entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all knowledge base entries" ON public.ai_knowledge_base USING (public.is_super_admin(auth.uid()));


--
-- Name: wallet_ledger Super admins can manage all ledger entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all ledger entries" ON public.wallet_ledger USING (public.is_super_admin(auth.uid()));


--
-- Name: messages Super admins can manage all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all messages" ON public.messages TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));


--
-- Name: support_messages Super admins can manage all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all messages" ON public.support_messages USING (public.is_super_admin(auth.uid()));


--
-- Name: contact_opt_out Super admins can manage all opt-outs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all opt-outs" ON public.contact_opt_out USING (public.is_super_admin(auth.uid()));


--
-- Name: contact_custom_field_options Super admins can manage all options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all options" ON public.contact_custom_field_options USING (public.is_super_admin(auth.uid()));


--
-- Name: profiles Super admins can manage all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all profiles" ON public.profiles TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: campaign_queue Super admins can manage all queue items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all queue items" ON public.campaign_queue USING (public.is_super_admin(auth.uid()));


--
-- Name: user_roles Super admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all roles" ON public.user_roles TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: segment_contacts Super admins can manage all segment contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all segment contacts" ON public.segment_contacts USING (public.is_super_admin(auth.uid()));


--
-- Name: segments Super admins can manage all segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all segments" ON public.segments USING (public.is_super_admin(auth.uid()));


--
-- Name: system_event_bus Super admins can manage all system events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all system events" ON public.system_event_bus USING (public.is_super_admin(auth.uid()));


--
-- Name: templates Super admins can manage all templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all templates" ON public.templates USING (public.is_super_admin(auth.uid()));


--
-- Name: support_tickets Super admins can manage all tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all tickets" ON public.support_tickets USING (public.is_super_admin(auth.uid()));


--
-- Name: wallet_transactions Super admins can manage all wallet transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all wallet transactions" ON public.wallet_transactions USING (public.is_super_admin(auth.uid()));


--
-- Name: wallets Super admins can manage all wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all wallets" ON public.wallets USING (public.is_super_admin(auth.uid()));


--
-- Name: automation_events Super admins can manage automation events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage automation events" ON public.automation_events USING (public.is_super_admin(auth.uid()));


--
-- Name: automation_idempotency Super admins can manage automation idempotency; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage automation idempotency" ON public.automation_idempotency USING (public.is_super_admin(auth.uid()));


--
-- Name: tenants Super admins can update tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can update tenants" ON public.tenants FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: ai_interaction_logs Super admins can view all AI logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all AI logs" ON public.ai_interaction_logs FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: profiles Super admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: support_ticket_reads Super admins can view all read statuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all read statuses" ON public.support_ticket_reads FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: security_events Super admins can view all security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all security events" ON public.security_events FOR SELECT USING (public.is_super_admin(auth.uid()));


--
-- Name: tenants Super admins can view all tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all tenants" ON public.tenants FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));


--
-- Name: support_internal_notes Tenant users cannot access internal notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant users cannot access internal notes" ON public.support_internal_notes FOR SELECT USING (false);


--
-- Name: support_ticket_reads Users can manage their own read status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own read status" ON public.support_ticket_reads USING ((user_id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: ai_interaction_logs Users can view AI logs in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view AI logs in their tenant" ON public.ai_interaction_logs FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: tenant_ai_settings Users can view AI settings in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view AI settings in their tenant" ON public.tenant_ai_settings FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversation_activity Users can view activity in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view activity in their tenant" ON public.conversation_activity FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: system_alerts Users can view alerts in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view alerts in their tenant" ON public.system_alerts FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: automation_events Users can view automation events in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view automation events in their tenant" ON public.automation_events FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: automation_idempotency Users can view automation idempotency in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view automation idempotency in their tenant" ON public.automation_idempotency FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: automation_run_steps Users can view automation run steps in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view automation run steps in their tenant" ON public.automation_run_steps FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: automation_runs Users can view automation runs in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view automation runs in their tenant" ON public.automation_runs FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: automations Users can view automations in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view automations in their tenant" ON public.automations FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: campaign_contacts Users can view campaign contacts in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaign contacts in their tenant" ON public.campaign_contacts FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: campaign_deliveries Users can view campaign deliveries in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaign deliveries in their tenant" ON public.campaign_deliveries FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: campaign_stats Users can view campaign stats in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaign stats in their tenant" ON public.campaign_stats FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: campaigns Users can view campaigns in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaigns in their tenant" ON public.campaigns FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contact_consent_events Users can view consent events in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view consent events in their tenant" ON public.contact_consent_events FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contact_consents Users can view consents in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view consents in their tenant" ON public.contact_consents FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contacts Users can view contacts in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view contacts in their tenant" ON public.contacts FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversations Users can view conversations in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view conversations in their tenant" ON public.conversations FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contact_custom_field_values Users can view custom field values for contacts in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view custom field values for contacts in their tenant" ON public.contact_custom_field_values FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_custom_field_values.contact_id) AND (c.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: contact_custom_fields Users can view custom fields in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view custom fields in their tenant" ON public.contact_custom_fields FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: event_audit_logs Users can view event audit logs in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view event audit logs in their tenant" ON public.event_audit_logs FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: events Users can view events in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view events in their tenant" ON public.events FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: conversation_followups Users can view followups in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view followups in their tenant" ON public.conversation_followups FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: tenant_integrations Users can view integrations in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view integrations in their tenant" ON public.tenant_integrations FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: ai_knowledge_base Users can view knowledge base in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view knowledge base in their tenant" ON public.ai_knowledge_base FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: wallet_ledger Users can view ledger entries in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ledger entries in their tenant" ON public.wallet_ledger FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: messages Users can view messages in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their tenant" ON public.messages FOR SELECT TO authenticated USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contact_opt_out Users can view opt-outs in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view opt-outs in their tenant" ON public.contact_opt_out FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: contact_custom_field_options Users can view options for fields in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view options for fields in their tenant" ON public.contact_custom_field_options FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.contact_custom_fields cf
  WHERE ((cf.id = contact_custom_field_options.field_id) AND (cf.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: campaign_queue Users can view queue items in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view queue items in their tenant" ON public.campaign_queue FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: segment_contacts Users can view segment contacts in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view segment contacts in their tenant" ON public.segment_contacts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.segments s
  WHERE ((s.id = segment_contacts.segment_id) AND (s.tenant_id = public.get_user_tenant_id(auth.uid()))))));


--
-- Name: segments Users can view segments in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view segments in their tenant" ON public.segments FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: system_event_bus Users can view system events in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view system events in their tenant" ON public.system_event_bus FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: templates Users can view templates in their tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view templates in their tenant" ON public.templates FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: user_roles Users can view their own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: tenants Users can view their own tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own tenant" ON public.tenants FOR SELECT TO authenticated USING ((id = public.get_user_tenant_id(auth.uid())));


--
-- Name: wallets Users can view their tenant wallet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their tenant wallet" ON public.wallets FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: wallet_transactions Users can view their tenant wallet transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their tenant wallet transactions" ON public.wallet_transactions FOR SELECT USING ((tenant_id = public.get_user_tenant_id(auth.uid())));


--
-- Name: automations Users with marketer or owner role can delete automations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete automations" ON public.automations FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: campaigns Users with marketer or owner role can delete campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete campaigns" ON public.campaigns FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_consents Users with marketer or owner role can delete consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete consents" ON public.contact_consents FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contacts Users with marketer or owner role can delete contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete contacts" ON public.contacts FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversations Users with marketer or owner role can delete conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete conversations" ON public.conversations FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_custom_field_values Users with marketer or owner role can delete custom field value; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete custom field value" ON public.contact_custom_field_values FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_custom_field_values.contact_id) AND (c.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: events Users with marketer or owner role can delete events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete events" ON public.events FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversation_followups Users with marketer or owner role can delete followups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete followups" ON public.conversation_followups FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: messages Users with marketer or owner role can delete messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete messages" ON public.messages FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: segment_contacts Users with marketer or owner role can delete segment contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete segment contacts" ON public.segment_contacts FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.segments s
  WHERE ((s.id = segment_contacts.segment_id) AND (s.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: segments Users with marketer or owner role can delete segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete segments" ON public.segments FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: templates Users with marketer or owner role can delete templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can delete templates" ON public.templates FOR DELETE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversation_activity Users with marketer or owner role can insert activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert activity" ON public.conversation_activity FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: automations Users with marketer or owner role can insert automations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert automations" ON public.automations FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: campaigns Users with marketer or owner role can insert campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_consent_events Users with marketer or owner role can insert consent events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert consent events" ON public.contact_consent_events FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_consents Users with marketer or owner role can insert consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert consents" ON public.contact_consents FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contacts Users with marketer or owner role can insert contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert contacts" ON public.contacts FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversations Users with marketer or owner role can insert conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert conversations" ON public.conversations FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_custom_field_values Users with marketer or owner role can insert custom field value; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert custom field value" ON public.contact_custom_field_values FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_custom_field_values.contact_id) AND (c.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: event_audit_logs Users with marketer or owner role can insert event audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert event audit logs" ON public.event_audit_logs FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: events Users with marketer or owner role can insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert events" ON public.events FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversation_followups Users with marketer or owner role can insert followups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert followups" ON public.conversation_followups FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: messages Users with marketer or owner role can insert messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert messages" ON public.messages FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: segment_contacts Users with marketer or owner role can insert segment contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert segment contacts" ON public.segment_contacts FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.segments s
  WHERE ((s.id = segment_contacts.segment_id) AND (s.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: segments Users with marketer or owner role can insert segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert segments" ON public.segments FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: system_event_bus Users with marketer or owner role can insert system events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert system events" ON public.system_event_bus FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: templates Users with marketer or owner role can insert templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can insert templates" ON public.templates FOR INSERT WITH CHECK (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_opt_out Users with marketer or owner role can manage opt-outs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can manage opt-outs" ON public.contact_opt_out USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: system_alerts Users with marketer or owner role can update alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update alerts" ON public.system_alerts FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: automations Users with marketer or owner role can update automations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update automations" ON public.automations FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: campaigns Users with marketer or owner role can update campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update campaigns" ON public.campaigns FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_consents Users with marketer or owner role can update consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update consents" ON public.contact_consents FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contacts Users with marketer or owner role can update contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update contacts" ON public.contacts FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversations Users with marketer or owner role can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update conversations" ON public.conversations FOR UPDATE TO authenticated USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: contact_custom_field_values Users with marketer or owner role can update custom field value; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update custom field value" ON public.contact_custom_field_values FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_custom_field_values.contact_id) AND (c.tenant_id = public.get_user_tenant_id(auth.uid()))))) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: events Users with marketer or owner role can update events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update events" ON public.events FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: conversation_followups Users with marketer or owner role can update followups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update followups" ON public.conversation_followups FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: messages Users with marketer or owner role can update messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update messages" ON public.messages FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: segments Users with marketer or owner role can update segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update segments" ON public.segments FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: templates Users with marketer or owner role can update templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with marketer or owner role can update templates" ON public.templates FOR UPDATE USING (((tenant_id = public.get_user_tenant_id(auth.uid())) AND public.has_any_tenant_role(auth.uid(), ARRAY['owner'::public.tenant_role, 'marketer'::public.tenant_role])));


--
-- Name: ai_interaction_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_interaction_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_knowledge_base; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

--
-- Name: api_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_run_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: automations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_consent_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_consent_events ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_custom_field_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_custom_field_options ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_custom_field_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_custom_field_values ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_custom_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_custom_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_opt_out; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_opt_out ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_followups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_followups ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: event_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: password_resets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

--
-- Name: segment_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.segment_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

--
-- Name: support_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: support_internal_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_internal_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: system_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: system_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

--
-- Name: system_event_bus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_event_bus ENABLE ROW LEVEL SECURITY;

--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_ai_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_ai_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;