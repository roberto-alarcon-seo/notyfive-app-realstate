import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_ORDER = ["trial", "starter", "growth", "pro", "scale", "enterprise"];

function getDirection(currentPlan: string, targetPlan: string): "same" | "upgrade" | "downgrade" {
  const a = PLAN_ORDER.indexOf(currentPlan);
  const b = PLAN_ORDER.indexOf(targetPlan);
  if (a === -1 || b === -1 || a === b) return "same";
  return b > a ? "upgrade" : "downgrade";
}

// Get price ID from server-side secrets
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, target_plan } = await req.json();

    if (!tenant_id || !target_plan) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: tenant_id, target_plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve price ID on server side
    const target_price_id = getPriceIdForPlan(target_plan);
    if (!target_price_id) {
      return new Response(
        JSON.stringify({ error: `Invalid plan or price not configured: ${target_plan}` }),
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
      .select("id, plan, stripe_subscription_id, stripe_price_id, current_period_end")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error("Tenant not found:", tenantError);
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found. Please subscribe to a plan first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const direction = getDirection(tenant.plan, target_plan);

    if (direction === "same") {
      return new Response(
        JSON.stringify({ ok: true, direction: "same", message: "Already on this plan" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${direction} from ${tenant.plan} to ${target_plan}`);

    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
    const itemId = subscription.items.data?.[0]?.id;

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: "Subscription item not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // BOTH UPGRADE AND DOWNGRADE: Schedule change for end of billing cycle
    // This is the safest approach - no credits given until payment is confirmed
    console.log(`${direction}: Scheduling for end of billing cycle (no proration, no immediate credits)`);

    // Update subscription - change takes effect at end of billing period
    // Using proration_behavior: "none" means no proration charges
    const updated = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      items: [{ id: itemId, price: target_price_id }],
      proration_behavior: "none",
    });

    const effectiveAt = new Date(updated.current_period_end * 1000).toISOString();

    // Store pending plan info (actual plan change happens on invoice.paid via webhook)
    await supabaseAdmin.from("tenants").update({
      pending_plan: target_plan,
      pending_stripe_price_id: target_price_id,
      pending_plan_effective_at: effectiveAt,
      subscription_status: updated.status,
      current_period_end: effectiveAt,
      updated_at: new Date().toISOString(),
    }).eq("id", tenant_id);

    return new Response(
      JSON.stringify({
        ok: true,
        direction,
        effective: effectiveAt,
        pending_plan: target_plan,
        message: direction === "upgrade" 
          ? "Tu nuevo plan se activará en tu próxima renovación. Si necesitas más créditos ahora, puedes comprar créditos adicionales."
          : "Tu plan cambiará en tu próxima renovación.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating subscription plan:", error);
    return new Response(
      JSON.stringify({ error: "update_plan_failed", detail: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
