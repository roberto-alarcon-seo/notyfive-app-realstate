import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export interface TenantSettings {
  tenant_id?: string;
  internal_conversion_stage: string;
  internal_conversion_first_time_only: boolean;
  internal_conversion_allow_reversal: boolean;
  meta_enabled: boolean;
  meta_pixel_id: string | null;
  meta_send_pixel: boolean;
  meta_send_capi: boolean;
  meta_capi_access_token: string | null;
  meta_capi_access_token_exists?: boolean;
  meta_test_event_code: string | null;
}

export interface MetaEventMapping {
  id?: string;
  tenant_id?: string;
  pipeline_stage: string;
  meta_event_type: string;
  meta_event_name: string;
  send_pixel: boolean;
  send_capi: boolean;
  is_active: boolean;
  event_value?: number | null;
  currency?: string;
}

const DEFAULT_SETTINGS: TenantSettings = {
  internal_conversion_stage: 'visit_done',
  internal_conversion_first_time_only: true,
  internal_conversion_allow_reversal: false,
  meta_enabled: false,
  meta_pixel_id: null,
  meta_send_pixel: true,
  meta_send_capi: false,
  meta_capi_access_token: null,
  meta_test_event_code: null,
};

export const DEFAULT_MAPPINGS: MetaEventMapping[] = [
  { pipeline_stage: 'new_lead', meta_event_type: 'STANDARD', meta_event_name: 'Lead', send_pixel: true, send_capi: false, is_active: true },
  { pipeline_stage: 'interest_confirmed', meta_event_type: 'STANDARD', meta_event_name: 'ViewContent', send_pixel: true, send_capi: false, is_active: true },
  { pipeline_stage: 'financial_validation', meta_event_type: 'CUSTOM', meta_event_name: 'QualifiedLead', send_pixel: true, send_capi: true, is_active: true },
  { pipeline_stage: 'visit_done', meta_event_type: 'STANDARD', meta_event_name: 'Schedule', send_pixel: true, send_capi: true, is_active: true },
  { pipeline_stage: 'negotiation', meta_event_type: 'STANDARD', meta_event_name: 'InitiateCheckout', send_pixel: true, send_capi: true, is_active: true },
  { pipeline_stage: 'closed_won', meta_event_type: 'STANDARD', meta_event_name: 'Purchase', send_pixel: true, send_capi: true, is_active: true },
];

export function useConversionSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = profile?.tenant_id;
  const { enabled: hasAccess } = useFeatureFlag("conversions_capi");

  // Guard temprano: si el flag está desactivado, los queries quedan deshabilitados
  // (enabled: false) y devolvemos defaults sin tocar Supabase.

  // Fetch settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return DEFAULT_SETTINGS;
      
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return DEFAULT_SETTINGS;
      }

      // Mask the token for security
      return {
        ...data,
        meta_capi_access_token_exists: !!data.meta_capi_access_token,
        meta_capi_access_token: data.meta_capi_access_token ? '••••••••••••••••' : null,
      } as TenantSettings;
    },
    enabled: !!tenantId && hasAccess,
  });

  // Fetch mappings
  const { data: mappings, isLoading: isLoadingMappings } = useQuery({
    queryKey: ['meta-event-mappings', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('meta_event_mappings')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as MetaEventMapping[];
    },
    enabled: !!tenantId && hasAccess,
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<TenantSettings>) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Don't overwrite token if it's the masked value
      const settingsToSave = { ...newSettings };
      if (settingsToSave.meta_capi_access_token === '••••••••••••••••') {
        delete settingsToSave.meta_capi_access_token;
      }
      delete settingsToSave.meta_capi_access_token_exists;

      const { data, error } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          ...settingsToSave,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
      toast.success('Configuración guardada');
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar la configuración');
    },
  });

  // Save mappings mutation
  const saveMappingsMutation = useMutation({
    mutationFn: async (newMappings: MetaEventMapping[]) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Delete existing mappings
      const { error: deleteError } = await supabase
        .from('meta_event_mappings')
        .delete()
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;

      // Insert new mappings
      if (newMappings.length > 0) {
        const mappingsToInsert = newMappings.map(m => ({
          tenant_id: tenantId,
          pipeline_stage: m.pipeline_stage,
          meta_event_type: m.meta_event_type,
          meta_event_name: m.meta_event_name,
          send_pixel: m.send_pixel,
          send_capi: m.send_capi,
          is_active: m.is_active,
          event_value: m.event_value || null,
          currency: m.currency || 'MXN',
        }));

        const { error: insertError } = await supabase
          .from('meta_event_mappings')
          .insert(mappingsToInsert);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-event-mappings', tenantId] });
      toast.success('Mapeo guardado');
    },
    onError: (error) => {
      console.error('Error saving mappings:', error);
      toast.error('Error al guardar el mapeo');
    },
  });

  // Reset to default mappings
  const resetMappingsToDefault = async () => {
    await saveMappingsMutation.mutateAsync(DEFAULT_MAPPINGS);
  };

  return {
    settings: settings || DEFAULT_SETTINGS,
    mappings: mappings || [],
    // Si no hay acceso, nunca reportamos loading (evita spinners infinitos
    // y mensajes de error rojos por permisos faltantes).
    isLoading: hasAccess ? (isLoadingSettings || isLoadingMappings) : false,
    saveSettings: saveSettingsMutation.mutateAsync,
    saveMappings: saveMappingsMutation.mutateAsync,
    resetMappingsToDefault,
    isSaving: saveSettingsMutation.isPending || saveMappingsMutation.isPending,
  };
}
