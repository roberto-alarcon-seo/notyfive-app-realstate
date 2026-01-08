import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Get auth token from request
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const { currentPassword, newPassword }: ChangePasswordBody = await req.json();

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Se requieren ambas contraseñas" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate new password policy
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: "La nueva contraseña no cumple con los requisitos de seguridad" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get current user from auth header
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify current password by attempting sign in
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      console.log("Invalid current password for user:", user.id);
      return new Response(
        JSON.stringify({ error: "La contraseña actual no es correcta" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update password using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return new Response(
        JSON.stringify({ error: "No fue posible actualizar la contraseña" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile for tenant_id
    const { data: profile } = await adminClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    // Log security event
    await adminClient.from('security_events').insert({
      tenant_id: profile?.tenant_id || null,
      user_id: user.id,
      event_type: 'PASSWORD_CHANGED',
      metadata: { method: 'user_change' },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Send confirmation email
    const confirmationHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #0f0f12;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background-color: #1a1a1f; border-radius: 16px; border: 1px solid #2a2a2f;">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <div style="margin-bottom: 32px;">
                <span style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">NotyFive</span>
              </div>
              
              <h1 style="margin: 0 0 16px; color: #ffffff; font-size: 24px; font-weight: 600;">
                Tu contraseña fue actualizada
              </h1>
              
              <p style="margin: 0 0 8px; color: #a1a1aa; font-size: 15px; line-height: 1.6;">
                Tu contraseña fue cambiada correctamente el <strong style="color: #ffffff;">${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</strong> a las <strong style="color: #ffffff;">${new Date().toLocaleTimeString('es-MX', { timeStyle: 'short' })}</strong>.
              </p>
              
              <div style="margin-top: 32px; padding: 16px; background-color: #27272a; border-radius: 8px;">
                <p style="margin: 0; color: #fbbf24; font-size: 14px;">
                  ⚠️ Si no fuiste tú quien realizó este cambio, contacta a soporte de inmediato.
                </p>
              </div>
            </td>
          </tr>
        </table>
        
        <p style="margin-top: 24px; text-align: center; color: #52525b; font-size: 12px;">
          © ${new Date().getFullYear()} NotyFive. Todos los derechos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
      from: "NotyFive <no-reply@notifications.notyfive.com>",
      to: [user.email!],
      subject: "Tu contraseña fue actualizada – NotyFive",
      html: confirmationHtml,
    });

    console.log("Password changed successfully for user:", user.id);

    return new Response(
      JSON.stringify({ success: true, message: "Contraseña actualizada correctamente" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in auth-change-password function:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
