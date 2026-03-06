import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimal Web Push implementation using Web Crypto API
async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@brokia24.com";

  // Use web-push compatible fetch
  const response = await fetch("https://web-push-codelab.glitch.me/api/send-push", {
    method: "POST",
    // This is a simplified approach — for production use the web-push lib
  });

  // Direct push to endpoint with JWT VAPID
  const jwtHeader = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" })).replace(/=/g, "");
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = btoa(JSON.stringify({
    aud: audience,
    exp: now + 86400,
    sub: vapidSubject,
  })).replace(/=/g, "");

  // For a proper implementation, we need to sign with ES256
  // Using a simplified approach: direct POST with VAPID headers
  const pushResponse = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
    },
    body: payload,
  });

  return pushResponse;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { tenant_id, title, body, url, badge_count } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all subscriptions for this tenant
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("tenant_id", tenant_id);

    if (error) throw error;

    const payload = JSON.stringify({
      title: title || "Nuevo lead recibido",
      body: body || "Tienes un nuevo cliente interesado en una propiedad",
      url: url || "/inbox",
      badge_count: badge_count || 1,
    });

    const results = [];
    for (const sub of subscriptions || []) {
      try {
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "TTL": "86400",
          },
          body: payload,
        });
        results.push({ endpoint: sub.endpoint, status: res.status });

        // Clean up expired subscriptions
        if (res.status === 404 || res.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      } catch (err) {
        results.push({ endpoint: sub.endpoint, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
