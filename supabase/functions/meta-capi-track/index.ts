import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  tenant_id: string;
  contact_id: string;
  event_name: string;
  event_type: string;
  event_id?: string;
  custom_data: Record<string, unknown>;
  user_data: {
    phone?: string | null;
    email?: string | null;
    external_id?: string;
    fbp?: string;
    fbc?: string;
    client_ip_address?: string;
    client_user_agent?: string;
  };
  is_test?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { tenant_id, contact_id, event_name, event_type, event_id, custom_data, user_data, is_test } = body;

    // Fetch tenant settings
    const { data: settings, error: settingsError } = await supabase
      .from("tenant_settings")
      .select("meta_pixel_id, meta_capi_access_token, meta_test_event_code")
      .eq("tenant_id", tenant_id)
      .single();

    if (settingsError || !settings) {
      throw new Error("Tenant settings not found");
    }

    if (!settings.meta_capi_access_token) {
      throw new Error("Meta CAPI access token not configured");
    }

    if (!settings.meta_pixel_id) {
      throw new Error("Meta Pixel ID not configured");
    }

    // Get client IP and user agent
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     user_data.client_ip_address;
    const clientUserAgent = req.headers.get("user-agent") || user_data.client_user_agent;

    // Prepare user data for Meta
    const hashedUserData: Record<string, unknown> = {};

    if (user_data.email) {
      hashedUserData.em = [await hashValue(user_data.email.toLowerCase().trim())];
    }
    if (user_data.phone) {
      const normalizedPhone = user_data.phone.replace(/[^\d+]/g, "");
      hashedUserData.ph = [await hashValue(normalizedPhone)];
    }
    if (user_data.external_id) {
      hashedUserData.external_id = [await hashValue(user_data.external_id)];
    }
    if (user_data.fbp) {
      hashedUserData.fbp = user_data.fbp;
    }
    if (user_data.fbc) {
      hashedUserData.fbc = user_data.fbc;
    }
    if (clientIp) {
      hashedUserData.client_ip_address = clientIp;
    }
    if (clientUserAgent) {
      hashedUserData.client_user_agent = clientUserAgent;
    }

    // Prepare event data with event_id for deduplication
    const eventTime = Math.floor(Date.now() / 1000);
    const eventData: Record<string, unknown> = {
      event_name: event_name,
      event_time: eventTime,
      action_source: is_test ? "website" : "system_generated",
      user_data: hashedUserData,
      custom_data: custom_data,
    };

    // For website action_source, Meta requires event_source_url
    if (is_test) {
      eventData.event_source_url = "https://notyfive-app-realstate.lovable.app";
    }

    // Include event_id for deduplication
    if (event_id) {
      eventData.event_id = event_id;
    }

    // Build request payload
    const payload: Record<string, unknown> = {
      data: [eventData],
    };

    // Add test event code if configured or if this is a test event
    if (settings.meta_test_event_code) {
      payload.test_event_code = settings.meta_test_event_code;
    }

    // Send to Meta Conversions API with retry for 5xx errors
    const metaUrl = `https://graph.facebook.com/v21.0/${settings.meta_pixel_id}/events`;
    console.log("Sending to Meta CAPI:", JSON.stringify(payload, null, 2));
    let metaResponse: Response;
    let metaResult: Record<string, unknown>;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      metaResponse = await fetch(`${metaUrl}?access_token=${settings.meta_capi_access_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      metaResult = await metaResponse.json();

      if (metaResponse.ok) {
        break; // success
      }

      // Retry only on 5xx errors
      if (metaResponse.status >= 500 && attempt < maxAttempts) {
        console.warn(`Meta CAPI 5xx error (attempt ${attempt}), retrying...`, metaResult);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Non-retryable error or max attempts reached
      console.error("Meta CAPI error:", metaResult);

      const failContactId = is_test ? await getFirstContactId(supabase, tenant_id) : contact_id;
      if (failContactId) {
        await supabase.from("conversion_event_logs").insert({
          tenant_id,
          contact_id: failContactId,
          source: "META_CAPI",
          pipeline_stage: custom_data.pipeline_stage as string || null,
          event_name,
          status: "FAILED",
          payload: { event_data: eventData, meta_response: metaResult, attempts: attempt, is_test: true },
          error_message: (metaResult! as { error?: { message?: string } }).error?.message || "Unknown Meta API error",
          event_id: event_id || null,
        });
      }

      throw new Error((metaResult! as { error?: { message?: string } }).error?.message || "Meta CAPI request failed");
    }

    console.log("Meta CAPI success:", metaResult!);

    // Log the successful event - for test events, find a real contact or skip FK
    const logContactId = is_test ? await getFirstContactId(supabase, tenant_id) : contact_id;
    if (logContactId) {
      const { error: logError } = await supabase.from("conversion_event_logs").insert({
        tenant_id,
        contact_id: logContactId,
        source: "META_CAPI",
        pipeline_stage: custom_data.pipeline_stage as string || null,
        event_name,
        status: "SENT",
        payload: { event_data: eventData, meta_response: metaResult!, attempts: attempt, is_test: is_test || false },
        event_id: event_id || null,
      });
      if (logError) {
        console.error("Error logging conversion event:", logError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, result: metaResult! }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in meta-capi-track:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getFirstContactId(supabase: ReturnType<typeof createClient>, tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  return data?.id || null;
}
