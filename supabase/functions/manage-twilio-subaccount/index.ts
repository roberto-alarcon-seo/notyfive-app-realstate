import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * manage-twilio-subaccount
 *
 * Action: "create"
 *   Input:  { action: "create", tenant_id: string, friendly_name?: string }
 *   Auth:   caller must be super_admin (validated via JWT + user_roles).
 *   Effect: Uses the master Twilio credentials (env) to create a Subaccount
 *           via Twilio REST API, then upserts public.tenant_integrations
 *           with the new subaccount SID + auth token (base64 stored), the
 *           default inbound webhook URL, status='pending_setup',
 *           is_subaccount=true, parent_account_sid=master SID.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const MASTER_SID = Deno.env.get('TWILIO_MASTER_ACCOUNT_SID');
  const MASTER_TOKEN = Deno.env.get('TWILIO_MASTER_AUTH_TOKEN');

  try {
    // ---- AuthN: validate JWT ----
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ code: 'UNAUTHENTICATED', message: 'Missing bearer token' }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ code: 'UNAUTHENTICATED', message: 'Invalid token' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // ---- AuthZ: must be super_admin ----
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isSuper, error: roleErr } = await admin.rpc('is_super_admin', { _user_id: userId });
    if (roleErr || !isSuper) {
      return json({ code: 'FORBIDDEN', message: 'Super admin required' }, 403);
    }

    // ---- Parse body ----
    const body = await req.json().catch(() => ({} as any));
    const action: string = body?.action;
    const tenantId: string | undefined = body?.tenant_id;
    const friendlyNameOverride: string | undefined = body?.friendly_name;

    if (action !== 'create') {
      return json({ code: 'INVALID_INPUT', message: 'Unsupported action' }, 400);
    }
    if (!tenantId || typeof tenantId !== 'string') {
      return json({ code: 'INVALID_INPUT', message: 'tenant_id is required' }, 400);
    }
    if (!MASTER_SID || !MASTER_TOKEN) {
      return json({ code: 'CONFIG_MISSING', message: 'Master Twilio credentials are not configured' }, 500);
    }

    // ---- Load tenant for friendly name ----
    const { data: tenant, error: tErr } = await admin
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle();
    if (tErr || !tenant) {
      return json({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' }, 404);
    }

    // ---- Idempotency: if integration already has a subaccount SID, return it ----
    const { data: existing } = await admin
      .from('tenant_integrations')
      .select('id, account_sid, is_subaccount, status, webhook_url')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .maybeSingle();

    if (existing?.is_subaccount && existing?.account_sid) {
      return json({
        ok: true,
        already_provisioned: true,
        integration_id: existing.id,
        account_sid: existing.account_sid,
        status: existing.status,
        webhook_url: existing.webhook_url,
      });
    }

    // ---- Call Twilio: create Subaccount ----
    const friendlyName = (friendlyNameOverride || `Brokia24 - ${tenant.name}`).slice(0, 64);
    const basicAuth = btoa(`${MASTER_SID}:${MASTER_TOKEN}`);

    const twilioRes = await fetch('https://api.twilio.com/2010-04-01/Accounts.json', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ FriendlyName: friendlyName }),
    });

    const twilioBody = await twilioRes.json().catch(() => ({}));
    if (!twilioRes.ok) {
      return json({
        code: 'TWILIO_ERROR',
        message: twilioBody?.message || 'Failed to create Twilio subaccount',
        twilio_status: twilioRes.status,
        twilio_code: twilioBody?.code,
      }, 502);
    }

    const subSid: string = twilioBody.sid;
    const subAuthToken: string = twilioBody.auth_token;
    if (!subSid || !subAuthToken) {
      return json({ code: 'TWILIO_ERROR', message: 'Twilio response missing sid/auth_token' }, 502);
    }

    // base64 (matches existing pattern across the codebase; encryption is tracked tech debt)
    const tokenStored = btoa(subAuthToken);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-inbound-webhook`;

    // ---- Upsert tenant_integrations ----
    const upsertPayload: Record<string, unknown> = {
      tenant_id: tenantId,
      provider: 'twilio',
      account_sid: subSid,
      auth_token_encrypted: tokenStored,
      phone_number: null,
      phone_number_name: friendlyName,
      messaging_service_sid: null,
      webhook_url: webhookUrl,
      status: 'pending_setup',
      is_subaccount: true,
      parent_account_sid: MASTER_SID,
      updated_at: new Date().toISOString(),
    };

    let integrationId: string | null = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await admin
        .from('tenant_integrations')
        .update(upsertPayload)
        .eq('id', existing.id)
        .select('id')
        .maybeSingle();
      if (updErr) throw updErr;
      integrationId = upd?.id ?? existing.id;
    } else {
      const { data: ins, error: insErr } = await admin
        .from('tenant_integrations')
        .insert(upsertPayload)
        .select('id')
        .maybeSingle();
      if (insErr) throw insErr;
      integrationId = ins?.id ?? null;
    }

    return json({
      ok: true,
      integration_id: integrationId,
      account_sid: subSid,
      friendly_name: friendlyName,
      status: 'pending_setup',
      webhook_url: webhookUrl,
      twilio_console_url: `https://console.twilio.com/?accountSid=${subSid}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ code: 'INTERNAL_ERROR', message }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});