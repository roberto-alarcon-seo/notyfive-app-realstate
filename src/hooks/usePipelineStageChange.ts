import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import { trackPipelineEvent, getMetaCookies } from "@/lib/meta/pixelLoader";

// Pipeline stages in order (for detecting reversal)
const PIPELINE_ORDER = [
  'new_lead',
  'interest_confirmed',
  'financial_validation',
  'searching',
  'visit_done',
  'follow_up',
  'negotiation',
  'closed_won',
  'closed_lost',
];

interface TenantSettings {
  internal_conversion_stage: string;
  internal_conversion_first_time_only: boolean;
  internal_conversion_allow_reversal: boolean;
  meta_enabled: boolean;
  meta_pixel_id: string | null;
  meta_send_pixel: boolean;
  meta_send_capi: boolean;
}

interface MetaEventMapping {
  pipeline_stage: string;
  meta_event_type: string;
  meta_event_name: string;
  send_pixel: boolean;
  send_capi: boolean;
  is_active: boolean;
}

interface Contact {
  id: string;
  phone?: string | null;
  email?: string | null;
  internal_converted_at?: string | null;
  internal_converted_stage?: string | null;
  internal_conversion_count: number;
  re_property_interest_id?: string | null;
  lead_score?: number;
}

export function usePipelineStageChange() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const handlePipelineStageChange = useCallback(async (
    contactId: string,
    oldStage: string,
    newStage: string
  ) => {
    if (!tenantId || oldStage === newStage) return;

    try {
      // Fetch tenant settings
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!settings) {
        console.log('No tenant settings found, using defaults');
        return;
      }

      // Fetch contact data
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, phone, email, internal_converted_at, internal_converted_stage, internal_conversion_count, re_property_interest_id, lead_score')
        .eq('id', contactId)
        .single();

      if (!contact) {
        console.error('Contact not found:', contactId);
        return;
      }

      // FLOW A: Internal Conversion Logic
      await handleInternalConversion(
        tenantId,
        contact as Contact,
        oldStage,
        newStage,
        settings as TenantSettings
      );

      // FLOW B: Meta Events
      if (settings.meta_enabled) {
        await handleMetaEvents(
          tenantId,
          contact as Contact,
          newStage,
          settings as TenantSettings
        );
      }
    } catch (error) {
      console.error('Error handling pipeline stage change:', error);
    }
  }, [tenantId]);

  return { handlePipelineStageChange };
}

async function handleInternalConversion(
  tenantId: string,
  contact: Contact,
  oldStage: string,
  newStage: string,
  settings: TenantSettings
) {
  const conversionStage = settings.internal_conversion_stage;
  const firstTimeOnly = settings.internal_conversion_first_time_only;
  const allowReversal = settings.internal_conversion_allow_reversal;

  // Check if moving TO the conversion stage
  if (newStage === conversionStage) {
    // If first time only and already converted, skip
    if (firstTimeOnly && contact.internal_converted_at) {
      console.log('Contact already converted, skipping (first_time_only is true)');
      return;
    }

    // Record conversion
    const { error } = await supabase
      .from('contacts')
      .update({
        internal_converted_at: new Date().toISOString(),
        internal_converted_stage: newStage,
        internal_conversion_count: contact.internal_conversion_count + 1,
      })
      .eq('id', contact.id);

    if (error) {
      console.error('Error updating internal conversion:', error);
      return;
    }

    // Log the event
    await logConversionEvent(tenantId, contact.id, 'INTERNAL', newStage, 'internal_conversion', 'SENT');
    console.log('Internal conversion recorded for contact:', contact.id);
  }

  // Check for reversal (moving away from conversion stage to an earlier stage)
  if (allowReversal && contact.internal_converted_at && contact.internal_converted_stage === conversionStage) {
    const oldIndex = PIPELINE_ORDER.indexOf(oldStage);
    const newIndex = PIPELINE_ORDER.indexOf(newStage);
    const conversionIndex = PIPELINE_ORDER.indexOf(conversionStage);

    // If moving to a stage before the conversion stage
    if (newIndex < conversionIndex && newIndex >= 0) {
      const newCount = Math.max(0, contact.internal_conversion_count - 1);
      
      const { error } = await supabase
        .from('contacts')
        .update({
          internal_converted_at: null,
          internal_converted_stage: null,
          internal_conversion_count: newCount,
        })
        .eq('id', contact.id);

      if (error) {
        console.error('Error reverting internal conversion:', error);
        return;
      }

      // Log the reversal event
      await logConversionEvent(tenantId, contact.id, 'INTERNAL', newStage, 'internal_conversion_reversal', 'SENT');
      console.log('Internal conversion reversed for contact:', contact.id);
    }
  }
}

