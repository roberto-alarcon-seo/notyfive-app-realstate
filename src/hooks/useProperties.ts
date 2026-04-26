import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { toast } from "sonner";

export interface Property {
  id: string;
  tenant_id: string;
  property_code: string;
  title: string;
  operation_type: string;
  property_type: string | null;
  zone: string;
  address: string | null;
  price: number;
  currency: string;
  status: string;
  is_active: boolean;
  assigned_user_id: string | null;
  template_id: string | null;
  ai_prompt: string | null;
  internal_notes: string | null;
  maintenance_fee: number | null;
  visit_availability: string | null;
  accepted_credits: string[] | null;
  youtube_url: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  sq_meters: number | null;
  ai_description_template: string | null;
  created_at: string;
  updated_at: string;
  cover_image?: string | null;
  assigned_user?: { name: string } | null;
  template?: { name: string } | null;
}

export interface PropertyFaq {
  id: string;
  tenant_id: string;
  property_id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
  source?: string;
}

export interface PropertyImage {
  id: string;
  tenant_id: string;
  property_id: string;
  file_url: string;
  file_path: string | null;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
  source?: string;
}

export interface PropertyDocument {
  id: string;
  tenant_id: string;
  property_id: string;
  file_url: string;
  file_path: string | null;
  file_name: string;
  file_type: string | null;
  created_at: string;
  source?: string;
}

export interface PropertyFilters {
  search?: string;
  zone?: string;
  status?: string;
  operation_type?: string;
  price_min?: number;
  price_max?: number;
}

