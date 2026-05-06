import { useState, useEffect } from 'react';
import { MessageSquare, Phone, Link2, CheckCircle2, AlertCircle, XCircle, Clock, Settings, Copy, RefreshCw, Building2, Key, Hash, Loader2, Wand2, ExternalLink, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TwilioConfigDialog } from './TwilioConfigDialog';
import { ReplaceTwilioCredentialsDialog } from './ReplaceTwilioCredentialsDialog';
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
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [integration, setIntegration] = useState<TenantIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

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
  const isPendingSubaccount =
    !!integration &&
    (integration as any).is_subaccount === true &&
    integration.status !== 'connected';

  const E164 = /^\+[1-9]\d{6,14}$/;

  const validatePhone = (value: string): string | null => {
    if (!value.trim()) return 'Ingresa un número de teléfono';
    if (!E164.test(value.trim())) return 'Formato inválido. Usa E.164 (ej. +5215512345678)';
    return null;
  };

  const handleLinkPhone = async () => {
    const err = validatePhone(phoneInput);
    if (err) { setPhoneError(err); return; }
    setPhoneError(null);
    setLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-twilio-subaccount', {
        body: { action: 'link_phone', tenant_id: tenantId, phone_number: phoneInput.trim() },
      });
      if (error) throw error;

      const wa = data?.whatsapp_sender as
        | {
            registered?: boolean;
            already_exists?: boolean;
            requires_verification?: boolean;
            message?: string;
          }
        | undefined;

      if (wa?.requires_verification) {
        toast.info(
          wa.message ||
            'Registro iniciado. Verifica el código enviado o aprueba la solicitud en Facebook Business Manager.',
          { duration: 8000 },
        );
      } else if (wa?.registered) {
        toast.success('Línea vinculada correctamente. Iniciando proceso de aprobación con Meta');
      } else if (wa?.already_exists) {
        toast.success('El número ya estaba registrado. Webhook actualizado correctamente');
      } else if (data?.webhook_configured) {
        toast.success('Teléfono vinculado y webhook configurado automáticamente');
      } else {
        toast.success('Teléfono guardado. Asigna el número en Twilio para activar el webhook');
      }

      // Surface secondary advisories from Twilio when present
      if (wa?.message && !wa.requires_verification && !wa.registered && !wa.already_exists) {
        toast.warning(wa.message, { duration: 8000 });
      }

      setPhoneInput('');
      await fetchIntegration();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo vincular el teléfono');
    } finally {
      setLinking(false);
    }
  };

  const handleAutoProvision = async () => {
    setProvisioning(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-twilio-subaccount', {
        body: { action: 'create', tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.already_provisioned) {
        toast.info('Esta cuenta ya tiene una subcuenta aprovisionada');
      } else {
        toast.success('Subcuenta Twilio creada correctamente');
      }
      await fetchIntegration();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo crear la subcuenta');
    } finally {
      setProvisioning(false);
    }
  };

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
      {/* Status Banner — only show when there's an integration */}
      {integration && (
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
            {isConfigured && (
              <Button
                onClick={() => setConfigDialogOpen(true)}
                variant="outline"
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Modificar cuenta
              </Button>
            )}
            {integration && (
              <Button
                onClick={() => setReplaceDialogOpen(true)}
                variant="outline"
                size="sm"
                className="border-warning/40 text-warning hover:text-warning hover:bg-warning/10"
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Reemplazar credenciales
              </Button>
            )}
          </div>
        </div>
      </div>
      )}

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
        <>
          {/* CASE A: No integration at all → elegant empty state */}
          {!integration && (
            <div className="border border-border rounded-2xl p-12 text-center bg-gradient-to-b from-primary/5 to-transparent">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Configuración de WhatsApp
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Crearemos automáticamente una subcuenta Twilio aislada para <span className="font-medium text-foreground">{tenantName}</span> y configuraremos el webhook de mensajes entrantes. Solo necesitarás vincular el número de WhatsApp al final.
              </p>
              <Button
                onClick={handleAutoProvision}
                disabled={provisioning}
                size="lg"
                className="gradient-primary"
              >
                {provisioning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Iniciando configuración…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Iniciar Configuración Automática
                  </>
                )}
              </Button>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setConfigDialogOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  ¿Ya tienes una cuenta propia? Configurar manualmente
                </button>
              </div>
            </div>
          )}

          {/* CASE B: Subaccount provisioned, awaiting phone link */}
          {isPendingSubaccount && integration?.account_sid && (
            <div className="border border-border rounded-2xl p-8 bg-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Vincular Teléfono</h2>
                  <p className="text-sm text-muted-foreground">Subcuenta creada. Falta asociar el número de WhatsApp.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Account SID generado</Label>
                  <Input
                    value={integration.account_sid}
                    readOnly
                    className="font-mono text-sm bg-muted/50"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs text-muted-foreground">
                    Número de WhatsApp (formato E.164)
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+5215512345678"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      if (phoneError) setPhoneError(validatePhone(e.target.value));
                    }}
                    onBlur={(e) => setPhoneError(validatePhone(e.target.value))}
                    className={phoneError ? 'border-destructive' : ''}
                  />
                  {phoneError && (
                    <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {phoneError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Debe estar previamente comprado/aprobado en Twilio dentro de esta subcuenta.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleLinkPhone}
                    disabled={linking || !phoneInput.trim()}
                    className="gradient-primary"
                  >
                    {linking ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Registrando con Twilio…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Verificar y Activar
                      </>
                    )}
                  </Button>
                  <a
                    href={`https://console.twilio.com/?accountSid=${integration.account_sid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir Twilio Console
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* CASE C: Integration exists but not subaccount (manual/legacy) and not connected */}
          {integration && !isPendingSubaccount && (
            <div className="bg-muted/30 border border-border rounded-xl p-6 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-medium text-foreground mb-1">Completar configuración</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Termina la configuración manual de Twilio para activar la integración.
              </p>
              <Button onClick={() => setConfigDialogOpen(true)} variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configurar manualmente
              </Button>
            </div>
          )}
        </>
      )}

      {/* Twilio Config Dialog */}
      <TwilioConfigDialog
        open={configDialogOpen}
        onOpenChange={handleDialogClose}
        tenantId={tenantId}
        tenantName={tenantName}
      />

      {/* Replace Credentials Dialog */}
      <ReplaceTwilioCredentialsDialog
        open={replaceDialogOpen}
        onOpenChange={setReplaceDialogOpen}
        tenantId={tenantId}
        tenantName={tenantName}
        current={integration}
        onReplaced={fetchIntegration}
      />
    </div>
  );
}