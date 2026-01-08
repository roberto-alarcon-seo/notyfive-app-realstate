import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get plan monthly credits (mirrors DB function get_plan_monthly_credits)
function getPlanMonthlyCredits(plan: string): number {
  switch (plan) {
    case 'trial': return 100;
    case 'starter': return 1000;
    case 'growth': return 3000;
    case 'pro': return 6000;
    case 'scale': return 12000;
    case 'enterprise': return 25000;
    default: return 0;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('global_role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.global_role !== 'super_admin') {
      console.error('Role check failed:', roleError, roleData);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { tenantId } = await req.json();
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} completing onboarding for tenant ${tenantId}`);

    // Fetch tenant with all credit fields
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, plan, billing_state, message_credits, monthly_credits_remaining, accumulated_credits, initial_credits_granted')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if tenant is in correct state
    if (tenant.billing_state !== 'ONBOARDING_PAID') {
      console.log(`Tenant ${tenantId} is not in onboarding state: ${tenant.billing_state}`);
      return new Response(
        JSON.stringify({ 
          error: 'Tenant is not in onboarding state',
          current_state: tenant.billing_state 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency check: if credits already granted, return success without modifying
    if (tenant.initial_credits_granted === true) {
      console.log(`Tenant ${tenantId} already has credits granted`);
      const totalCredits = (tenant.monthly_credits_remaining || 0) + (tenant.accumulated_credits || 0);
      return new Response(
        JSON.stringify({
          message: 'Already completed',
          tenantId: tenant.id,
          billing_state: tenant.billing_state,
          total_credits: totalCredits,
          monthly_credits_remaining: tenant.monthly_credits_remaining,
          accumulated_credits: tenant.accumulated_credits,
          initial_credits_granted: tenant.initial_credits_granted,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate credits based on plan
    const planCredits = getPlanMonthlyCredits(tenant.plan);
    const now = new Date();
    const nextRefill = new Date(now);
    nextRefill.setMonth(nextRefill.getMonth() + 1);

    // Complete onboarding: grant credits using new monthly/accumulated system
    const { data: updatedTenant, error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        monthly_credits_remaining: planCredits,
        accumulated_credits: 0,
        message_credits: planCredits, // Keep for backwards compatibility
        initial_credits_granted: true,
        billing_state: 'ACTIVE_WITH_CREDITS',
        last_refill_at: now.toISOString(),
        next_refill_at: nextRefill.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', tenantId)
      .select('id, plan, billing_state, monthly_credits_remaining, accumulated_credits, message_credits, initial_credits_granted, next_refill_at')
      .single();

    if (updateError) {
      console.error('Error updating tenant:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to complete onboarding' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also sync wallet for legacy compatibility
    await supabaseAdmin
      .from('wallets')
      .update({
        balance_messages: planCredits,
        status: 'active',
        updated_at: now.toISOString(),
      })
      .eq('tenant_id', tenantId);

    console.log(`Successfully completed onboarding for tenant ${tenantId} with ${planCredits} credits`);

    const totalCredits = (updatedTenant.monthly_credits_remaining || 0) + (updatedTenant.accumulated_credits || 0);

    return new Response(
      JSON.stringify({
        tenantId: updatedTenant.id,
        plan: updatedTenant.plan,
        billing_state: updatedTenant.billing_state,
        total_credits: totalCredits,
        monthly_credits_remaining: updatedTenant.monthly_credits_remaining,
        accumulated_credits: updatedTenant.accumulated_credits,
        next_refill_at: updatedTenant.next_refill_at,
        initial_credits_granted: updatedTenant.initial_credits_granted,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
