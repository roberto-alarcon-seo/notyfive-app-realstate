import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate cryptographically secure random token
function generateToken(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface RequestResetBody {
  email: string;
  origin?: string;
}

interface VerifyResetBody {
  email: string;
  token: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    // ========== REQUEST RESET ==========
    if (action === "request" && req.method === "POST") {
      const { email, origin }: RequestResetBody = await req.json();

      if (!email || typeof email !== 'string') {
        return new Response(
          JSON.stringify({ success: true, message: "Si el correo está registrado, recibirás un enlace en unos minutos." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      console.log("Password reset requested for email:", normalizedEmail);

      // Rate limiting check - max 3 requests per email in 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: emailCount } = await supabase
        .from('password_resets')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
        .gte('created_at', fifteenMinutesAgo);

      if (emailCount && emailCount >= 3) {
        console.log("Rate limit exceeded for email:", normalizedEmail);
        // Still return success to prevent enumeration
        return new Response(
          JSON.stringify({ success: true, message: "Si el correo está registrado, recibirás un enlace en unos minutos." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if user exists
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (!user) {
        console.log("User not found for email:", normalizedEmail);
        // Return success anyway to prevent enumeration
        return new Response(
          JSON.stringify({ success: true, message: "Si el correo está registrado, recibirás un enlace en unos minutos." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get user profile for tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, tenant_id')
        .eq('id', user.id)
        .single();

      // Generate token and hash it
      const token = generateToken();
      const tokenHash = await hashToken(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      // Store the reset request
      await supabase.from('password_resets').insert({
        tenant_id: profile?.tenant_id || null,
        user_id: user.id,
        email: normalizedEmail,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Log security event
      await supabase.from('security_events').insert({
        tenant_id: profile?.tenant_id || null,
        user_id: user.id,
        event_type: 'PASSWORD_RESET_REQUESTED',
        metadata: { email: normalizedEmail },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      // Build reset link - use origin from request or fallback to env/default
      const appUrl = origin || Deno.env.get("APP_URL") || "https://notyfive.lovable.app";
      const resetLink = `${appUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

      // Send email via Resend
      const emailHtml = `
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
              <!-- Logo -->
              <div style="margin-bottom: 32px;">
                <span style="font-size: 28px; font-weight: 700; color: #8b5cf6;">NotyFive</span>
              </div>
              
              <!-- Title -->
              <h1 style="margin: 0 0 16px; color: #ffffff; font-size: 24px; font-weight: 600;">
                Restablece tu contraseña
              </h1>
              
              <!-- Body -->
              <p style="margin: 0 0 8px; color: #a1a1aa; font-size: 15px; line-height: 1.6;">
                Recibimos una solicitud para restablecer tu contraseña.
              </p>
              <p style="margin: 0 0 32px; color: #a1a1aa; font-size: 15px; line-height: 1.6;">
                Este enlace expira en <strong style="color: #ffffff;">30 minutos</strong>.
              </p>
              
              <!-- CTA Button -->
              <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                Crear nueva contraseña
              </a>
              
              <!-- Fallback link -->
              <p style="margin: 24px 0 0; color: #71717a; font-size: 13px;">
                O copia este enlace en tu navegador:
              </p>
              <p style="margin: 8px 0 0; word-break: break-all; color: #8b5cf6; font-size: 12px;">
                ${resetLink}
              </p>
              
              <!-- Security note -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #2a2a2f;">
                <p style="margin: 0; color: #71717a; font-size: 13px;">
                  Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
                </p>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
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
        to: [normalizedEmail],
        subject: "Restablece tu contraseña – NotyFive",
        html: emailHtml,
      });

      console.log("Password reset email sent to:", normalizedEmail);

      return new Response(
        JSON.stringify({ success: true, message: "Si el correo está registrado, recibirás un enlace en unos minutos." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== VERIFY RESET ==========
    if (action === "verify" && req.method === "POST") {
      const { email, token, newPassword }: VerifyResetBody = await req.json();

      if (!email || !token || !newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Datos incompletos" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      // Validate password policy
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return new Response(
          JSON.stringify({ success: false, error: "La contraseña no cumple con los requisitos de seguridad" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Hash the provided token
      const tokenHash = await hashToken(token);

      // Find valid reset record
      const { data: resetRecord, error: resetError } = await supabase
        .from('password_resets')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (resetError || !resetRecord) {
        console.log("Invalid or expired reset token for email:", normalizedEmail);
        return new Response(
          JSON.stringify({ success: false, error: "Este enlace expiró o ya fue utilizado" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        resetRecord.user_id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Failed to update password:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "No fue posible actualizar la contraseña" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark reset as used
      await supabase
        .from('password_resets')
        .update({ used_at: new Date().toISOString() })
        .eq('id', resetRecord.id);

      // Log security event
      await supabase.from('security_events').insert({
        tenant_id: resetRecord.tenant_id,
        user_id: resetRecord.user_id,
        event_type: 'PASSWORD_RESET_COMPLETED',
        metadata: { email: normalizedEmail },
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
                <span style="font-size: 28px; font-weight: 700; color: #8b5cf6;">NotyFive</span>
              </div>
              
              <h1 style="margin: 0 0 16px; color: #ffffff; font-size: 24px; font-weight: 600;">
                Tu contraseña fue actualizada
              </h1>
              
              <p style="margin: 0 0 8px; color: #a1a1aa; font-size: 15px; line-height: 1.6;">
                Tu contraseña fue actualizada correctamente el <strong style="color: #ffffff;">${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</strong> a las <strong style="color: #ffffff;">${new Date().toLocaleTimeString('es-MX', { timeStyle: 'short' })}</strong>.
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
        to: [normalizedEmail],
        subject: "Tu contraseña fue actualizada – NotyFive",
        html: confirmationHtml,
      });

      console.log("Password reset completed for:", normalizedEmail);

      return new Response(
        JSON.stringify({ success: true, message: "Contraseña actualizada correctamente" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in auth-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
