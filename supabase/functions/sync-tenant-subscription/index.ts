import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, stripe_customer_id, stripe_subscription_id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "Tenant has no Stripe customer ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tenant.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: "Subscription ID already exists",
          stripe_subscription_id: tenant.stripe_subscription_id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subscriptions from Stripe for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: tenant.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Try to get any subscription (including past_due, canceled, etc.)
      const allSubscriptions = await stripe.subscriptions.list({
        customer: tenant.stripe_customer_id,
        limit: 10,
      });

      if (allSubscriptions.data.length === 0) {
        return new Response(
          JSON.stringify({ error: "No subscriptions found for this customer in Stripe" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return info about found subscriptions
      return new Response(
        JSON.stringify({ 
          error: "No active subscription found",
          subscriptions: allSubscriptions.data.map((s: Stripe.Subscription) => ({
            id: s.id,
            status: s.status,
            created: new Date(s.created * 1000).toISOString(),
          }))
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Update tenant with subscription info
    const { error: updateError } = await supabaseAdmin
      .from("tenants")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        subscription_status: subscription.status,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant_id);

    if (updateError) {
      console.error("Error updating tenant:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update tenant", detail: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Synced subscription ${subscription.id} for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Subscription synced successfully",
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        subscription_status: subscription.status,
        current_period_end: currentPeriodEnd.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing subscription:", error);
    return new Response(
      JSON.stringify({ error: "sync_failed", detail: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
