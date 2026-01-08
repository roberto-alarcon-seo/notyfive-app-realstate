import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSecureToken, hashToken } from "../_shared/tokenAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user auth for RLS
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for token operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get current user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's profile and role
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("tenant_role")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id || userRole?.tenant_role !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden: owner role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /api-tokens, /api-tokens/{id}, /api-tokens/{id}/rotate, /api-tokens/{id}/toggle

    // LIST - GET /api-tokens
    if (req.method === "GET" && pathParts.length === 1) {
      const { data, error } = await supabaseAdmin
        .from("api_tokens")
        .select("id, name, description, scopes, is_active, last_used_at, expires_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ items: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE - POST /api-tokens
    if (req.method === "POST" && pathParts.length === 1) {
      const body = await req.json();
      const name = String(body?.name || "").trim();
      const description = String(body?.description || "").trim();
      const scopes = Array.isArray(body?.scopes) ? body.scopes.map(String) : [];
      const expires_at = body?.expires_at ? String(body.expires_at) : null;

      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!scopes.length) {
        return new Response(JSON.stringify({ error: "scopes is required" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const plaintext = generateSecureToken();
      const token_hash = await hashToken(plaintext);

      const { data, error } = await supabaseAdmin
        .from("api_tokens")
        .insert({
          tenant_id: tenantId,
          name,
          description: description || null,
          scopes,
          expires_at: expires_at || null,
          token_hash,
        })
        .select("id, tenant_id, name, description, scopes, is_active, last_used_at, expires_at, created_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Ya existe un token con ese nombre" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({ token: plaintext, record: data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ROTATE - POST /api-tokens/{id}/rotate
    if (req.method === "POST" && pathParts.length === 3 && pathParts[2] === "rotate") {
      const tokenId = pathParts[1];
      
      const plaintext = generateSecureToken();
      const token_hash = await hashToken(plaintext);

      const { data, error } = await supabaseAdmin
        .from("api_tokens")
        .update({ token_hash, is_active: true })
        .eq("tenant_id", tenantId)
        .eq("id", tokenId)
        .select("id, tenant_id, name, description, scopes, is_active, last_used_at, expires_at, created_at")
        .single();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Token not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ token: plaintext, record: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TOGGLE - POST /api-tokens/{id}/toggle
    if (req.method === "POST" && pathParts.length === 3 && pathParts[2] === "toggle") {
      const tokenId = pathParts[1];
      const body = await req.json();
      const is_active = !!body?.is_active;

      const { error } = await supabaseAdmin
        .from("api_tokens")
        .update({ is_active })
        .eq("tenant_id", tenantId)
        .eq("id", tokenId);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE - DELETE /api-tokens/{id}
    if (req.method === "DELETE" && pathParts.length === 2) {
      const tokenId = pathParts[1];

      const { error } = await supabaseAdmin
        .from("api_tokens")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", tokenId);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in api-tokens:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
