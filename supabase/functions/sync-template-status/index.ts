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

    // 3) Fetch templates that have a Twilio SID and are pending or draft
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

    // 4) Use Twilio Content v2 API to get approval status with channel eligibility
    // This is more reliable than the v1 ApprovalRequests endpoint
    const contentListResponse = await fetch(
      'https://content.twilio.com/v2/ContentAndApprovals',
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
        },
      }
    );

    let twilioContentMap = new Map<string, { status: string; rejection_reason?: string }>();

    if (contentListResponse.ok) {
      const contentListData = await contentListResponse.json();
      const contents = contentListData.contents || [];
      
      for (const content of contents) {
        const sid = content.sid;
        if (!sid) continue;
        
        // Check WhatsApp channel eligibility from approval_requests
        const approvalRequests = content.approval_requests || {};
        const whatsapp = approvalRequests.whatsapp;
        
        if (whatsapp && whatsapp.status) {
          twilioContentMap.set(sid, {
            status: whatsapp.status,
            rejection_reason: whatsapp.rejection_reason || undefined,
          });
          console.log(`📋 Twilio v2 status for ${sid}: ${whatsapp.status}`);
        }
      }
    } else {
      console.warn('⚠️ Failed to fetch v2 ContentAndApprovals, falling back to v1');
    }

    // 5) Sync each template
    for (const template of templates || []) {
      if (!template.twilio_template_sid) continue;

      try {
        let approvalStatus: string | undefined;
        let rejectionReason: string | undefined;

        // Try v2 data first
        const v2Data = twilioContentMap.get(template.twilio_template_sid);
        if (v2Data) {
          approvalStatus = v2Data.status;
          rejectionReason = v2Data.rejection_reason;
        } else {
          // Fallback to v1 ApprovalRequests
          console.log(`🔍 Falling back to v1 for template: ${template.name} (${template.twilio_template_sid})`);

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

          if (approvalResponse.ok) {
            const approvalData = await approvalResponse.json();
            const whatsappApproval = approvalData.whatsapp || approvalData;
            approvalStatus = whatsappApproval.status;
            rejectionReason = whatsappApproval.rejection_reason;
            console.log(`📋 v1 status for ${template.name}: ${approvalStatus}`);
          }
        }

        if (!approvalStatus) {
          console.log(`ℹ️ No approval status found for ${template.name}`);
          continue;
        }

        // Map Twilio status to our status
        let newStatus: string;
        switch (approvalStatus) {
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
          case 'unsubmitted':
            newStatus = 'draft';
            break;
          default:
            console.log(`⚠️ Unknown approval status: ${approvalStatus}`);
            newStatus = template.approval_status;
        }

        // Update if status changed
        if (newStatus !== template.approval_status) {
          console.log(`📝 Updating ${template.name}: ${template.approval_status} → ${newStatus}`);

          const updateData: Record<string, unknown> = {
            approval_status: newStatus,
            last_synced_at: new Date().toISOString(),
          };

          if (newStatus === 'rejected' && rejectionReason) {
            updateData.rejection_reason = rejectionReason;
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
            rejection_reason: rejectionReason,
          });
        }
      } catch (templateError) {
        console.error(`❌ Error syncing template ${template.id}:`, templateError);
      }
    }

    // 6) Also update last_synced_at for all synced templates
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
