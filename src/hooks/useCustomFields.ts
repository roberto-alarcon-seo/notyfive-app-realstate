import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { toast } from '@/hooks/use-toast';


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

export interface CustomFieldFormData {
  name: string;
  key?: string;
  data_type: CustomField['data_type'];
  is_required: boolean;
  is_visible_in_list: boolean;
  category?: string | null;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '') // Trim underscores
    .substring(0, 50); // Limit length
}

export function useCustomFields() {
  const { hasRole } = useAuth();
  const tenantId = useEffectiveTenantId();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwner = hasRole(['administrador']);

  const fetchCustomFields = useCallback(async () => {
    if (!tenantId) {
      setCustomFields([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_custom_fields')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setCustomFields((data || []) as CustomField[]);
    } catch (error: any) {
      console.error('Error fetching custom fields:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los campos personalizados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCustomFields();
  }, [fetchCustomFields]);

  const createCustomField = async (formData: CustomFieldFormData): Promise<boolean> => {
    if (!tenantId || !isOwner) {
      toast({
        title: 'Sin permisos',
        description: 'Solo los propietarios pueden crear campos personalizados.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      // Generate key from name if not provided
      const key = formData.key || generateSlug(formData.name);

      // Check if key already exists
      const { data: existing, error: checkError } = await supabase
        .from('contact_custom_fields')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('key', key)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        toast({
          title: 'Error',
          description: 'Ya existe un campo con ese identificador. Elige un nombre diferente.',
          variant: 'destructive',
        });
        return false;
      }

      // Get max sort_order
      const { data: maxOrderData } = await supabase
        .from('contact_custom_fields')
        .select('sort_order')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = maxOrderData && maxOrderData.length > 0
        ? (maxOrderData[0] as any).sort_order + 1
        : 0;

      const { error: insertError } = await supabase
        .from('contact_custom_fields')
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          key,
          data_type: formData.data_type,
          is_required: formData.is_required,
          is_visible_in_list: formData.is_visible_in_list,
          sort_order: nextOrder,
          category: formData.category || null,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Campo creado',
        description: 'El campo personalizado se ha creado correctamente.',
      });

      await fetchCustomFields();
      return true;
    } catch (error: any) {
      console.error('Error creating custom field:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el campo personalizado',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateCustomField = async (id: string, formData: Partial<CustomFieldFormData>): Promise<boolean> => {
    if (!isOwner) {
      toast({
        title: "Sin permisos",
        description: "Solo los propietarios pueden editar campos personalizados.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('contact_custom_fields')
        .update({
          name: formData.name,
          data_type: formData.data_type,
          is_required: formData.is_required,
          is_visible_in_list: formData.is_visible_in_list,
          category: formData.category ?? null,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Campo actualizado",
        description: "El campo personalizado se ha actualizado correctamente.",
      });

      await fetchCustomFields();
      return true;
    } catch (error: any) {
      console.error('Error updating custom field:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el campo personalizado",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCustomField = async (id: string): Promise<boolean> => {
    if (!isOwner) {
      toast({
        title: "Sin permisos",
        description: "Solo los propietarios pueden eliminar campos personalizados.",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Check if field has values
      const { count, error: countError } = await supabase
        .from('contact_custom_field_values')
        .select('*', { count: 'exact', head: true })
        .eq('field_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast({
          title: "No se puede eliminar",
          description: "Este campo tiene datos asociados y no puede eliminarse. Primero elimina los valores de este campo en los contactos.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('contact_custom_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Campo eliminado",
        description: "El campo personalizado se ha eliminado correctamente.",
      });

      await fetchCustomFields();
      return true;
    } catch (error: any) {
      console.error('Error deleting custom field:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el campo personalizado",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    customFields,
    loading,
    isOwner,
    fetchCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
  };
}
