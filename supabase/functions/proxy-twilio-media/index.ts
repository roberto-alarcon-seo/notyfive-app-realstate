import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get media URL from query params
    const url = new URL(req.url);
    const mediaUrl = url.searchParams.get('url');
    
    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📥 Proxying media request for URL: ${mediaUrl.substring(0, 50)}...`);

    // Extract account SID from Twilio URL
    // URLs look like: https://api.twilio.com/2010-04-01/Accounts/ACXXXXXX/Messages/MMXXXXXX/Media/MEXXXXXX
    const twilioMatch = mediaUrl.match(/Accounts\/(AC[a-f0-9]+)/i);
    if (!twilioMatch) {
      // Not a Twilio URL, just redirect
      return Response.redirect(mediaUrl, 302);
    }

    const accountSid = twilioMatch[1];
    console.log(`🔐 Found Account SID: ${accountSid}`);

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'User has no tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Twilio integration for tenant
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('account_sid, auth_token_encrypted')
      .eq('tenant_id', profile.tenant_id)
      .eq('provider', 'twilio')
      .eq('status', 'connected')
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: 'No Twilio integration found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the account SID matches (security check)
    if (integration.account_sid !== accountSid) {
      console.error(`❌ Account SID mismatch: ${integration.account_sid} vs ${accountSid}`);
      return new Response(JSON.stringify({ error: 'Account mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode auth token
    const authToken = atob(integration.auth_token_encrypted);

    // Fetch media from Twilio with authentication
    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    
    console.log(`📡 Fetching from Twilio...`);
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
      },
    });

    if (!mediaResponse.ok) {
      console.error(`❌ Twilio fetch failed: ${mediaResponse.status}`);
      return new Response(JSON.stringify({ error: 'Failed to fetch media from Twilio' }), {
        status: mediaResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get content type and body
    const contentType = mediaResponse.headers.get('Content-Type') || 'application/octet-stream';
    const body = await mediaResponse.arrayBuffer();

    console.log(`✅ Successfully proxied media, type: ${contentType}, size: ${body.byteLength}`);

    // Return the media with proper headers
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });

  } catch (error) {
    console.error('❌ Error in proxy-twilio-media:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