async function handleMetaEvents(
  tenantId: string,
  contact: Contact,
  newStage: string,
  settings: TenantSettings
) {
  // Fetch mappings for this stage
  const { data: mappings } = await supabase
    .from('meta_event_mappings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('pipeline_stage', newStage)
    .eq('is_active', true);

  if (!mappings || mappings.length === 0) {
    console.log('No active mappings for stage:', newStage);
    return;
  }

  for (const mapping of mappings as MetaEventMapping[]) {
    const eventData = {
      contactId: contact.id,
      pipelineStage: newStage,
      propertyId: contact.re_property_interest_id || undefined,
      leadScore: contact.lead_score,
    };

    // Send Pixel event (browser-side)
    if (mapping.send_pixel && settings.meta_send_pixel) {
      try {
        trackPipelineEvent(
          mapping.meta_event_type as 'STANDARD' | 'CUSTOM',
          mapping.meta_event_name,
          eventData
        );
        await logConversionEvent(
          tenantId,
          contact.id,
          'META_PIXEL',
          newStage,
          mapping.meta_event_name,
          'SENT',
          { ...eventData }
        );
      } catch (error) {
        console.error('Error sending pixel event:', error);
        await logConversionEvent(
          tenantId,
          contact.id,
          'META_PIXEL',
          newStage,
          mapping.meta_event_name,
          'FAILED',
          { ...eventData },
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Send CAPI event (server-side)
    if (mapping.send_capi && settings.meta_send_capi) {
      try {
        const metaCookies = getMetaCookies();
        
        const { error } = await supabase.functions.invoke('meta-capi-track', {
          body: {
            tenant_id: tenantId,
            contact_id: contact.id,
            event_name: mapping.meta_event_name,
            event_type: mapping.meta_event_type,
            custom_data: {
              pipeline_stage: newStage,
              contact_id: contact.id,
              property_id: contact.re_property_interest_id,
              lead_score: contact.lead_score,
            },
            user_data: {
              phone: contact.phone,
              email: contact.email,
              external_id: contact.id,
              fbp: metaCookies.fbp,
              fbc: metaCookies.fbc,
            },
          },
        });

        if (error) throw error;

        await logConversionEvent(
          tenantId,
          contact.id,
          'META_CAPI',
          newStage,
          mapping.meta_event_name,
          'SENT',
          { ...eventData }
        );
      } catch (error) {
        console.error('Error sending CAPI event:', error);
        await logConversionEvent(
          tenantId,
          contact.id,
          'META_CAPI',
          newStage,
          mapping.meta_event_name,
          'FAILED',
          { ...eventData },
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }
}

async function logConversionEvent(
  tenantId: string,
  contactId: string,
  source: string,
  pipelineStage: string,
  eventName: string,
  status: string,
  payload?: Record<string, unknown>,
  errorMessage?: string
) {
  const { error } = await supabase
    .from('conversion_event_logs')
    .insert([{
      tenant_id: tenantId,
      contact_id: contactId,
      source,
      pipeline_stage: pipelineStage,
      event_name: eventName,
      status,
      payload: (payload || {}) as Json,
      error_message: errorMessage || null,
    }]);

  if (error) {
    console.error('Error logging conversion event:', error);
  }
}