export function useProperties(filters?: PropertyFilters) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ["properties", tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from("properties")
        .select(`
          *,
          assigned_user:profiles!properties_assigned_user_id_fkey(name),
          template:templates!properties_template_id_fkey(name)
        `)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,property_code.ilike.%${filters.search}%,zone.ilike.%${filters.search}%`
        );
      }
      if (filters?.zone) {
        query = query.eq("zone", filters.zone);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.operation_type) {
        query = query.eq("operation_type", filters.operation_type);
      }
      if (filters?.price_min !== undefined) {
        query = query.gte("price", filters.price_min);
      }
      if (filters?.price_max !== undefined) {
        query = query.lte("price", filters.price_max);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch cover images for each property
      const propertyIds = data?.map((p) => p.id) || [];
      if (propertyIds.length > 0) {
        const { data: images } = await supabase
          .from("property_images")
          .select("property_id, file_url")
          .in("property_id", propertyIds)
          .eq("is_cover", true);

        const coverMap = new Map(images?.map((img) => [img.property_id, img.file_url]));
        return data?.map((p) => ({
          ...p,
          cover_image: coverMap.get(p.id) || null,
        })) as Property[];
      }

      return data as Property[];
    },
    enabled: !!tenantId,
  });
}

export function useProperty(propertyId: string | undefined) {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(`
          *,
          assigned_user:profiles!properties_assigned_user_id_fkey(name),
          template:templates!properties_template_id_fkey(name)
        `)
        .eq("id", propertyId!)
        .single();

      if (error) throw error;
      return data as Property;
    },
    enabled: !!propertyId && !!tenantId,
  });
}

export function usePropertyFaq(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-faq", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_faq")
        .select("*")
        .eq("property_id", propertyId!)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as PropertyFaq[];
    },
    enabled: !!propertyId,
  });
}

export function usePropertyImages(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-images", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_images")
        .select("*")
        .eq("property_id", propertyId!)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as PropertyImage[];
    },
    enabled: !!propertyId,
  });
}

export function usePropertyDocuments(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-documents", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_documents")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PropertyDocument[];
    },
    enabled: !!propertyId,
  });
}

export function usePropertyZones() {
  const tenantId = useEffectiveTenantId();

  return useQuery({
    queryKey: ["property-zones", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("zone")
        .eq("tenant_id", tenantId!);

      if (error) throw error;
      const zones = [...new Set(data?.map((p) => p.zone))].filter(Boolean);
      return zones.sort();
    },
    enabled: !!tenantId,
  });
}

export function usePropertyMutations() {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  const createProperty = useMutation({
    mutationFn: async (property: Partial<Property>) => {
      const { data, error } = await supabase
        .from("properties")
        .insert({ ...property, tenant_id: tenantId! } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Propiedad creada exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al crear propiedad: ${error.message}`);
    },
  });

  const updateProperty = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Property> & { id: string }) => {
      const { data, error } = await supabase
        .from("properties")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", variables.id] });
      toast.success("Propiedad actualizada exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar propiedad: ${error.message}`);
    },
  });

  const deleteProperty = useMutation({
    mutationFn: async (id: string) => {
      // First, clear property references from contacts
      const { error: contactsError } = await supabase
        .from("contacts")
        .update({ re_property_interest_id: null })
        .eq("re_property_interest_id", id);
      
      if (contactsError) throw contactsError;

      // Remove property from viewed properties arrays
      const { data: contactsWithViewed } = await supabase
        .from("contacts")
        .select("id, re_properties_viewed_ids")
        .contains("re_properties_viewed_ids", [id]);

      if (contactsWithViewed && contactsWithViewed.length > 0) {
        for (const contact of contactsWithViewed) {
          const updatedIds = (contact.re_properties_viewed_ids || []).filter((pid: string) => pid !== id);
          await supabase
            .from("contacts")
            .update({ re_properties_viewed_ids: updatedIds })
            .eq("id", contact.id);
        }
      }

      // Delete related data (images, documents, faq)
      await supabase.from("property_images").delete().eq("property_id", id);
      await supabase.from("property_documents").delete().eq("property_id", id);
      await supabase.from("property_faq").delete().eq("property_id", id);

      // Finally delete the property
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Propiedad eliminada exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar propiedad: ${error.message}`);
    },
  });

  const duplicateProperty = useMutation({
    mutationFn: async (id: string) => {
      // Fetch original property
      const { data: original, error: fetchError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Create duplicate with new code
      const { id: _, created_at, updated_at, property_code, ...rest } = original;
      const newCode = `${property_code}-COPY-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase
        .from("properties")
        .insert({ ...rest, property_code: newCode, title: `${rest.title} (Copia)` })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Propiedad duplicada exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al duplicar propiedad: ${error.message}`);
    },
  });

  return { createProperty, updateProperty, deleteProperty, duplicateProperty };
}

export function usePropertyFaqMutations(propertyId: string) {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  const createFaq = useMutation({
    mutationFn: async (faq: Partial<PropertyFaq>) => {
      const { data, error } = await supabase
        .from("property_faq")
        .insert({ ...faq, property_id: propertyId, tenant_id: tenantId! } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-faq", propertyId] });
    },
  });

  const updateFaq = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PropertyFaq> & { id: string }) => {
      const { data, error } = await supabase
        .from("property_faq")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-faq", propertyId] });
    },
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_faq").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-faq", propertyId] });
    },
  });

  const reorderFaq = useMutation({
    mutationFn: async (faqs: { id: string; sort_order: number }[]) => {
      for (const faq of faqs) {
        const { error } = await supabase
          .from("property_faq")
          .update({ sort_order: faq.sort_order })
          .eq("id", faq.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-faq", propertyId] });
    },
  });

  return { createFaq, updateFaq, deleteFaq, reorderFaq };
}

export function usePropertyImageMutations(propertyId: string) {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  const addImage = useMutation({
    mutationFn: async (image: Partial<PropertyImage>) => {
      // Check if there are existing images with is_cover = true
      const { data: existingCover } = await supabase
        .from("property_images")
        .select("id")
        .eq("property_id", propertyId)
        .eq("is_cover", true)
        .limit(1);

      // If no cover exists, set this image as cover
      const shouldBeCover = !existingCover || existingCover.length === 0;

      const { data, error } = await supabase
        .from("property_images")
        .insert({ 
          ...image, 
          property_id: propertyId, 
          tenant_id: tenantId!,
          is_cover: shouldBeCover 
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-images", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });

  const updateImage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PropertyImage> & { id: string }) => {
      const { data, error } = await supabase
        .from("property_images")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-images", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-images", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });

  const setCover = useMutation({
    mutationFn: async (imageId: string) => {
      // First, unset all covers for this property
      await supabase
        .from("property_images")
        .update({ is_cover: false })
        .eq("property_id", propertyId);

      // Then set the new cover
      const { error } = await supabase
        .from("property_images")
        .update({ is_cover: true })
        .eq("id", imageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-images", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });

  return { addImage, updateImage, deleteImage, setCover };
}

export function usePropertyDocumentMutations(propertyId: string) {
  const queryClient = useQueryClient();
  const tenantId = useEffectiveTenantId();

  const addDocument = useMutation({
    mutationFn: async (doc: Partial<PropertyDocument>) => {
      const { data, error } = await supabase
        .from("property_documents")
        .insert({ ...doc, property_id: propertyId, tenant_id: tenantId! } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
    },
  });

  return { addDocument, deleteDocument };
}

export function useInterestedContacts(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["interested-contacts", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, email, lead_temperature, pipeline_stage")
        .eq("re_property_interest_id", propertyId!);

      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });
}
