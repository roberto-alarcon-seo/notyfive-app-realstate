import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TwilioMessagingService {
  sid: string;
  name: string;
  dateCreated: string;
}

interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}

interface ValidateResponse {
  isValid: boolean;
  account?: {
    name: string;
    status: string;
    type: string;
  };
  messagingServices?: TwilioMessagingService[];
  phoneNumbers?: TwilioPhoneNumber[];
  error?: string;
  warning?: string;
}

interface SaveResponse {
  success: boolean;
  integration?: {
    id: string;
    webhookUrl: string;
    accountName: string;
    status: string;
  };
  error?: string;
}

interface TenantIntegration {
  id: string;
  tenant_id: string;
  provider: string;
  account_sid: string | null;
  auth_token_encrypted: string | null;
  messaging_service_sid: string | null;
  phone_number: string | null;
  phone_number_name: string | null;
  webhook_url: string | null;
  balance: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  whatsapp_sender_status?: string | null;
  whatsapp_sender_verified_at?: string | null;
  whatsapp_sender_error?: string | null;
}

export function useTwilioIntegration() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch existing integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['twilio-integration', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'twilio')
        .maybeSingle();

      if (error) {
        console.error('Error fetching Twilio integration:', error);
        throw error;
      }

      return data as TenantIntegration | null;
    },
    enabled: !!profile?.tenant_id,
  });

  // Validate credentials and fetch resources
  const validateMutation = useMutation({
    mutationFn: async ({ accountSid, authToken }: { accountSid: string; authToken: string }): Promise<ValidateResponse> => {
      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: { accountSid, authToken },
      });

      if (error) {
        throw new Error(error.message || 'Error al validar las credenciales');
      }

      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Save integration
  const saveMutation = useMutation({
    mutationFn: async ({ 
      accountSid,
      authToken,
      selectedService,
      selectedNumber,
    }: { 
      accountSid: string;
      authToken: string;
      selectedService?: TwilioMessagingService | null;
      selectedNumber?: TwilioPhoneNumber | null;
    }): Promise<SaveResponse> => {
      if (!profile?.tenant_id) {
        throw new Error('No se encontró el tenant');
      }

      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: { 
          accountSid,
          authToken,
          action: 'save',
          tenantId: profile.tenant_id,
          selectedService,
          selectedNumber,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error al guardar la integración');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twilio-integration'] });
      toast.success('Integración con Twilio guardada correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Disconnect integration
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) {
        throw new Error('No se encontró el tenant');
      }

      const { error } = await supabase
        .from('tenant_integrations')
        .update({ status: 'disconnected' })
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'twilio');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twilio-integration'] });
      toast.success('Integración con Twilio desconectada');
    },
    onError: () => {
      toast.error('Error al desconectar la integración');
    },
  });

  // Test connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!integration?.account_sid || !integration?.auth_token_encrypted) {
        throw new Error('No hay credenciales configuradas');
      }

      // Decode the auth token
      const authToken = atob(integration.auth_token_encrypted);
      
      const response = await validateMutation.mutateAsync({
        accountSid: integration.account_sid,
        authToken,
      });

      if (!response.isValid) {
        throw new Error(response.error || 'La conexión falló');
      }

      return response;
    },
    onSuccess: () => {
      toast.success('Conexión exitosa con Twilio');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    integration,
    isLoading,
    isConnected: integration?.status === 'connected',
    validateCredentials: validateMutation.mutateAsync,
    isValidating: validateMutation.isPending,
    saveIntegration: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    testConnection: testConnectionMutation.mutateAsync,
    isTesting: testConnectionMutation.isPending,
  };
}
