import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ApiToken {
  id: string;
  name: string;
  description: string | null;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export const ALL_SCOPES = [
  { value: "contacts:read", label: "Leer contactos", description: "Ver lista de contactos y detalles" },
  { value: "contacts:write", label: "Escribir contactos", description: "Crear, actualizar y eliminar contactos" },
  { value: "fields:read", label: "Leer campos", description: "Ver campos personalizados" },
] as const;

export function useApiTokens(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  // Si el flag está desactivado, no cargamos nada y reportamos isLoading=false.
  const [loading, setLoading] = useState<boolean>(enabled);
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Guard temprano: si el feature flag no está activo, NO conectamos con Supabase.
  // Mantiene el hook callable pero inerte para evitar errores de permisos.

  const fetchTokens = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("api-tokens", {
        method: "GET",
      });

      if (response.error) throw response.error;
      setTokens(response.data?.items || []);
    } catch (error: any) {
      console.error("Error fetching tokens:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los tokens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, enabled]);

  useEffect(() => {
    if (enabled) {
      fetchTokens();
    } else {
      // Reset a estado vacío inmediato si el flag se apaga en caliente.
      setTokens([]);
      setLoading(false);
    }
  }, [fetchTokens, enabled]);

  const createToken = async (params: {
    name: string;
    description?: string;
    scopes: string[];
    expires_at?: string | null;
  }) => {
    try {
      setOneTimeToken(null);
      
      const response = await supabase.functions.invoke("api-tokens", {
        method: "POST",
        body: params,
      });

      if (response.error) throw response.error;
      
      if (response.data?.error) {
        toast({
          title: "Error",
          description: response.data.error,
          variant: "destructive",
        });
        return null;
      }

      setOneTimeToken(response.data.token);
      await fetchTokens();
      
      toast({
        title: "Token creado",
        description: "Copia el token ahora, no se mostrará de nuevo",
      });

      return response.data;
    } catch (error: any) {
      console.error("Error creating token:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el token",
        variant: "destructive",
      });
      return null;
    }
  };

  const rotateToken = async (tokenId: string) => {
    try {
      setOneTimeToken(null);

      const response = await supabase.functions.invoke(`api-tokens/${tokenId}/rotate`, {
        method: "POST",
      });

      if (response.error) throw response.error;

      setOneTimeToken(response.data.token);
      await fetchTokens();

      toast({
        title: "Token rotado",
        description: "Copia el nuevo token ahora, no se mostrará de nuevo",
      });

      return response.data;
    } catch (error: any) {
      console.error("Error rotating token:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo rotar el token",
        variant: "destructive",
      });
      return null;
    }
  };

  const toggleToken = async (tokenId: string, is_active: boolean) => {
    try {
      const response = await supabase.functions.invoke(`api-tokens/${tokenId}/toggle`, {
        method: "POST",
        body: { is_active },
      });

      if (response.error) throw response.error;

      await fetchTokens();

      toast({
        title: is_active ? "Token activado" : "Token desactivado",
        description: is_active 
          ? "El token ahora puede usarse para autenticación" 
          : "El token ya no puede usarse para autenticación",
      });

      return true;
    } catch (error: any) {
      console.error("Error toggling token:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el token",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteToken = async (tokenId: string) => {
    try {
      const response = await supabase.functions.invoke(`api-tokens/${tokenId}`, {
        method: "DELETE",
      });

      if (response.error) throw response.error;

      await fetchTokens();

      toast({
        title: "Token eliminado",
        description: "El token ha sido eliminado permanentemente",
      });

      return true;
    } catch (error: any) {
      console.error("Error deleting token:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el token",
        variant: "destructive",
      });
      return false;
    }
  };

  const clearOneTimeToken = () => setOneTimeToken(null);

  return {
    tokens,
    loading,
    oneTimeToken,
    fetchTokens,
    createToken,
    rotateToken,
    toggleToken,
    deleteToken,
    clearOneTimeToken,
  };
}
