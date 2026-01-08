import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map plan to Stripe price ID
function getPriceIdForPlan(plan: string): string | null {
  const priceMap: Record<string, string> = {
    starter: Deno.env.get("STRIPE_PRICE_STARTER") || "",
    growth: Deno.env.get("STRIPE_PRICE_GROWTH") || "",
    pro: Deno.env.get("STRIPE_PRICE_PRO") || "",
    scale: Deno.env.get("STRIPE_PRICE_SCALE") || "",
  };
  return priceMap[plan] || null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL");

    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe not configured");
    }

    // Prefer the caller origin (preview/custom domain) to avoid misconfigured APP_BASE_URL.
    const origin = req.headers.get("origin") ?? undefined;
    const referer = req.headers.get("referer") ?? undefined;
    const requestBaseUrl = origin
      ? origin
      : referer
        ? new URL(referer).origin
        : undefined;

    const baseUrl = requestBaseUrl ?? appBaseUrl;

    if (!baseUrl) {
      console.error("No base URL available (origin/referer/APP_BASE_URL)");
      throw new Error("App base URL not configured");
    }

    console.log(`Checkout baseUrl resolved to: ${baseUrl}`);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    // Parse request body
    const { tenant_id, plan } = await req.json();
    
    if (!tenant_id || !plan) {
      throw new Error("tenant_id and plan are required");
    }

    console.log(`Creating checkout session for tenant ${tenant_id}, plan: ${plan}`);

    // Get the price ID for the plan
    const priceId = getPriceIdForPlan(plan);
    if (!priceId) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    console.log(`Using price ID: ${priceId}`);

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, stripe_customer_id, plan, subscription_status")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error("Tenant error:", tenantError);
      throw new Error("Tenant not found");
    }

    // Get user email for Stripe customer
    const userEmail = user.email;

    let stripeCustomerId = tenant.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      console.log("Creating new Stripe customer");
      const customer = await stripe.customers.create({
        email: userEmail,
        name: tenant.name || undefined,
        metadata: {
          tenant_id: tenant_id,
        },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to tenant
      await supabaseAdmin
        .from("tenants")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", tenant_id);
      
      console.log(`Created Stripe customer: ${stripeCustomerId}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings/billing?success=1`,
      cancel_url: `${baseUrl}/settings/billing?canceled=1`,
      metadata: {
        tenant_id: tenant_id,
        plan: plan,
        price_id: priceId,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenant_id,
          plan: plan,
        },
      },
    });

    console.log(`Created checkout session: ${session.id}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
