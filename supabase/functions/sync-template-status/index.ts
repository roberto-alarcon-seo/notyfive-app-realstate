import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1) Verify auth and get tenant_id
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ code: 'UNAUTHORIZED', message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant_id from user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ code: 'FORBIDDEN', message: 'User has no tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.tenant_id;
    console.log(`🔄 Syncing templates for tenant: ${tenantId}`);

    // 2) Get Twilio integration
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('account_sid, auth_token_encrypted, status')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .single();

    if (!integration || integration.status !== 'connected') {
      return new Response(
        JSON.stringify({ 
          code: 'NO_INTEGRATION', 
          message: 'No hay cuenta de Twilio conectada.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode auth token
    const authToken = atob(integration.auth_token_encrypted!);
    const twilioAuth = btoa(`${integration.account_sid}:${authToken}`);

    // 3) Fetch templates that have a Twilio SID and are pending
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, twilio_template_sid, approval_status, name')
      .eq('tenant_id', tenantId)
      .not('twilio_template_sid', 'is', null)
      .in('approval_status', ['pending', 'draft']);

    if (templatesError) {
      console.error('❌ Error fetching templates:', templatesError);
      throw templatesError;
    }

    console.log(`📋 Found ${templates?.length || 0} templates to sync`);

    const results: Array<{
      id: string;
      name: string;
      old_status: string;
      new_status: string;
      rejection_reason?: string;
    }> = [];

    // 4) Sync each template
    for (const template of templates || []) {
      if (!template.twilio_template_sid) continue;

      try {
        console.log(`🔍 Checking status for template: ${template.name} (${template.twilio_template_sid})`);

        // Fetch approval status from Twilio
        const approvalResponse = await fetch(
          `https://content.twilio.com/v1/Content/${template.twilio_template_sid}/ApprovalRequests`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!approvalResponse.ok) {
          console.warn(`⚠️ Failed to fetch approval status for ${template.id}:`, approvalResponse.status);
          continue;
        }

        const approvalData = await approvalResponse.json();
        console.log(`📥 Approval data for ${template.name}:`, JSON.stringify(approvalData, null, 2));

        // Get WhatsApp approval status
        const whatsappApproval = approvalData.whatsapp;
        if (!whatsappApproval) {
          console.log(`ℹ️ No WhatsApp approval data for ${template.name}`);
          continue;
        }

        // Map Twilio status to our status
        let newStatus: string;
        switch (whatsappApproval.status) {
          case 'approved':
            newStatus = 'approved';
            break;
          case 'rejected':
            newStatus = 'rejected';
            break;
          case 'pending':
          case 'received':
            newStatus = 'pending';
            break;
          default:
            newStatus = template.approval_status;
        }

        // Update if status changed
        if (newStatus !== template.approval_status) {
          console.log(`📝 Updating ${template.name}: ${template.approval_status} → ${newStatus}`);

          const updateData: Record<string, unknown> = {
            approval_status: newStatus,
            last_synced_at: new Date().toISOString(),
          };

          if (newStatus === 'rejected' && whatsappApproval.rejection_reason) {
            updateData.rejection_reason = whatsappApproval.rejection_reason;
          } else if (newStatus === 'approved') {
            updateData.rejection_reason = null;
          }

          await supabase
            .from('templates')
            .update(updateData)
            .eq('id', template.id);

          results.push({
            id: template.id,
            name: template.name,
            old_status: template.approval_status,
            new_status: newStatus,
            rejection_reason: whatsappApproval.rejection_reason,
          });
        }
      } catch (templateError) {
        console.error(`❌ Error syncing template ${template.id}:`, templateError);
      }
    }

    // 5) Also update last_synced_at for all synced templates
    if (templates && templates.length > 0) {
      await supabase
        .from('templates')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .not('twilio_template_sid', 'is', null);
    }

    console.log(`✅ Sync complete. Updated ${results.length} templates.`);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: templates?.length || 0,
        updated_count: results.length,
        updates: results,
        message: results.length > 0 
          ? `Se actualizaron ${results.length} plantilla(s)`
          : 'Todas las plantillas están sincronizadas'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in sync-template-status:', error);
    return new Response(
      JSON.stringify({ 
        code: 'INTERNAL_ERROR', 
        message: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
