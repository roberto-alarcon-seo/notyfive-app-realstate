import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
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

  // Only administrador (or super_admin) can delete users
  const isAdmin = callerRole.global_role === "super_admin" || 
                  callerRole.tenant_role === "administrador" ||
                  callerRole.tenant_role === "owner";
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Only administrators can delete users" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: "No puedes eliminarte a ti mismo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user's profile
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, email, name")
      .eq("id", userId)
      .single();

    if (targetProfileError || !targetProfile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target user belongs to same tenant
    if (targetProfile.tenant_id !== callerProfile.tenant_id) {
      return new Response(JSON.stringify({ error: "Cannot delete user from another tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target is the last admin
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_role")
      .eq("user_id", userId)
      .single();

    if (targetRole?.tenant_role === "administrador" || targetRole?.tenant_role === "owner") {
      // Count remaining admins
      const { count: adminCount } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("tenant_role", ["administrador", "owner"])
        .in("user_id", (
          await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("tenant_id", callerProfile.tenant_id)
        ).data?.map(p => p.id) || []);

      if ((adminCount ?? 0) <= 1) {
        return new Response(JSON.stringify({ 
          error: "No puedes eliminar al único Administrador del tenant" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Deleting user ${userId} (${targetProfile.email}) from tenant ${callerProfile.tenant_id}`);

    // Delete from auth (cascades to profiles and user_roles via FK)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(JSON.stringify({ error: deleteError.message || "Error deleting user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log security event
    await supabaseAdmin.from("security_events").insert({
      event_type: "tenant_user_deleted",
      user_id: user.id,
      tenant_id: callerProfile.tenant_id,
      metadata: {
        deleted_email: targetProfile.email,
        deleted_user_id: userId,
        deleted_name: targetProfile.name,
      },
    });

    console.log(`User deleted successfully: ${targetProfile.email}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Usuario eliminado correctamente",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in delete-tenant-user:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
