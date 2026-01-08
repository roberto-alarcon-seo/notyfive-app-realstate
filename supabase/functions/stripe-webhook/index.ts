import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get credits for a plan
function getPlanCredits(plan: string): number {
  const credits: Record<string, number> = {
    trial: 100,
    starter: 1000,
    growth: 3000,
    pro: 6000,
    scale: 12000,
    enterprise: 25000,
  };
  return credits[plan] || 0;
}

// Map Stripe price ID to plan name
function getPlanFromPriceId(priceId: string): string | null {
  const priceStarter = Deno.env.get("STRIPE_PRICE_STARTER");
  const priceGrowth = Deno.env.get("STRIPE_PRICE_GROWTH");
  const pricePro = Deno.env.get("STRIPE_PRICE_PRO");
  const priceScale = Deno.env.get("STRIPE_PRICE_SCALE");

  if (priceId === priceStarter) return "starter";
  if (priceId === priceGrowth) return "growth";
  if (priceId === pricePro) return "pro";
  if (priceId === priceScale) return "scale";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("No Stripe signature found");
      return new Response("No signature", { status: 400 });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    
    let event: Stripe.Event;
    try {
      // Use constructEventAsync for Deno environment
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errMessage);
      return new Response(`Webhook Error: ${errMessage}`, { status: 400 });
    }

    console.log(`Received Stripe event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Processing checkout.session.completed");

        const tenantId = session.metadata?.tenant_id;

        if (!tenantId) {
          console.error("No tenant_id in session metadata");
          break;
        }

        // Handle CREDIT PACK purchases (one-time payments)
        if (session.mode === "payment" && session.metadata?.type === "credit_pack") {
          console.log("Processing credit pack purchase");
          
          const pack = Number(session.metadata.pack);
          const idempotencyKey = `stripe:credit_pack:${session.id}`;
          
          // Verify payment was successful
          if (session.payment_status !== "paid") {
            console.log(`Credit pack session ${session.id} not paid yet, skipping`);
            break;
          }
          
          // Add extra credits using the new function
          const { data: addResult, error: addError } = await supabaseAdmin.rpc(
            "fn_add_extra_credits",
            {
              p_tenant_id: tenantId,
              p_amount: pack,
              p_reason: "credit_pack_purchase",
              p_source_table: "stripe.checkout",
              p_source_id: null,
              p_idempotency_key: idempotencyKey,
            }
          );

          if (addError) {
            console.error("Error adding extra credits:", addError);
          } else {
            console.log(`Credit pack ${pack} added for tenant ${tenantId}:`, addResult);
          }
          break;
        }

        // Handle SUBSCRIPTION checkouts
        const plan = session.metadata?.plan;
        const priceId = session.metadata?.price_id;

        // Get subscription details
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          const subscriptionPriceId = subscription.items.data[0]?.price?.id || priceId;
          const resolvedPlan = plan || getPlanFromPriceId(subscriptionPriceId || "") || "starter";

          console.log(`Updating tenant ${tenantId}: plan=${resolvedPlan}, subscription=${subscriptionId}`);

          // Update tenant with Stripe info
          const { error: updateError } = await supabaseAdmin
            .from("tenants")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: subscriptionPriceId,
              subscription_status: subscription.status,
              current_period_end: currentPeriodEnd.toISOString(),
              plan: resolvedPlan,
              next_refill_at: currentPeriodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", tenantId);

          if (updateError) {
            console.error("Error updating tenant:", updateError);
          } else {
            console.log(`Tenant ${tenantId} updated with subscription ${subscriptionId}`);
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Processing invoice.paid");

        const customerId = invoice.customer as string;
        const invoiceId = invoice.id;
        const subscriptionId = invoice.subscription as string;

        // Get paid_at timestamp
        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(invoice.created * 1000);

        // Find tenant by stripe_customer_id
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from("tenants")
          .select("id, plan, last_invoice_id, monthly_credits_remaining, accumulated_credits, message_credits, billing_state, pending_plan, pending_stripe_price_id, pending_plan_effective_at")
          .eq("stripe_customer_id", customerId)
          .single();

        if (tenantError || !tenant) {
          console.error("Tenant not found for customer:", customerId);
          break;
        }

        // Idempotency check
        if (tenant.last_invoice_id === invoiceId) {
          console.log(`Invoice ${invoiceId} already processed for tenant ${tenant.id}`);
          break;
        }

        console.log(`Processing invoice ${invoiceId} for tenant ${tenant.id}`);

        // ========================================
        // APPLY PENDING PLAN CHANGE (DOWNGRADE) BEFORE REFILL
        // ========================================
        let effectivePlan = tenant.plan;
        
        if (tenant.pending_plan && tenant.pending_plan_effective_at) {
          const pendingEffectiveAt = new Date(tenant.pending_plan_effective_at);
          const now = new Date();
          
          // Apply pending plan if effective date has passed or is now
          if (pendingEffectiveAt <= now) {
            console.log(`Applying pending plan change: ${tenant.plan} -> ${tenant.pending_plan}`);
            effectivePlan = tenant.pending_plan;
            
            // Update tenant with new plan and clear pending fields
            await supabaseAdmin
              .from("tenants")
              .update({
                plan: tenant.pending_plan,
                stripe_price_id: tenant.pending_stripe_price_id,
                pending_plan: null,
                pending_stripe_price_id: null,
                pending_plan_effective_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", tenant.id);
            
            console.log(`Plan changed to ${effectivePlan} for tenant ${tenant.id}`);
          }
        }
        // ========================================

        // Get period end from invoice line items or subscription
        let periodEnd: Date | null = null;
        if (invoice.lines?.data?.[0]?.period?.end) {
          periodEnd = new Date(invoice.lines.data[0].period.end * 1000);
        } else if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = new Date(subscription.current_period_end * 1000);
        }

        // Guard against invalid dates
        if (periodEnd && Number.isNaN(periodEnd.getTime())) {
          console.warn("Invalid periodEnd detected; falling back to invoiceId", {
            invoiceId,
            subscriptionId,
          });
          periodEnd = null;
        }

        // Build idempotency key
        const cycleId = `${tenant.id}:${periodEnd ? periodEnd.toISOString() : invoiceId}`;

        // Call refill function (will use the updated plan from tenant table)
        const { data: refillResult, error: refillError } = await supabaseAdmin.rpc(
          "fn_refill_monthly_credits",
          {
            p_tenant_id: tenant.id,
            p_refill_at: paidAt.toISOString(),
            p_idempotency_key: cycleId,
          }
        );

        if (refillError) {
          console.error("Error refilling credits:", refillError);
        } else {
          console.log(`Credits refilled for tenant ${tenant.id}:`, refillResult);
        }

        // Update tenant with invoice info and subscription status
        const updateData: Record<string, unknown> = {
          last_invoice_id: invoiceId,
          last_payment_at: paidAt.toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (periodEnd) {
          updateData.current_period_end = periodEnd.toISOString();
          updateData.next_refill_at = periodEnd.toISOString();
        }

        // Set billing state to SUBSCRIBED_ACTIVE after successful payment
        updateData.billing_state = "SUBSCRIBED_ACTIVE";
        updateData.subscription_status = "active";

        await supabaseAdmin
          .from("tenants")
          .update(updateData)
          .eq("id", tenant.id);

        console.log(`Invoice ${invoiceId} processed, credits refilled for tenant ${tenant.id}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Processing customer.subscription.updated");

        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price?.id;
        const newPlan = getPlanFromPriceId(priceId || "");

        // Find tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from("tenants")
          .select("id, plan, subscription_status")
          .eq("stripe_customer_id", customerId)
          .single();

        if (tenantError || !tenant) {
          console.error("Tenant not found for customer:", customerId);
          break;
        }

        const periodEndSec = (subscription as any).current_period_end as number | undefined;
        const periodEndDate = typeof periodEndSec === "number" ? new Date(periodEndSec * 1000) : null;

        const updateData: Record<string, unknown> = {
          stripe_price_id: priceId,
          updated_at: new Date().toISOString(),
        };

        // Only update subscription_status if it's NOT cancel_pending
        // This preserves our local cancellation state until the subscription actually ends
        if (tenant.subscription_status !== "cancel_pending") {
          updateData.subscription_status = subscription.status;
        } else {
          console.log(`Preserving cancel_pending status for tenant ${tenant.id}`);
        }

        if (periodEndDate && !Number.isNaN(periodEndDate.getTime())) {
          updateData.current_period_end = periodEndDate.toISOString();
        } else {
          console.warn("customer.subscription.updated missing/invalid current_period_end", {
            customerId,
            subscriptionId: subscription.id,
          });
        }

        // Update plan if changed (credits will be applied on next invoice.paid)
        if (newPlan && newPlan !== tenant.plan) {
          console.log(`Plan changed from ${tenant.plan} to ${newPlan}`);
          updateData.plan = newPlan;
        }

        await supabaseAdmin
          .from("tenants")
          .update(updateData)
          .eq("id", tenant.id);

        console.log(`Subscription updated for tenant ${tenant.id}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Processing customer.subscription.deleted");

        const customerId = subscription.customer as string;

        // Find tenant
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id, message_credits")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!tenant) {
          console.error("Tenant not found for customer:", customerId);
          break;
        }

        // Update subscription status but keep credits
        const updateData: Record<string, unknown> = {
          subscription_status: "canceled",
          updated_at: new Date().toISOString(),
        };

        // If still has credits, change to ACTIVE_WITH_CREDITS, otherwise CREDITS_EXHAUSTED
        if (tenant.message_credits > 0) {
          updateData.billing_state = "ACTIVE_WITH_CREDITS";
        } else {
          updateData.billing_state = "CREDITS_EXHAUSTED";
        }

        await supabaseAdmin
          .from("tenants")
          .update(updateData)
          .eq("id", tenant.id);

        console.log(`Subscription canceled for tenant ${tenant.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
