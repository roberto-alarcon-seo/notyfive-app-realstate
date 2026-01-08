import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImpersonateRequest {
  action: 'start' | 'stop';
  tenant_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify super_admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('global_role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.global_role !== 'super_admin') {
      console.error('Not super_admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin only.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ImpersonateRequest = await req.json();
    const { action, tenant_id } = body;

    if (!action || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing action or tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request metadata for audit
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'start') {
      // Log impersonation start
      const { error: auditError } = await supabaseAdmin
        .from('security_events')
        .insert({
          event_type: 'support_impersonation_started',
          user_id: user.id,
          tenant_id: tenant_id,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: {
            tenant_name: tenant.name,
            actor_email: user.email,
          }
        });

      if (auditError) {
        console.error('Failed to log security event:', auditError);
        // Don't fail the request, just log the error
      }

      console.log(`Support impersonation started: ${user.email} -> ${tenant.name} (${tenant_id})`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Support mode activated',
          tenant_id: tenant.id,
          tenant_name: tenant.name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'stop') {
      // Log impersonation end
      const { error: auditError } = await supabaseAdmin
        .from('security_events')
        .insert({
          event_type: 'support_impersonation_ended',
          user_id: user.id,
          tenant_id: tenant_id,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: {
            tenant_name: tenant.name,
            actor_email: user.email,
          }
        });

      if (auditError) {
        console.error('Failed to log security event:', auditError);
      }

      console.log(`Support impersonation ended: ${user.email} -> ${tenant.name} (${tenant_id})`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Support mode deactivated',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "start" or "stop".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in admin-impersonate:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
