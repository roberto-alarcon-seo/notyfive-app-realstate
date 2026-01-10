import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { toast } from '@/hooks/use-toast';

export interface Contact {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  tags: string[];
  notes: string | null;
  status: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  custom_fields?: Record<string, string>;
  // Universal fixed fields
  lead_score: number;
  lead_temperature: 'cold' | 'warm' | 'hot';
  engagement_level: 'low' | 'medium' | 'high';
  source: string | null;
  assigned_agent_id: string | null;
  last_interaction_at: string | null;
  next_action_at: string | null;
  intent_detected: string | null;
  opt_in_status: 'unknown' | 'opt_in' | 'opt_out';
  // Pipeline & Operational fields
  pipeline_stage: string;
  operational_status: string;
  // Real Estate fixed fields
  re_budget_estimated_mxn: number | null;
  re_credit_type: 'INFONAVIT' | 'COFINAVIT' | 'BANK' | 'CASH' | 'MIXED' | null;
  re_credit_preapproved: boolean;
  re_down_payment_mxn: number | null;
  re_monthly_income_mxn: number | null;
  re_property_types: string[] | null;
  re_bedrooms: number | null;
  re_bathrooms: number | null;
  re_parking_spots: number | null;
  re_requires_parking: boolean;
  re_zones: string[] | null;
  re_amenities: string[] | null;
  re_accepts_pets: boolean;
  re_reason: 'BUY' | 'RENT' | 'INVEST' | 'MOVE' | 'UPGRADE' | 'DOWNSIZE' | 'OTHER' | null;
  re_current_situation: 'RENTING' | 'OWNING' | 'LIVING_WITH_FAMILY' | 'LOOKING_TO_MOVE' | 'OTHER' | null;
  // Property interest
  re_property_interest_id: string | null;
  // Diagnostic fields
  re_block_reason: string | null;
  re_visit_outcome: string | null;
}

export interface CustomField {
  id: string;
  tenant_id: string;
  name: string;
  key: string;
  data_type: 'short_text' | 'long_text' | 'number' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'url' | 'select';
  is_required: boolean;
  is_visible_in_list: boolean;
  sort_order: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface CustomFieldValue {
  id: string;
  contact_id: string;
  field_id: string;
  value_text: string | null;
}

export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  tags?: string[];
  notes?: string;
  custom_fields?: Record<string, string>;
  // Universal fixed fields
  lead_score?: number;
  lead_temperature?: 'cold' | 'warm' | 'hot';
  engagement_level?: 'low' | 'medium' | 'high';
  source?: string;
  opt_in_status?: 'unknown' | 'opt_in' | 'opt_out';
  next_action_at?: string;
  // Pipeline & Operational fields
  pipeline_stage?: string;
  operational_status?: string;
  // Real Estate fixed fields
  re_budget_estimated_mxn?: number | null;
  re_credit_type?: 'INFONAVIT' | 'COFINAVIT' | 'BANK' | 'CASH' | 'MIXED' | null;
  re_credit_preapproved?: boolean;
  re_down_payment_mxn?: number | null;
  re_monthly_income_mxn?: number | null;
  re_property_types?: string[];
  re_bedrooms?: number | null;
  re_bathrooms?: number | null;
  re_parking_spots?: number | null;
  re_requires_parking?: boolean;
  re_zones?: string[];
  re_amenities?: string[];
  re_accepts_pets?: boolean;
  re_reason?: 'BUY' | 'RENT' | 'INVEST' | 'MOVE' | 'UPGRADE' | 'DOWNSIZE' | 'OTHER' | null;
  re_current_situation?: 'RENTING' | 'OWNING' | 'LIVING_WITH_FAMILY' | 'LOOKING_TO_MOVE' | 'OTHER' | null;
  // Property interest
  re_property_interest_id?: string | null;
  // Diagnostic fields
  re_block_reason?: string | null;
  re_visit_outcome?: string | null;
}

