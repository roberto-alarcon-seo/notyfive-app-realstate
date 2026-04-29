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
 *
 * Action: "link_phone"
 *   Input:  { action: "link_phone", tenant_id: string, phone_number: string }
 *   Auth:   caller must be super_admin.
 *   Effect: Validates E.164 phone number, finds the matching IncomingPhoneNumber
 *           inside the tenant's Twilio subaccount, and configures its SmsUrl
 *           (inbound webhook) to point to twilio-inbound-webhook automatically.
 *           Then updates tenant_integrations.phone_number, which fires the
 *           SQL trigger that flips status to 'connected' and seeds templates.
 *
 *           Additionally, attempts to register the phone number as a WhatsApp
 *           Sender via Twilio's Messaging v2 Senders API (BYON / self-signup).
 *           If the sender already exists, only the inbound webhook is updated.
 *           If Twilio requires further verification (OTP, Meta Business
 *           Manager approval), a clear, user-facing message is returned in
 *           `whatsapp_sender.message` so the operator knows what to do next.
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

    if (action !== 'create' && action !== 'link_phone') {
      return json({ code: 'INVALID_INPUT', message: 'Unsupported action' }, 400);
    }
    if (!tenantId || typeof tenantId !== 'string') {
      return json({ code: 'INVALID_INPUT', message: 'tenant_id is required' }, 400);
    }
    if (!MASTER_SID || !MASTER_TOKEN) {
      return json({ code: 'CONFIG_MISSING', message: 'Master Twilio credentials are not configured' }, 500);
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-inbound-webhook`;

    // ============================================================
    // ACTION: link_phone
    // ============================================================
    if (action === 'link_phone') {
      const phoneNumber: string | undefined = body?.phone_number;
      if (!phoneNumber || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
        return json({ code: 'INVALID_INPUT', message: 'phone_number must be in E.164 format (e.g. +5215512345678)' }, 400);
      }

      const { data: integ, error: integErr } = await admin
        .from('tenant_integrations')
        .select('id, account_sid, auth_token_encrypted, is_subaccount')
        .eq('tenant_id', tenantId)
        .eq('provider', 'twilio')
        .maybeSingle();
      if (integErr || !integ?.account_sid || !integ?.auth_token_encrypted) {
        return json({ code: 'NOT_PROVISIONED', message: 'Twilio subaccount not provisioned for this tenant' }, 404);
      }

      const subSid = integ.account_sid;
      const subToken = atob(integ.auth_token_encrypted);
      const subAuth = btoa(`${subSid}:${subToken}`);

      // ----------------------------------------------------------------
      // 1) Try to register the phone as a WhatsApp Sender (BYON flow).
      //    Twilio Messaging v2 endpoint: POST /v2/Channels/Senders
      //    Docs: https://www.twilio.com/docs/messaging/api/sender-resource
      //    We treat "already exists" as a success and continue to the
      //    webhook configuration step. Anything that requires human
      //    intervention is surfaced verbatim to the UI.
      // ----------------------------------------------------------------
      let waSender: {
        registered: boolean;
        already_exists: boolean;
        requires_verification: boolean;
        sender_sid: string | null;
        status: string | null;
        message: string;
      } = {
        registered: false,
        already_exists: false,
        requires_verification: false,
        sender_sid: null,
        status: null,
        message: '',
      };

      try {
        const senderPayload = {
          sender_id: `whatsapp:${phoneNumber}`,
          configuration: {
            webhook: {
              callback_url: webhookUrl,
              callback_method: 'POST',
            },
          },
        };

        const senderRes = await fetch('https://messaging.twilio.com/v2/Channels/Senders', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${subAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(senderPayload),
        });
        const senderBody = await senderRes.json().catch(() => ({} as any));

        if (senderRes.ok) {
          waSender.registered = true;
          waSender.sender_sid = senderBody?.sid ?? null;
          waSender.status = senderBody?.status ?? null;
          const status = String(senderBody?.status || '').toUpperCase();
          if (
            status === 'CREATING' ||
            status === 'VERIFYING' ||
            status === 'OFFLINE' ||
            status === 'PENDING'
          ) {
            waSender.requires_verification = true;
            waSender.message =
              'Registro iniciado. Por favor, verifica el código enviado a tu teléfono o aprueba la solicitud en tu Facebook Business Manager.';
          } else {
            waSender.message = 'Línea vinculada correctamente. Iniciando proceso de aprobación con Meta.';
          }
        } else {
          // Twilio returns 409 / specific error codes when the sender already exists.
          const code = Number(senderBody?.code ?? 0);
          const msg = String(senderBody?.message || '').toLowerCase();
          const alreadyExists =
            senderRes.status === 409 ||
            code === 63044 || // sender already registered
            code === 20409 || // generic conflict
            msg.includes('already') ||
            msg.includes('exists');

          if (alreadyExists) {
            waSender.already_exists = true;
            waSender.message = 'El número ya estaba registrado como WhatsApp Sender. Actualizando webhook.';
          } else {
            // Surface a clear, actionable error but do NOT abort: the operator
            // may have registered the number via Twilio Console already and
            // we still want to set the webhook + persist the phone.
            waSender.message =
              senderBody?.message ||
              'No se pudo registrar como WhatsApp Sender automáticamente. Revisa Business Manager o Twilio Console.';
          }
        }
      } catch (e) {
        waSender.message =
          'No se pudo contactar la API de WhatsApp Senders de Twilio. Se continuará con la configuración del webhook.';
      }

      // Look up IncomingPhoneNumber inside the subaccount
      const lookupRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${subSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`,
        { headers: { 'Authorization': `Basic ${subAuth}` } },
      );
      const lookupBody = await lookupRes.json().catch(() => ({}));
      if (!lookupRes.ok) {
        return json({
          code: 'TWILIO_ERROR',
          message: lookupBody?.message || 'Failed to query IncomingPhoneNumbers',
          twilio_status: lookupRes.status,
          whatsapp_sender: waSender,
        }, 502);
      }

      const numbers = (lookupBody?.incoming_phone_numbers || []) as Array<{ sid: string; phone_number: string }>;
      let phoneSid: string | null = numbers[0]?.sid ?? null;

      // If we found the number, auto-configure SmsUrl (incoming webhook)
      if (phoneSid) {
        const updRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${subSid}/IncomingPhoneNumbers/${phoneSid}.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${subAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              SmsUrl: webhookUrl,
              SmsMethod: 'POST',
            }),
          },
        );
        if (!updRes.ok) {
          const errBody = await updRes.json().catch(() => ({}));
          return json({
            code: 'TWILIO_ERROR',
            message: errBody?.message || 'Failed to configure phone webhook',
            twilio_status: updRes.status,
            whatsapp_sender: waSender,
          }, 502);
        }
      }
      // If number isn't in the subaccount yet, we still persist it so the
      // operator can finish the assignment in Twilio console; trigger will activate.

      const { error: updErr } = await admin
        .from('tenant_integrations')
        .update({
          phone_number: phoneNumber,
          webhook_url: webhookUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integ.id);
      if (updErr) throw updErr;

      return json({
        ok: true,
        phone_number: phoneNumber,
        phone_sid: phoneSid,
        webhook_configured: !!phoneSid,
        webhook_url: webhookUrl,
        whatsapp_sender: waSender,
      });
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
    // webhookUrl already declared above

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