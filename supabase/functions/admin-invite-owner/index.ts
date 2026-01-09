import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteOwnerRequest {
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
}

interface ResendInviteRequest {
  userId: string;
}

// Email template for owner invitation
const getInviteEmailHtml = (ownerName: string, activationLink: string, logoUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta de NotyFive</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 0; text-align: center;">
              <img src="${logoUrl}" alt="NotyFive Logo" style="width: 72px; height: 72px; margin: 0 auto 16px; display: block; border-radius: 16px;" />
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #18181b;">¡Bienvenido a NotyFive!</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 24px 32px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hola <strong>${ownerName}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Tu cuenta de administrador ha sido creada. Para comenzar a usar la plataforma, necesitas establecer tu contraseña de acceso.
              </p>
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${activationLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);">
                      Activar cuenta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: #71717a;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.4; color: #a1a1aa; word-break: break-all;">
                ${activationLink}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                Este enlace expirará en 24 horas. Si no solicitaste esta cuenta, puedes ignorar este correo.
              </p>
              <p style="margin: 16px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} NotyFive. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Send email via Resend API
async function sendInviteEmail(
  email: string,
  name: string,
  activationLink: string,
  logoUrl: string,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "NotyFive <no-reply@resend.dev>";

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Activa tu cuenta de NotyFive",
        html: getInviteEmailHtml(name, activationLink, logoUrl),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    console.log("Email sent successfully:", data);
    return { success: true, emailId: data?.id };
  } catch (err: any) {
    console.error("Error sending email:", err);
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get the authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify the user is a super_admin
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    console.error("Auth error:", authError);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check if user is super_admin
  const { data: userRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("global_role")
    .eq("user_id", user.id)
    .single();

  if (roleError || userRole?.global_role !== "super_admin") {
    console.error("Role check failed:", roleError, userRole);
    return new Response(JSON.stringify({ error: "Only super_admin can perform this action" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    if (path === "invite" || !path || path === "admin-invite-owner") {
      // Create new owner with invite
      const { tenantId, ownerEmail, ownerName }: InviteOwnerRequest = await req.json();

      if (!tenantId || !ownerEmail || !ownerName) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Creating owner for tenant ${tenantId}: ${ownerEmail}`);

      // Find existing user by email (idempotency)
      // NOTE: listUsers is paginated; if you have many users, consider switching to a direct lookup strategy.
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.error("Error listing users:", listError);
        return new Response(JSON.stringify({ error: "Error validating existing users" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingUser = existingUsers?.users?.find((u) => u.email === ownerEmail);

      let userId: string;
      let createdNewAuthUser = false;

      if (existingUser) {
        userId = existingUser.id;
        console.log(`User already exists for email ${ownerEmail}: ${userId}. Continuing idempotently.`);
      } else {
        // Create user without password using Admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: ownerEmail,
          email_confirm: true, // Mark email as confirmed since admin is creating
          user_metadata: {
            name: ownerName,
            tenant_id: tenantId,
            role_hint: "owner",
          },
        });

        if (createError || !newUser?.user) {
          console.error("Error creating user:", createError);
          return new Response(JSON.stringify({ error: createError?.message || "Error creating user" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = newUser.user.id;
        createdNewAuthUser = true;
        console.log(`User created: ${userId}`);
      }

      // Upsert profile with inactive status (idempotent)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: userId,
            tenant_id: tenantId,
            name: ownerName,
            email: ownerEmail,
            status: "inactive",
            first_login_required: true,
            invited_at: new Date().toISOString(),
            invited_by: user.id,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error("Error creating profile:", profileError);
        // Only rollback auth user if we created it in this request
        if (createdNewAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        return new Response(JSON.stringify({ error: "Error creating profile" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure user_roles entry exists (idempotent)
      const { error: roleUpsertError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          {
            user_id: userId,
            global_role: "user",
            tenant_role: "owner",
          },
          { onConflict: "user_id" }
        );

      if (roleUpsertError) {
        console.error("Error creating role:", roleUpsertError);
        // Rollback (best-effort)
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        if (createdNewAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        return new Response(JSON.stringify({ error: "Error creating user role" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate invite link (password recovery link)
      // Prefer the request origin (preview/deployed URL) so the redirect goes to the correct environment.
      const requestOrigin = req.headers.get("origin");
      const appBaseUrl = requestOrigin || Deno.env.get("APP_BASE_URL") || "https://notyfive-app-demo.lovable.app";
      const redirectUrl = `${appBaseUrl}/auth/complete-signup`;

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: ownerEmail,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (linkError || !linkData?.properties?.action_link) {
        console.error("Error generating invite link:", linkError);
        // Don't rollback - user is created, admin can resend invite
        return new Response(JSON.stringify({ 
          success: true,
          userId,
          message: "Owner created but email could not be sent. Use resend invite.",
          emailSent: false,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const activationLink = linkData.properties.action_link;
      // Always use APP_BASE_URL for the logo to ensure it's accessible from email clients
      const productionUrl = Deno.env.get("APP_BASE_URL") || appBaseUrl;
      const logoUrl = `${productionUrl}/email-logo.png`;

      // Send email via Resend
      const emailResult = await sendInviteEmail(ownerEmail, ownerName, activationLink, logoUrl);

      if (!emailResult.success) {
        console.error("Failed to send email:", emailResult.error);
        // Don't rollback - user is created, admin can resend invite
      }

      // Log security event
      await supabaseAdmin.from("security_events").insert({
        event_type: "tenant_owner_invited",
        user_id: user.id,
        tenant_id: tenantId,
        metadata: { 
          invited_email: ownerEmail,
          invited_user_id: userId,
          email_sent: emailResult.success,
        },
      });

      console.log(`Owner invited successfully: ${ownerEmail}, email sent: ${emailResult.success}`);

      return new Response(JSON.stringify({ 
        success: true,
        userId,
        message: emailResult.success 
          ? "Owner created and invite email sent" 
          : "Owner created but email failed. Use resend invite.",
        emailSent: emailResult.success,
        emailId: emailResult.emailId ?? null,
        activationLink: linkData.properties.action_link,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (path === "resend") {
      // Resend invite to existing user
      const { userId }: ResendInviteRequest = await req.json();

      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limiting: max 3 resends per user per hour
      const RATE_LIMIT_WINDOW_MINUTES = 60;
      const RATE_LIMIT_MAX_RESENDS = 3;
      
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
      
      const { count: recentResends, error: rateLimitError } = await supabaseAdmin
        .from("security_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "tenant_owner_invite_resent")
        .eq("metadata->>resent_to_user_id", userId)
        .gte("created_at", windowStart);

      if (rateLimitError) {
        console.error("Rate limit check error:", rateLimitError);
      }

      if ((recentResends ?? 0) >= RATE_LIMIT_MAX_RESENDS) {
        console.warn(`Rate limit exceeded for resend to user ${userId}. Count: ${recentResends}`);
        
        // Log the blocked attempt
        await supabaseAdmin.from("security_events").insert({
          event_type: "invite_resend_rate_limited",
          user_id: user.id,
          metadata: {
            target_user_id: userId,
            attempts_in_window: recentResends,
            window_minutes: RATE_LIMIT_WINDOW_MINUTES,
          },
        });

        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please wait before resending.",
          retryAfterMinutes: RATE_LIMIT_WINDOW_MINUTES,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email, name, tenant_id, status, first_login_required")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (profile.status === "active" && !profile.first_login_required) {
        return new Response(JSON.stringify({ error: "User already activated" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate new invite link
      // Prefer the request origin (preview/deployed URL) so the redirect goes to the correct environment.
      const requestOrigin = req.headers.get("origin");
      const appBaseUrl = requestOrigin || Deno.env.get("APP_BASE_URL") || "https://notyfive-app-demo.lovable.app";
      const redirectUrl = `${appBaseUrl}/auth/complete-signup`;

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: profile.email,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (linkError || !linkData?.properties?.action_link) {
        console.error("Error generating invite link:", linkError);
        return new Response(JSON.stringify({ error: "Error generating invite link" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const activationLink = linkData.properties.action_link;
      // Always use APP_BASE_URL for the logo to ensure it's accessible from email clients
      const productionUrl = Deno.env.get("APP_BASE_URL") || appBaseUrl;
      const logoUrl = `${productionUrl}/email-logo.png`;

      // Send email via Resend
      const emailResult = await sendInviteEmail(profile.email, profile.name || "Usuario", activationLink, logoUrl);

      if (!emailResult.success) {
        console.error("Failed to send email:", emailResult.error);
        return new Response(JSON.stringify({ error: "Error sending email: " + emailResult.error }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update invited_at
      await supabaseAdmin
        .from("profiles")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", userId);

      // Log security event
      await supabaseAdmin.from("security_events").insert({
        event_type: "tenant_owner_invite_resent",
        user_id: user.id,
        tenant_id: profile.tenant_id,
        metadata: { 
          resent_to_email: profile.email,
          resent_to_user_id: userId,
        },
      });

      console.log(`Invite resent to: ${profile.email}`);

      return new Response(JSON.stringify({ 
        success: true,
        message: "Invite email resent successfully",
        emailId: emailResult.emailId ?? null,
        activationLink: linkData.properties.action_link,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in admin-invite-owner:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