export function useContacts() {
  const tenantId = useEffectiveTenantId();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldOptions, setCustomFieldOptions] = useState<Record<string, CustomFieldOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [contactCount, setContactCount] = useState(0);

  const fetchCustomFields = useCallback(async () => {
    if (!tenantId) return [];

    const { data, error } = await supabase
      .from('contact_custom_fields')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching custom fields:', error);
      return [];
    }

    return (data || []) as CustomField[];
  }, [tenantId]);

  const fetchCustomFieldOptions = useCallback(async (fields: CustomField[]) => {
    const selectFields = fields.filter(f => f.data_type === 'select');
    if (selectFields.length === 0) return {};

    const { data, error } = await supabase
      .from('contact_custom_field_options')
      .select('*')
      .in('field_id', selectFields.map(f => f.id))
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching custom field options:', error);
      return {};
    }

    // Group by field_id
    const grouped: Record<string, CustomFieldOption[]> = {};
    (data || []).forEach((opt: any) => {
      if (!grouped[opt.field_id]) {
        grouped[opt.field_id] = [];
      }
      grouped[opt.field_id].push(opt as CustomFieldOption);
    });

    return grouped;
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!tenantId) {
      setContacts([]);
      setCustomFields([]);
      setCustomFieldOptions({});
      setContactCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (contactsError) throw contactsError;

      // Fetch custom fields
      const fields = await fetchCustomFields();
      setCustomFields(fields);

      // Fetch custom field options for select fields
      const options = await fetchCustomFieldOptions(fields);
      setCustomFieldOptions(options);

      // Fetch custom field values for all contacts
      const contactIds = (contactsData || []).map(c => c.id);
      
      let customFieldValues: CustomFieldValue[] = [];
      if (contactIds.length > 0) {
        const { data: valuesData, error: valuesError } = await supabase
          .from('contact_custom_field_values')
          .select('*')
          .in('contact_id', contactIds);

        if (valuesError) {
          console.error('Error fetching custom field values:', valuesError);
        } else {
          customFieldValues = (valuesData || []) as CustomFieldValue[];
        }
      }

      // Combine contacts with custom field values
      const contactsWithCustomFields = (contactsData || []).map(contact => {
        const contactValues = customFieldValues.filter(v => v.contact_id === contact.id);
        const customFieldsMap: Record<string, string> = {};
        
        contactValues.forEach(value => {
          const field = fields.find(f => f.id === value.field_id);
          if (field && value.value_text) {
            customFieldsMap[field.key] = value.value_text;
          }
        });

        return {
          ...contact,
          tags: contact.tags || [],
          custom_fields: customFieldsMap,
        } as Contact;
      });

      setContacts(contactsWithCustomFields);
      
      // Count active contacts
      const activeCount = contactsWithCustomFields.filter(c => c.status === 'active').length;
      setContactCount(activeCount);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los contactos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, fetchCustomFields]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const createContact = async (formData: ContactFormData): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      // Insert contact (no limit checks - unlimited contacts)
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          country: formData.country || null,
          tags: formData.tags || [],
          notes: formData.notes || null,
          status: 'active',
          // Universal fixed fields
          lead_score: formData.lead_score ?? 0,
          lead_temperature: formData.lead_temperature ?? 'cold',
          engagement_level: formData.engagement_level ?? 'low',
          source: formData.source || null,
          opt_in_status: formData.opt_in_status ?? 'unknown',
          next_action_at: formData.next_action_at || null,
          // Pipeline & Operational fields
          pipeline_stage: formData.pipeline_stage ?? 'new_lead',
          operational_status: formData.operational_status ?? 'ACTIVE',
          // Real Estate fixed fields
          re_budget_estimated_mxn: formData.re_budget_estimated_mxn ?? null,
          re_credit_type: formData.re_credit_type ?? null,
          re_credit_preapproved: formData.re_credit_preapproved ?? false,
          re_down_payment_mxn: formData.re_down_payment_mxn ?? null,
          re_monthly_income_mxn: formData.re_monthly_income_mxn ?? null,
          re_property_types: formData.re_property_types ?? null,
          re_bedrooms: formData.re_bedrooms ?? null,
          re_bathrooms: formData.re_bathrooms ?? null,
          re_parking_spots: formData.re_parking_spots ?? null,
          re_requires_parking: formData.re_requires_parking ?? false,
          re_zones: formData.re_zones ?? null,
          re_amenities: formData.re_amenities ?? null,
          re_accepts_pets: formData.re_accepts_pets ?? false,
          re_reason: formData.re_reason ?? null,
          re_current_situation: formData.re_current_situation ?? null,
          // Property interest
          re_property_interest_id: formData.re_property_interest_id ?? null,
          // Diagnostic fields
          re_block_reason: formData.re_block_reason ?? null,
          re_visit_outcome: formData.re_visit_outcome ?? null,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Insert custom field values
      if (formData.custom_fields && Object.keys(formData.custom_fields).length > 0) {
        const customFieldsToInsert = [];
        
        for (const [key, value] of Object.entries(formData.custom_fields)) {
          if (value) {
            const field = customFields.find(f => f.key === key);
            if (field) {
              customFieldsToInsert.push({
                contact_id: newContact.id,
                field_id: field.id,
                value_text: value,
              });
            }
          }
        }

        if (customFieldsToInsert.length > 0) {
          const { error: valuesError } = await supabase
            .from('contact_custom_field_values')
            .insert(customFieldsToInsert);

          if (valuesError) {
            console.error('Error inserting custom field values:', valuesError);
          }
        }
      }

      toast({
        title: "Contacto creado",
        description: "El contacto se ha creado correctamente.",
      });

      await fetchContacts();
      return true;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el contacto",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateContact = async (id: string, formData: ContactFormData): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          country: formData.country || null,
          tags: formData.tags || [],
          notes: formData.notes || null,
          // Universal fixed fields
          lead_score: formData.lead_score ?? 0,
          lead_temperature: formData.lead_temperature ?? 'cold',
          engagement_level: formData.engagement_level ?? 'low',
          source: formData.source || null,
          opt_in_status: formData.opt_in_status ?? 'unknown',
          next_action_at: formData.next_action_at || null,
          // Pipeline & Operational fields
          pipeline_stage: formData.pipeline_stage ?? 'new_lead',
          operational_status: formData.operational_status ?? 'ACTIVE',
          // Real Estate fixed fields
          re_budget_estimated_mxn: formData.re_budget_estimated_mxn ?? null,
          re_credit_type: formData.re_credit_type ?? null,
          re_credit_preapproved: formData.re_credit_preapproved ?? false,
          re_down_payment_mxn: formData.re_down_payment_mxn ?? null,
          re_monthly_income_mxn: formData.re_monthly_income_mxn ?? null,
          re_property_types: formData.re_property_types ?? null,
          re_bedrooms: formData.re_bedrooms ?? null,
          re_bathrooms: formData.re_bathrooms ?? null,
          re_parking_spots: formData.re_parking_spots ?? null,
          re_requires_parking: formData.re_requires_parking ?? false,
          re_zones: formData.re_zones ?? null,
          re_amenities: formData.re_amenities ?? null,
          re_accepts_pets: formData.re_accepts_pets ?? false,
          re_reason: formData.re_reason ?? null,
          re_current_situation: formData.re_current_situation ?? null,
          // Property interest
          re_property_interest_id: formData.re_property_interest_id ?? null,
          // Diagnostic fields
          re_block_reason: formData.re_block_reason ?? null,
          re_visit_outcome: formData.re_visit_outcome ?? null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update custom field values
      if (formData.custom_fields) {
        for (const [key, value] of Object.entries(formData.custom_fields)) {
          const field = customFields.find(f => f.key === key);
          if (field) {
            // Upsert the value
            const { error: upsertError } = await supabase
              .from('contact_custom_field_values')
              .upsert({
                contact_id: id,
                field_id: field.id,
                value_text: value || null,
              }, {
                onConflict: 'contact_id,field_id',
              });

            if (upsertError) {
              console.error('Error upserting custom field value:', upsertError);
            }
          }
        }
      }

      toast({
        title: "Contacto actualizado",
        description: "El contacto se ha actualizado correctamente.",
      });

      await fetchContacts();
      return true;
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el contacto",
        variant: "destructive",
      });
      return false;
    }
  };

  const archiveContact = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Contacto archivado",
        description: "El contacto se ha archivado correctamente.",
      });

      await fetchContacts();
      return true;
    } catch (error: any) {
      console.error('Error archiving contact:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo archivar el contacto",
        variant: "destructive",
      });
      return false;
    }
  };

  const restoreContact = async (id: string): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      // No limit checks - unlimited contacts
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'active' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Contacto restaurado",
        description: "El contacto se ha restaurado correctamente.",
      });

      await fetchContacts();
      return true;
    } catch (error: any) {
      console.error('Error restoring contact:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo restaurar el contacto",
        variant: "destructive",
      });
      return false;
    }
  };

  const importContacts = async (
    contactsToImport: ContactFormData[],
    fieldMapping: Record<string, string>
  ): Promise<{ success: number; failed: number }> => {
    if (!tenantId) return { success: 0, failed: contactsToImport.length };

    let success = 0;
    let failed = 0;

    // No limit checks - unlimited contacts
    for (const contactData of contactsToImport) {
      const result = await createContact(contactData);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    if (success > 0) {
      toast({
        title: "Importación completada",
        description: `Se importaron ${success} contactos correctamente.${failed > 0 ? ` ${failed} fallaron.` : ''}`,
      });
    }

    return { success, failed };
  };

  return {
    contacts,
    customFields,
    customFieldOptions,
    loading,
    contactCount,
    fetchContacts,
    createContact,
    updateContact,
    archiveContact,
    restoreContact,
    importContacts,
  };
}
