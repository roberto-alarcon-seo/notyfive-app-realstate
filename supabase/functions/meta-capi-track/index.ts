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
    const { tenant_id, contact_id, event_name, event_type, custom_data, user_data } = body;

    // Fetch tenant settings to get access token and pixel ID
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

    // Get client IP and user agent from request headers
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     user_data.client_ip_address;
    const clientUserAgent = req.headers.get("user-agent") || user_data.client_user_agent;

    // Prepare user data for Meta
    const hashedUserData: Record<string, string> = {};

    if (user_data.email) {
      hashedUserData.em = await hashValue(user_data.email.toLowerCase().trim());
    }
    if (user_data.phone) {
      // Normalize phone number (remove non-numeric except +)
      const normalizedPhone = user_data.phone.replace(/[^\d+]/g, "");
      hashedUserData.ph = await hashValue(normalizedPhone);
    }
    if (user_data.external_id) {
      hashedUserData.external_id = await hashValue(user_data.external_id);
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

    // Prepare event data
    const eventTime = Math.floor(Date.now() / 1000);
    const eventData = {
      event_name: event_name,
      event_time: eventTime,
      action_source: "system_generated",
      user_data: hashedUserData,
      custom_data: custom_data,
    };

    // Build request payload
    const payload: Record<string, unknown> = {
      data: [eventData],
    };

    // Add test event code if configured
    if (settings.meta_test_event_code) {
      payload.test_event_code = settings.meta_test_event_code;
    }

    // Send to Meta Conversions API
    const metaUrl = `https://graph.facebook.com/v18.0/${settings.meta_pixel_id}/events`;
    const metaResponse = await fetch(`${metaUrl}?access_token=${settings.meta_capi_access_token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta CAPI error:", metaResult);
      
      // Log the failed event
      await supabase.from("conversion_event_logs").insert({
        tenant_id,
        contact_id,
        source: "META_CAPI",
        pipeline_stage: custom_data.pipeline_stage as string,
        event_name,
        status: "FAILED",
        payload: { event_data: eventData, meta_response: metaResult },
        error_message: metaResult.error?.message || "Unknown Meta API error",
      });

      throw new Error(metaResult.error?.message || "Meta CAPI request failed");
    }

    console.log("Meta CAPI success:", metaResult);

    // Log the successful event
    await supabase.from("conversion_event_logs").insert({
      tenant_id,
      contact_id,
      source: "META_CAPI",
      pipeline_stage: custom_data.pipeline_stage as string,
      event_name,
      status: "SENT",
      payload: { event_data: eventData, meta_response: metaResult },
    });

    return new Response(
      JSON.stringify({ success: true, result: metaResult }),
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

// Hash function for user data (SHA-256)
async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
