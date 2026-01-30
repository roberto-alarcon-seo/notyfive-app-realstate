import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignmentRequest {
  property_id: string;
  user_id: string | null; // null to unassign
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get actor's profile and role
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const { data: actorRole } = await supabase
      .from("user_roles")
      .select("tenant_role, global_role")
      .eq("user_id", user.id)
      .single();

    if (!actorProfile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "User has no tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = actorRole?.global_role === "super_admin";
    const isAdminOrManager = actorRole?.tenant_role === "administrador" || actorRole?.tenant_role === "manager";

    // Only admin/manager can assign properties
    if (!isSuperAdmin && !isAdminOrManager) {
      return new Response(
        JSON.stringify({ error: "Solo administradores y managers pueden asignar propiedades" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { property_id, user_id }: AssignmentRequest = await req.json();

    if (!property_id) {
      return new Response(
        JSON.stringify({ error: "property_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify property belongs to the tenant
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, tenant_id, title")
      .eq("id", property_id)
      .single();

    if (propError || !property) {
      return new Response(
        JSON.stringify({ error: "Property not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isSuperAdmin && property.tenant_id !== actorProfile.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Property does not belong to your tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If unassigning (user_id is null)
    if (!user_id) {
      // Remove all assignments for this property
      const { error: deleteError } = await supabase
        .from("property_assignments")
        .delete()
        .eq("property_id", property_id);

      if (deleteError) {
        console.error("Error deleting assignments:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to remove assignments" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update property assigned_user_id to null
      await supabase
        .from("properties")
        .update({ assigned_user_id: null })
        .eq("id", property_id);

      return new Response(
        JSON.stringify({ success: true, message: "Property unassigned" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user is an asesor in the same tenant
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, tenant_id, name")
      .eq("id", user_id)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isSuperAdmin && targetProfile.tenant_id !== actorProfile.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Target user does not belong to your tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: targetRole } = await supabase
      .from("user_roles")
      .select("tenant_role")
      .eq("user_id", user_id)
      .single();

    if (targetRole?.tenant_role !== "asesor") {
      return new Response(
        JSON.stringify({ error: "Solo se pueden asignar propiedades a asesores" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove existing assignments for this property
    await supabase
      .from("property_assignments")
      .delete()
      .eq("property_id", property_id);

    // Create new assignment
    const { error: insertError } = await supabase
      .from("property_assignments")
      .insert({
        tenant_id: property.tenant_id,
        property_id: property_id,
        user_id: user_id,
        assigned_by: user.id,
      });

    if (insertError) {
      console.error("Error creating assignment:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create assignment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update property assigned_user_id for legacy compatibility
    await supabase
      .from("properties")
      .update({ assigned_user_id: user_id })
      .eq("id", property_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Propiedad "${property.title}" asignada a ${targetProfile.name}` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in assign-property-to-user:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});