import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CustomFieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldOptionFormData {
  label: string;
  value: string;
}

export function useCustomFieldOptions() {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<CustomFieldOption[]>([]);

  const fetchAllOptions = useCallback(async (): Promise<CustomFieldOption[]> => {
    try {
      const { data, error } = await supabase
        .from('contact_custom_field_options')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      const opts = (data || []) as CustomFieldOption[];
      setOptions(opts);
      return opts;
    } catch (error: any) {
      console.error('Error fetching all custom field options:', error);
      return [];
    }
  }, []);

  const fetchOptionsForField = useCallback(async (fieldId: string): Promise<CustomFieldOption[]> => {
    try {
      const { data, error } = await supabase
        .from('contact_custom_field_options')
        .select('*')
        .eq('field_id', fieldId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as CustomFieldOption[];
    } catch (error: any) {
      console.error('Error fetching custom field options:', error);
      return [];
    }
  }, []);

  const fetchOptionsForFields = useCallback(async (fieldIds: string[]): Promise<Record<string, CustomFieldOption[]>> => {
    if (fieldIds.length === 0) return {};

    try {
      const { data, error } = await supabase
        .from('contact_custom_field_options')
        .select('*')
        .in('field_id', fieldIds)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Group options by field_id
      const grouped: Record<string, CustomFieldOption[]> = {};
      (data || []).forEach((option: any) => {
        if (!grouped[option.field_id]) {
          grouped[option.field_id] = [];
        }
        grouped[option.field_id].push(option as CustomFieldOption);
      });

      return grouped;
    } catch (error: any) {
      console.error('Error fetching custom field options:', error);
      return {};
    }
  }, []);

  const saveOptionsForField = useCallback(async (
    fieldId: string,
    options: CustomFieldOptionFormData[]
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // First, delete existing options for this field
      const { error: deleteError } = await supabase
        .from('contact_custom_field_options')
        .delete()
        .eq('field_id', fieldId);

      if (deleteError) throw deleteError;

      // Then, insert new options if any
      if (options.length > 0) {
        const optionsToInsert = options.map((opt, index) => ({
          field_id: fieldId,
          label: opt.label.trim(),
          value: opt.value.trim() || opt.label.trim(),
          sort_order: index,
        }));

        const { error: insertError } = await supabase
          .from('contact_custom_field_options')
          .insert(optionsToInsert);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error: any) {
      console.error('Error saving custom field options:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las opciones",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    options,
    fetchAllOptions,
    fetchOptionsForField,
    fetchOptionsForFields,
    saveOptionsForField,
  };
}
