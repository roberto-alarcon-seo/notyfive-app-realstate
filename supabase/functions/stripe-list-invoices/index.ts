import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StripeInvoice {
  id: string;
  created: number;
  status: string | null;
  amount_due: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: number | null;
  period_end: number | null;
  lines?: {
    data?: Array<{ description: string | null }>;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's tenant
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant's stripe_customer_id
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", profile.tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error("Tenant error:", tenantError);
      return new Response(
        JSON.stringify({ error: "Tenant data not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant.stripe_customer_id) {
      console.log("No stripe_customer_id for tenant:", profile.tenant_id);
      return new Response(
        JSON.stringify({ invoices: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Fetch invoices from Stripe (subscriptions)
    console.log("Fetching invoices for customer:", tenant.stripe_customer_id);
    const stripeInvoices = await stripe.invoices.list({
      customer: tenant.stripe_customer_id,
      limit: 20,
    });

    // Fetch payment intents (one-time payments like credit packs)
    console.log("Fetching payment intents for customer:", tenant.stripe_customer_id);
    const paymentIntents = await stripe.paymentIntents.list({
      customer: tenant.stripe_customer_id,
      limit: 20,
    });

    // Get checkout sessions to get metadata for credit pack purchases
    const checkoutSessions = await stripe.checkout.sessions.list({
      customer: tenant.stripe_customer_id,
      limit: 50,
    });

    // Build a map of payment_intent -> session metadata
    const sessionMetadataMap = new Map<string, { description: string; pack: number }>();
    for (const session of checkoutSessions.data) {
      if (session.payment_intent && session.metadata?.type === "credit_pack") {
        const pack = parseInt(session.metadata.pack || "0", 10);
        sessionMetadataMap.set(session.payment_intent as string, {
          description: `Créditos adicionales (${pack} mensajes)`,
          pack,
        });
      }
    }

    // Normalize invoice data (subscriptions)
    const invoiceItems = stripeInvoices.data.map((inv: StripeInvoice) => {
      // Map status to Spanish label
      let status_label = "Desconocido";
      switch (inv.status) {
        case "paid":
          status_label = "Pagada";
          break;
        case "open":
        case "draft":
          status_label = "Pendiente";
          break;
        case "uncollectible":
          status_label = "Fallida";
          break;
        case "void":
          status_label = "Cancelada";
          break;
      }

      // Get primary line item description
      const description = inv.lines?.data?.[0]?.description || null;

      // Format total with currency
      const amount = (inv.amount_due || 0) / 100;
      const currency = (inv.currency || "usd").toUpperCase();
      const total = `${currency} ${amount.toFixed(2)}`;

      return {
        id: inv.id,
        type: "invoice" as const,
        created: inv.created,
        status: inv.status,
        status_label,
        total,
        description,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        period_start: inv.period_start || null,
        period_end: inv.period_end || null,
      };
    });

    // Normalize payment intents (one-time payments)
    const paymentItems = paymentIntents.data
      .filter((pi: { status: string; invoice: string | null }) => pi.status === "succeeded" && !pi.invoice)
      .map((pi: { id: string; created: number; amount: number; currency: string; latest_charge: string | null }) => {
        const metadata = sessionMetadataMap.get(pi.id);
        const amount = (pi.amount || 0) / 100;
        const currency = (pi.currency || "usd").toUpperCase();
        const total = `${currency} ${amount.toFixed(2)}`;

        return {
          id: pi.id,
          type: "payment" as const,
          created: pi.created,
          status: "succeeded",
          status_label: "Pagada",
          total,
          description: metadata?.description || "Compra de créditos adicionales",
          hosted_invoice_url: null,
          invoice_pdf: null,
          period_start: null,
          period_end: null,
        };
      });

    // Combine and sort by date (newest first)
    const allItems = [...invoiceItems, ...paymentItems].sort((a, b) => b.created - a.created);

    console.log(`Returning ${allItems.length} items (${invoiceItems.length} invoices, ${paymentItems.length} payments)`);
    return new Response(
      JSON.stringify({ invoices: allItems }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    console.error("Error in stripe-list-invoices:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
