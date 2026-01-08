import { useState, useEffect } from 'react';
import { MessageSquare, Phone, Link2, CheckCircle2, AlertCircle, XCircle, Clock, AlertTriangle, Settings, Copy, RefreshCw, Building2, Key, Hash, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TwilioConfigDialog } from './TwilioConfigDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TenantWhatsAppTabProps {
  tenantId: string;
  tenantName: string;
}

interface TenantIntegration {
  id: string;
  status: string;
  account_sid: string | null;
  auth_token_encrypted: string | null;
  phone_number: string | null;
  phone_number_name: string | null;
  messaging_service_sid: string | null;
  webhook_url: string | null;
  updated_at: string;
}

// Helper to get display phone or messaging service
const getWhatsAppDisplay = (integration: TenantIntegration | null) => {
  if (!integration) return { number: null, name: null };
  
  if (integration.messaging_service_sid) {
    return { 
      number: `MS: ${integration.messaging_service_sid.substring(0, 8)}...`,
      name: integration.phone_number_name || 'Messaging Service'
    };
  }
  
  return {
    number: integration.phone_number,
    name: integration.phone_number_name
  };
};

export function TenantWhatsAppTab({ tenantId, tenantName }: TenantWhatsAppTabProps) {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [integration, setIntegration] = useState<TenantIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIntegration = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'twilio')
      .maybeSingle();

    if (!error && data) {
      setIntegration(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIntegration();
  }, [tenantId]);

  const isConfigured = integration?.status === 'connected';

  const handleCopyWebhook = () => {
    if (integration?.webhook_url) {
      navigator.clipboard.writeText(integration.webhook_url);
      toast.success('Webhook URL copiada');
    }
  };

  const handleTestConnection = async () => {
    if (!integration?.account_sid) {
      toast.error('No hay configuración de Twilio');
      return;
    }

    toast.info('Probando conexión con Twilio...');

    try {
      // Decode auth token (base64)
      const authToken = integration.auth_token_encrypted ? atob(integration.auth_token_encrypted) : null;

      if (!authToken) {
        toast.error('Token de autenticación no disponible');
        return;
      }

      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: {
          accountSid: integration.account_sid,
          authToken: authToken,
        },
      });

      if (error || !data?.isValid) {
        toast.error('Error de conexión con Twilio');
        return;
      }

      toast.success(`Conexión exitosa: ${data.account?.name}`);
    } catch (err) {
      toast.error('Error al probar conexión');
    }
  };

  const handleDialogClose = (open: boolean) => {
    setConfigDialogOpen(open);
    if (!open) {
      // Refetch integration data when dialog closes
      fetchIntegration();
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return { icon: CheckCircle2, label: 'Conectado', color: 'text-success', bg: 'bg-success/10' };
      case 'error':
        return { icon: AlertCircle, label: 'Error', color: 'text-destructive', bg: 'bg-destructive/10' };
      case 'disconnected':
        return { icon: XCircle, label: 'Desconectado', color: 'text-muted-foreground', bg: 'bg-muted' };
      case 'pending_setup':
      default:
        return { icon: AlertCircle, label: 'Sin configurar', color: 'text-warning', bg: 'bg-warning/10' };
    }
  };

  const maskSid = (sid: string | null) => {
    if (!sid) return 'No configurado';
    if (sid.length <= 8) return sid;
    return `${sid.substring(0, 2)}${'*'.repeat(10)}${sid.substring(sid.length - 4)}`;
  };

  const statusConfig = getStatusConfig(integration?.status || 'pending_setup');
  const StatusIcon = statusConfig.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner with Actions */}
      <div className={`${statusConfig.bg} border border-border rounded-xl p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
              <StatusIcon className={`h-6 w-6 ${statusConfig.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado de Conexión</p>
              <p className={`text-lg font-medium ${statusConfig.color}`}>{statusConfig.label}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isConfigured && (
              <Button variant="outline" size="sm" onClick={handleTestConnection}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Probar conexión
              </Button>
            )}
            <Button 
              onClick={() => setConfigDialogOpen(true)}
              className="gradient-primary"
              size="sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              {isConfigured ? 'Modificar cuenta' : 'Configurar cuenta'}
            </Button>
          </div>
        </div>
      </div>

      {isConfigured && integration && (
        <>
          {/* Account Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-foreground">Cuenta Twilio</h3>
              <Badge variant="outline" className="text-xs">Conectada</Badge>
            </div>
            
            {/* Show account name prominently */}
            {integration.phone_number_name && (
              <div className="mb-3 p-3 bg-background/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Nombre de cuenta</p>
                <p className="text-lg font-semibold text-foreground">{integration.phone_number_name}</p>
              </div>
            )}
            
            {/* Show WhatsApp number if available */}
            {integration.phone_number && (
              <div className="mb-3 p-3 bg-background/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Número WhatsApp</p>
                <p className="text-lg font-semibold text-primary">{integration.phone_number}</p>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              Todas las operaciones de WhatsApp (mensajes, plantillas, webhooks) están vinculadas a esta cuenta.
            </p>
          </div>

          {/* Configuration Details */}
          <div className="bg-secondary/30 border border-border rounded-xl p-5">
            <h3 className="font-medium text-foreground mb-4">Configuración Twilio</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Account SID</span>
                </div>
                <code className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {maskSid(integration.account_sid)}
                </code>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Auth Token</span>
                </div>
                <code className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  ••••••••••••••••
                </code>
              </div>

              {integration.messaging_service_sid && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Messaging Service SID</span>
                  </div>
                  <code className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {maskSid(integration.messaging_service_sid)}
                  </code>
                </div>
              )}

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Webhook URL</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded max-w-[200px] truncate">
                    {integration.webhook_url || 'No configurado'}
                  </code>
                  {integration.webhook_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyWebhook}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Last Update */}
          <div className="bg-secondary/30 border border-border rounded-xl p-5">
            <h3 className="font-medium text-foreground mb-4">Información</h3>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Última actualización</span>
              </div>
              <span className="text-sm text-foreground">
                {new Date(integration.updated_at).toLocaleString('es-MX')}
              </span>
            </div>
          </div>
        </>
      )}

      {!isConfigured && (
        <div className="bg-muted/30 border border-border rounded-xl p-8 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Twilio no configurado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configura las credenciales de Twilio para habilitar el envío de mensajes de WhatsApp para este tenant.
          </p>
          <Button onClick={() => setConfigDialogOpen(true)} className="gradient-primary">
            <Settings className="h-4 w-4 mr-2" />
            Configurar Twilio
          </Button>
        </div>
      )}

      {/* Twilio Config Dialog */}
      <TwilioConfigDialog
        open={configDialogOpen}
        onOpenChange={handleDialogClose}
        tenantId={tenantId}
        tenantName={tenantName}
      />
    </div>
  );
}