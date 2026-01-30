import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const urlAccountSid = twilioMatch[1];
    console.log(`🔐 Found Account SID in URL: ${urlAccountSid}`);

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

    // Get ALL Twilio integrations for tenant (current and historical)
    // This allows access to media from previous accounts
    const { data: integrations } = await supabase
      .from('tenant_integrations')
      .select('account_sid, auth_token_encrypted, status')
      .eq('tenant_id', profile.tenant_id)
      .eq('provider', 'twilio');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ error: 'No Twilio integration found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find integration matching the URL's account SID
    // First try exact match, then fall back to current connected integration
    let integration = integrations.find(i => i.account_sid === urlAccountSid);
    
    if (!integration) {
      // If no exact match, check if URL belongs to a message from this tenant
      // by verifying the message exists in their conversations
      const messageMatch = mediaUrl.match(/Messages\/(MM[a-f0-9]+)/i);
      
      if (messageMatch) {
        const messageSid = messageMatch[1];
        
        // Check if this message belongs to the tenant's conversations
        const { data: message } = await supabase
          .from('messages')
          .select('tenant_id, twilio_message_sid')
          .eq('twilio_message_sid', messageSid)
          .eq('tenant_id', profile.tenant_id)
          .single();
        
        if (message) {
          console.log(`✅ Message ${messageSid} verified as belonging to tenant`);
          // Use current connected integration to try fetching
          // Some Twilio accounts allow cross-account access for subaccounts
          integration = integrations.find(i => i.status === 'connected');
          
          if (!integration) {
            console.log(`⚠️ No connected integration, trying with URL's account SID directly`);
            // Last resort: try to fetch with basic auth using the account from URL
            // This will fail if credentials don't match, but it's the best we can do
            return new Response(JSON.stringify({ 
              error: 'Media belongs to a previous Twilio account. The media may no longer be accessible.' 
            }), {
              status: 410, // Gone - resource no longer available
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          console.error(`❌ Message ${messageSid} not found for tenant ${profile.tenant_id}`);
          return new Response(JSON.stringify({ error: 'Message not found or access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.error(`❌ Could not extract message SID from URL`);
        return new Response(JSON.stringify({ error: 'Invalid media URL format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Decode auth token
    const authToken = atob(integration.auth_token_encrypted);
    const accountSid = integration.account_sid;

    // Fetch media from Twilio with authentication
    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    
    console.log(`📡 Fetching from Twilio using account ${accountSid.substring(0, 10)}...`);
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
      },
    });

    if (!mediaResponse.ok) {
      console.error(`❌ Twilio fetch failed: ${mediaResponse.status}`);
      
      // If the current account can't access, the media may be from an old account
      if (mediaResponse.status === 401 || mediaResponse.status === 403) {
        return new Response(JSON.stringify({ 
          error: 'Media no longer accessible. It may belong to a previous Twilio account.' 
        }), {
          status: 410, // Gone
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
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
