import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendInviteEmail(email: string, name: string, link: string, logoUrl: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "NotyFive <no-reply@resend.dev>";
  if (!apiKey) return { success: false, error: "Email not configured" };

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f4f4f5;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <img src="${logoUrl}" alt="Logo" style="width:64px;height:64px;border-radius:12px;display:block;margin:0 auto 16px;" />
    <h1 style="font-size:22px;color:#18181b;text-align:center;margin:0 0 16px;">Acceso Super Admin</h1>
    <p style="color:#52525b;font-size:15px;line-height:1.6;">Hola <strong>${name}</strong>,</p>
    <p style="color:#52525b;font-size:15px;line-height:1.6;">Has sido invitado como Super Administrador. Establece tu contraseña para activar tu cuenta:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Activar cuenta</a>
    </p>
    <p style="color:#a1a1aa;font-size:12px;word-break:break-all;">${link}</p>
  </div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Acceso Super Admin", html }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: text };
  }
  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("global_role").eq("user_id", user.id).single();
    if (roleRow?.global_role !== "super_admin") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body?.action || "invite";

    if (action === "delete") {
      const userId = body?.userId;
      if (!userId) {
        return new Response(JSON.stringify({ success: false, error: "Missing userId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (userId === user.id) {
        return new Response(JSON.stringify({ success: false, error: "Cannot delete yourself" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verify target is super_admin
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles").select("global_role").eq("user_id", userId).single();
      if (targetRole?.global_role !== "super_admin") {
        return new Response(JSON.stringify({ success: false, error: "Target is not a super admin" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invite flow
    const { email, name, partnerScope } = body;
    if (!email || !name) {
      return new Response(JSON.stringify({ success: false, error: "Missing email or name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate partnerScope if provided
    let validatedPartnerScope: string | null = null;
    if (partnerScope && partnerScope !== "global") {
      const { data: partnerRow } = await supabaseAdmin
        .from("partners").select("id").eq("id", partnerScope).maybeSingle();
      if (!partnerRow) {
        return new Response(JSON.stringify({ success: false, error: "Invalid partner" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      validatedPartnerScope = partnerScope;
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;
    let createdNew = false;
    if (existing) {
      userId = existing.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { name, global_role: "super_admin" },
      });
      if (createError || !newUser?.user) {
        return new Response(JSON.stringify({ success: false, error: createError?.message || "Create failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = newUser.user.id;
      createdNew = true;
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId, tenant_id: null, name, email,
      status: "inactive", first_login_required: true,
      invited_at: new Date().toISOString(), invited_by: user.id,
    }, { onConflict: "id" });

    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId, global_role: "super_admin", tenant_role: null,
      partner_scope: validatedPartnerScope,
    }, { onConflict: "user_id" });

    const requestOrigin = req.headers.get("origin");
    const appBaseUrl = requestOrigin || Deno.env.get("APP_BASE_URL") || supabaseUrl;
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery", email,
      options: { redirectTo: `${appBaseUrl}/auth/complete-signup` },
    });

    let emailSent = false;
    if (linkData?.properties?.action_link) {
      const productionUrl = (Deno.env.get("APP_BASE_URL") || appBaseUrl).replace(/\/+$/, "");
      const result = await sendInviteEmail(email, name, linkData.properties.action_link, `${productionUrl}/email-logo.png`);
      emailSent = result.success;
    }

    await supabaseAdmin.from("security_events").insert({
      event_type: "super_admin_invited", user_id: user.id,
      metadata: { invited_email: email, invited_user_id: userId, email_sent: emailSent, created_new: createdNew },
    });

    return new Response(JSON.stringify({ success: true, userId, emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-invite-super-admin error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});