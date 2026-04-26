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
      .from("user_roles").select("global_role, partner_scope").eq("user_id", user.id).single();
    if (roleRow?.global_role !== "super_admin") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerPartnerScope: string | null = (roleRow as any)?.partner_scope ?? null;

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
        .from("user_roles").select("global_role, partner_scope").eq("user_id", userId).single();
      if (targetRole?.global_role !== "super_admin") {
        return new Response(JSON.stringify({ success: false, error: "Target is not a super admin" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Scope enforcement: partner admins can only delete super admins in
      // their own partner_scope. Global admins (null scope) can delete anyone.
      const targetScope: string | null = (targetRole as any)?.partner_scope ?? null;
      if (callerPartnerScope && targetScope !== callerPartnerScope) {
        return new Response(JSON.stringify({ success: false, error: "No autorizado para eliminar super admins fuera de tu ámbito" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create flow (direct creation with password, no email invite)
    const { email, name, partnerScope, password } = body;
    if (!email || !name) {
      return new Response(JSON.stringify({ success: false, error: "Missing email or name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ success: false, error: "La contraseña debe tener al menos 8 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate partnerScope if provided. Partner admins can only create
    // super admins inside their own scope.
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
    if (callerPartnerScope && validatedPartnerScope !== callerPartnerScope) {
      return new Response(JSON.stringify({ success: false, error: "Solo puedes crear super admins dentro de tu propio partner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);

    if (existing) {
      return new Response(JSON.stringify({ success: false, error: "Este correo ya está registrado" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, global_role: "super_admin" },
    });
    if (createError || !newUser?.user) {
      const msg = createError?.message || "Create failed";
      const isDup = /already|exists|registered/i.test(msg);
      return new Response(JSON.stringify({ success: false, error: isDup ? "Este correo ya está registrado" : msg }), {
        status: isDup ? 409 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = newUser.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId, tenant_id: null, name, email,
      status: "active", first_login_required: false,
      invited_at: new Date().toISOString(), invited_by: user.id,
    }, { onConflict: "id" });

    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId, global_role: "super_admin", tenant_role: null,
      partner_scope: validatedPartnerScope,
    }, { onConflict: "user_id" });

    await supabaseAdmin.from("security_events").insert({
      event_type: "super_admin_created", user_id: user.id,
      metadata: { created_email: email, created_user_id: userId, partner_scope: validatedPartnerScope },
    });

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-invite-super-admin error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});