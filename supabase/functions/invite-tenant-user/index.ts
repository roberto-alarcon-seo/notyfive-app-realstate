import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  name: string;
  password: string;
  tenantRole: "administrador" | "manager" | "asesor";
}

// Email template for user invitation
const getInviteEmailHtml = (userName: string, activationLink: string, logoUrl: string, tenantRole: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta de Brokia</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 32px 32px 0; text-align: center;">
              <img src="${logoUrl}" alt="Brokia Logo" style="width: 72px; height: 72px; margin: 0 auto 16px; display: block; border-radius: 16px;" />
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #18181b;">¡Bienvenido a Brokia!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hola <strong>${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Tu cuenta de ${tenantRole} ha sido creada. Para comenzar a usar la plataforma, necesitas activar tu cuenta y establecer tu contraseña.
              </p>
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
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                Este enlace expirará en 24 horas.
              </p>
              <p style="margin: 16px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} Brokia. Todos los derechos reservados.
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
  tenantRole: string,
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Brokia <no-reply@resend.dev>";

  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured, skipping email");
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
        subject: "Activa tu cuenta de Brokia",
        html: getInviteEmailHtml(name, activationLink, logoUrl, tenantRole),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error("Resend API error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error sending email:", err);
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Verify authorization
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get caller's profile and role
  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !callerProfile?.tenant_id) {
    return new Response(JSON.stringify({ error: "Caller profile not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: callerRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("global_role, tenant_role")
    .eq("user_id", user.id)
    .single();

  if (roleError) {
    return new Response(JSON.stringify({ error: "Caller role not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only administrador (or super_admin) can create users
  const isAdmin = callerRole.global_role === "super_admin" || 
                  callerRole.tenant_role === "administrador" ||
                  callerRole.tenant_role === "owner"; // legacy support
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Only administrators can create users" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, name, password, tenantRole }: InviteUserRequest = await req.json();

    if (!email || !name || !password || !tenantRole) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role
    const validRoles = ["administrador", "manager", "asesor"];
    if (!validRoles.includes(tenantRole)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = callerProfile.tenant_id;

    // Check tenant user limits (every profile counts as a seat, including admins/owners).
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("max_users")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: currentUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if ((currentUsers ?? 0) >= (tenant.max_users ?? 0)) {
      return new Response(JSON.stringify({
        error: "Has alcanzado el límite de usuarios. Actualiza tu plan para agregar más.",
        code: "USER_LIMIT_REACHED",
        max_users: tenant.max_users,
        current_users: currentUsers ?? 0,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating user for tenant ${tenantId}: ${email} with role ${tenantRole}`);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    if (existingUser) {
      return new Response(JSON.stringify({ error: "Este email ya está registrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with password using Admin API (doesn't affect caller's session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        tenant_id: tenantId,
        global_role: "user",
        tenant_role: tenantRole,
      },
    });

    if (createError || !newUser?.user) {
      console.error("Error creating user:", createError);
      return new Response(JSON.stringify({ error: createError?.message || "Error creating user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;
    console.log(`Auth user created: ${userId}`);

    // The trigger handle_new_user should create profile and role, but let's upsert to be safe
    const { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        tenant_id: tenantId,
        name,
        email,
        status: "inactive",
        first_login_required: true,
        invited_at: new Date().toISOString(),
        invited_by: user.id,
      }, { onConflict: "id" });

    if (profileUpsertError) {
      console.error("Error upserting profile:", profileUpsertError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Error creating user profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: roleUpsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        global_role: "user",
        tenant_role: tenantRole,
      }, { onConflict: "user_id" });

    if (roleUpsertError) {
      console.error("Error upserting role:", roleUpsertError);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Error creating user role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate activation link
    const requestOrigin = req.headers.get("origin");
    const appBaseUrl = requestOrigin || Deno.env.get("APP_BASE_URL") || "https://notyfive-app-demo.lovable.app";
    const redirectUrl = `${appBaseUrl}/auth/complete-signup`;

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectUrl },
    });

    // Try to send email (optional - user can login with password)
    const productionUrl = (Deno.env.get("APP_BASE_URL") || appBaseUrl).replace(/\/+$/, "");
    const logoUrl = `${productionUrl}/email-logo.png`;
    const roleLabel = tenantRole === "administrador" ? "Administrador" : 
                      tenantRole === "manager" ? "Manager" : "Asesor";
    
    if (linkData?.properties?.action_link) {
      await sendInviteEmail(email, name, linkData.properties.action_link, logoUrl, roleLabel);
    }

    // Log security event
    await supabaseAdmin.from("security_events").insert({
      event_type: "tenant_user_created",
      user_id: user.id,
      tenant_id: tenantId,
      metadata: {
        created_email: email,
        created_user_id: userId,
        role: tenantRole,
      },
    });

    console.log(`User created successfully: ${email}`);

    return new Response(JSON.stringify({ 
      success: true,
      userId,
      message: "Usuario creado correctamente",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in invite-tenant-user:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
