import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, reason, comment } = await req.json();

    if (!tenant_id || !reason) {
      return new Response(
        JSON.stringify({ error: "tenant_id and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing cancellation for tenant: ${tenant_id}, reason: ${reason}`);

    // Get tenant data
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("stripe_subscription_id, current_period_end, plan, name")
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
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owner email for this tenant
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .limit(1)
      .single();

    const ownerEmail = ownerProfile?.email;
    const ownerName = ownerProfile?.name || "Cliente";

    // Cancel subscription at period end
    console.log(`Canceling subscription ${tenant.stripe_subscription_id} at period end`);
    await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update tenant with cancellation info and clear pending plan changes
    const { error: updateError } = await supabase
      .from("tenants")
      .update({
        subscription_status: "cancel_pending",
        cancellation_reason: reason,
        cancellation_comment: comment || null,
        cancellation_requested_at: new Date().toISOString(),
        // Clear any pending plan changes since subscription is being canceled
        pending_plan: null,
        pending_stripe_price_id: null,
        pending_plan_effective_at: null,
      })
      .eq("id", tenant_id);

    if (updateError) {
      console.error("Error updating tenant:", updateError);
      throw updateError;
    }

    // Send email notifications
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const periodEnd = tenant.current_period_end
        ? new Date(tenant.current_period_end).toLocaleDateString("es-MX", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A";

      // Email to customer
      if (ownerEmail) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "NotyFive <no-reply@notifications.notyfive.com>",
              to: [ownerEmail],
              subject: "Confirmación de cancelación de suscripción",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #333;">Hola ${ownerName},</h2>
                  <p>Hemos recibido tu solicitud de cancelación de suscripción.</p>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Plan:</strong> ${tenant.plan || "N/A"}</p>
                    <p style="margin: 5px 0;"><strong>Servicio activo hasta:</strong> ${periodEnd}</p>
                  </div>
                  <p>Tu servicio seguirá funcionando normalmente hasta el final del periodo de facturación actual. No perderás acceso a tus datos ni créditos restantes.</p>
                  <p style="color: #666; font-size: 14px;">Si cambias de opinión, puedes reactivar tu suscripción en cualquier momento desde la sección de Facturación en tu cuenta.</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                  <p style="color: #888; font-size: 12px;">¿Tienes preguntas? Responde a este correo o contáctanos en soporte@notyfive.com</p>
                  <p style="color: #888; font-size: 12px;">- El equipo de NotyFive</p>
                </div>
              `,
            }),
          });
          console.log("Customer cancellation email sent to:", ownerEmail);
        } catch (emailError) {
          console.error("Failed to send customer email:", emailError);
        }
      }

      // Email to admin (CSM)
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "NotyFive Alerts <alerts@notifications.notyfive.com>",
            to: ["roberto@notyfive.com"],
            subject: `⚠️ Cancelación: ${tenant.name || tenant_id}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #e74c3c;">🚨 Solicitud de Cancelación</h2>
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <p style="margin: 5px 0;"><strong>Empresa:</strong> ${tenant.name || "N/A"}</p>
                  <p style="margin: 5px 0;"><strong>Plan:</strong> ${tenant.plan || "N/A"}</p>
                  <p style="margin: 5px 0;"><strong>Contacto:</strong> ${ownerEmail || "N/A"}</p>
                </div>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Razón:</strong> ${reason}</p>
                  <p style="margin: 5px 0;"><strong>Comentario:</strong> ${comment || "Sin comentarios adicionales"}</p>
                </div>
                <p><strong>Fin del servicio:</strong> ${periodEnd}</p>
                <p style="color: #666; font-size: 14px;">Tenant ID: ${tenant_id}</p>
              </div>
            `,
          }),
        });
        console.log("Admin notification email sent");
      } catch (emailError) {
        console.error("Failed to send admin notification:", emailError);
      }
    }

    console.log(`Cancellation processed successfully for tenant: ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Subscription will be canceled at end of billing period",
        period_end: tenant.current_period_end 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing cancellation:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
