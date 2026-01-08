import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwilioMessagingService {
  sid: string;
  friendly_name: string;
  date_created: string;
}

interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    mms: boolean;
    sms: boolean;
    voice: boolean;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountSid, authToken, action, tenantId, selectedService, selectedNumber } = await req.json();

    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({ error: 'Account SID y Auth Token son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Basic Auth header for Twilio API
    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    const twilioHeaders = {
      'Authorization': `Basic ${twilioAuth}`,
      'Content-Type': 'application/json',
    };

    // Action: save - Save the integration to database
    if (action === 'save') {
      if (!tenantId) {
        return new Response(
          JSON.stringify({ error: 'Tenant ID es requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!selectedService && !selectedNumber) {
        return new Response(
          JSON.stringify({ error: 'Debes seleccionar un Messaging Service o un número' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify credentials are still valid
      const accountRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: twilioHeaders,
      });

      if (!accountRes.ok) {
        return new Response(
          JSON.stringify({ error: 'Credenciales inválidas o expiradas' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const accountData = await accountRes.json();

      // Generate webhook URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const webhookUrl = `${supabaseUrl}/functions/v1/twilio-inbound-webhook`;

      // Encrypt auth token (simple base64 encoding - in production use proper encryption)
      const authTokenEncrypted = btoa(authToken);

      // Save to database using service role
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

      const integrationData: Record<string, unknown> = {
        tenant_id: tenantId,
        provider: 'twilio',
        account_sid: accountSid,
        auth_token_encrypted: authTokenEncrypted,
        webhook_url: webhookUrl,
        status: 'connected',
        balance: null,
        currency: 'USD',
      };

      // Also store the account name for display purposes
      integrationData.phone_number_name = accountData.friendly_name;

      if (selectedService) {
        integrationData.messaging_service_sid = selectedService.sid;
        integrationData.phone_number_name = selectedService.name || selectedService.friendly_name || accountData.friendly_name;
        integrationData.phone_number = null;
      } else if (selectedNumber) {
        // Handle both camelCase (from frontend) and snake_case property names
        const phoneNum = selectedNumber.phoneNumber || selectedNumber.phone_number;
        const phoneName = selectedNumber.friendlyName || selectedNumber.friendly_name;
        
        console.log('Saving phone number:', { phoneNum, phoneName, selectedNumber });
        
        integrationData.phone_number = phoneNum;
        integrationData.phone_number_name = phoneName || accountData.friendly_name;
        integrationData.messaging_service_sid = null;
      }

      console.log('Saving integration data:', JSON.stringify(integrationData));

      const { data, error } = await supabase
        .from('tenant_integrations')
        .upsert(integrationData, {
          onConflict: 'tenant_id,provider',
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving integration:', error);
        return new Response(
          JSON.stringify({ error: 'Error al guardar la integración' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Twilio integration saved successfully:', data.id);

      return new Response(
        JSON.stringify({
          success: true,
          integration: {
            id: data.id,
            webhookUrl: webhookUrl,
            accountName: accountData.friendly_name,
            status: accountData.status,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default action: validate and fetch resources
    console.log('Validating Twilio credentials...');

    // Step 1: Validate credentials by fetching account info
    const accountRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: twilioHeaders,
    });

    if (!accountRes.ok) {
      const status = accountRes.status;
      console.error('Twilio API error:', status);
      
      if (status === 401) {
        return new Response(
          JSON.stringify({ 
            isValid: false, 
            error: 'Credenciales inválidas. Verifica tu Account SID y Auth Token.' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (status === 404) {
        return new Response(
          JSON.stringify({ 
            isValid: false, 
            error: 'Account SID no encontrado. Verifica tus credenciales.' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          isValid: false, 
          error: 'Error al conectar con Twilio. Intenta de nuevo.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountData = await accountRes.json();
    console.log('Account validated:', accountData.friendly_name);

    // Step 2: Fetch Messaging Services
    let messagingServices: TwilioMessagingService[] = [];
    try {
      const servicesRes = await fetch(`https://messaging.twilio.com/v1/Services`, {
        headers: twilioHeaders,
      });
      
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        messagingServices = servicesData.services || [];
        console.log('Messaging Services found:', messagingServices.length);
      }
    } catch (e) {
      console.error('Error fetching messaging services:', e);
    }

    // Step 3: Fetch WhatsApp-enabled numbers (Twilio Senders)
    let whatsappNumbers: TwilioPhoneNumber[] = [];
    try {
      // Fetch incoming phone numbers that could be WhatsApp enabled
      const numbersRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
        { headers: twilioHeaders }
      );
      
      if (numbersRes.ok) {
        const numbersData = await numbersRes.json();
        whatsappNumbers = numbersData.incoming_phone_numbers || [];
        console.log('Phone numbers found:', whatsappNumbers.length);
      }
    } catch (e) {
      console.error('Error fetching phone numbers:', e);
    }

    // Check account status
    const isActive = accountData.status === 'active';
    const warning = !isActive 
      ? `Tu cuenta de Twilio está en estado "${accountData.status}". Algunas funciones pueden no estar disponibles.`
      : null;

    return new Response(
      JSON.stringify({
        isValid: true,
        account: {
          name: accountData.friendly_name,
          status: accountData.status,
          type: accountData.type,
        },
        messagingServices: messagingServices.map(s => ({
          sid: s.sid,
          name: s.friendly_name,
          dateCreated: s.date_created,
        })),
        phoneNumbers: whatsappNumbers.map(n => ({
          sid: n.sid,
          phoneNumber: n.phone_number,
          friendlyName: n.friendly_name,
        })),
        warning,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-twilio-credentials:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
