import { Wifi, WifiOff, AlertTriangle, Phone, Loader2, MessageSquare, Wallet, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { Badge } from "@/components/ui/badge";
import { useTwilioIntegration } from "@/hooks/useTwilioIntegration";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsWhatsAppStatus() {
  const { integration, isLoading: twilioLoading, isConnected } = useTwilioIntegration();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('verify-whatsapp-sender', {
        body: {},
      });
      if (error) throw error;
      return data as { ok: boolean; status: string | null; error?: string | null };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['twilio-integration', profile?.tenant_id] });
      if (res.ok) {
        toast.success('WhatsApp Sender verificado correctamente');
      } else {
        toast.error(res.error || `Sender no aprobado (estado: ${res.status ?? 'desconocido'})`);
      }
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al verificar el WhatsApp Sender');
    },
  });

  const isLoading = twilioLoading || walletLoading;

  const getStatusInfo = () => {
    if (!integration) {
      return {
        icon: WifiOff,
        label: "Sin configurar",
        color: "text-muted-foreground",
        bgColor: "bg-muted/50",
        badgeVariant: "outline" as const,
      };
    }

    switch (integration.status) {
      case 'connected':
        return {
          icon: Wifi,
          label: "Conectado",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          badgeVariant: "default" as const,
        };
      case 'error':
        return {
          icon: AlertTriangle,
          label: "Error de conexión",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          badgeVariant: "destructive" as const,
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          label: "Desconectado",
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          badgeVariant: "outline" as const,
        };
      default:
        return {
          icon: WifiOff,
          label: "Pendiente",
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          badgeVariant: "secondary" as const,
        };
    }
  };

  const getWalletStatusInfo = () => {
    if (!wallet) {
      return { label: 'Sin wallet', color: 'text-muted-foreground', bgColor: 'bg-muted/50', icon: AlertTriangle };
    }
    switch (wallet.status) {
      case 'active':
        return { label: 'Activo', color: 'text-success', bgColor: 'bg-success/10', icon: CheckCircle2 };
      case 'low':
        return { label: 'Saldo bajo', color: 'text-warning', bgColor: 'bg-warning/10', icon: AlertTriangle };
      case 'blocked':
        return { label: 'Bloqueado', color: 'text-destructive', bgColor: 'bg-destructive/10', icon: AlertTriangle };
    }
  };

  if (isLoading) {
    return (
      <SettingsLayout
        title="WhatsApp"
        description="Estado de tu conexión de WhatsApp"
        icon={MessageSquare}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SettingsLayout>
    );
  }

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const walletStatus = getWalletStatusInfo();
  const WalletStatusIcon = walletStatus.icon;

  return (
    <SettingsLayout
      title="WhatsApp"
      description="Estado de tu conexión de WhatsApp y mensajes disponibles"
      icon={MessageSquare}
    >
      <div className="space-y-6 max-w-2xl">
        {/* Status Card */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${statusInfo.bgColor}`}>
                <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-foreground">Estado de WhatsApp</h3>
                  <Badge 
                    variant={statusInfo.badgeVariant}
                    className={statusInfo.badgeVariant === 'default' ? 'bg-green-500/20 text-green-500 border-green-500/30' : ''}
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
                
                {isConnected && integration ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Tu cuenta de WhatsApp está activa y lista para enviar mensajes.
                    </p>
                    
                    {/* Phone Number Display */}
                    {integration.phone_number && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                        <Phone className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {integration.phone_number_name || 'Número de WhatsApp'}
                          </p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {integration.phone_number}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sender Verification Block */}
                    {integration.phone_number && !integration.messaging_service_sid && (() => {
                      const status = (integration.whatsapp_sender_status || '').toLowerCase();
                      const isApproved = ['online', 'approved', 'verified'].includes(status);
                      const verifiedAt = integration.whatsapp_sender_verified_at
                        ? new Date(integration.whatsapp_sender_verified_at)
                        : null;
                      return (
                        <div className={`p-3 rounded-lg border flex items-start gap-3 ${
                          isApproved
                            ? 'bg-green-500/10 border-green-500/30'
                            : status
                              ? 'bg-destructive/10 border-destructive/30'
                              : 'bg-muted/30 border-border'
                        }`}>
                          {isApproved ? (
                            <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${status ? 'text-destructive' : 'text-muted-foreground'}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {isApproved
                                ? 'Sender aprobado en Twilio'
                                : status === 'not_found'
                                  ? 'Número no encontrado en Twilio'
                                  : status
                                    ? `Sender no aprobado (${status})`
                                    : 'Sender no verificado'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {integration.whatsapp_sender_error
                                ?? (verifiedAt
                                  ? `Última verificación: ${verifiedAt.toLocaleString('es-MX')}`
                                  : 'Sin verificaciones recientes. Las campañas se bloquearán hasta validar el número.')}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verifyMutation.mutate()}
                            disabled={verifyMutation.isPending}
                          >
                            {verifyMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1.5">Verificar</span>
                          </Button>
                        </div>
                      );
                    })()}
                    
                    {/* Messaging Service Display (when no direct number) */}
                    {integration.messaging_service_sid && !integration.phone_number && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {integration.phone_number_name || 'Messaging Service'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Configurado vía Messaging Service
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    WhatsApp no está configurado para tu cuenta. Contacta a soporte para activar esta función.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet / Balance Card - Read Only */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${walletStatus.bgColor}`}>
                <Wallet className={`h-6 w-6 ${walletStatus.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-foreground">Mensajes Disponibles</h3>
                      <Badge variant="outline" className={`${walletStatus.color} border-current`}>
                        <WalletStatusIcon className="h-3 w-3 mr-1" />
                        {walletStatus.label}
                      </Badge>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {wallet ? wallet.balance_messages.toLocaleString('es-MX') : '0'}
                      <span className="text-lg text-muted-foreground ml-2">mensajes</span>
                    </p>
                  </div>
                </div>

                {/* Low balance warning */}
                {wallet?.status === 'low' && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Saldo bajo</p>
                      <p className="text-xs text-muted-foreground">
                        Contacta al administrador para recargar tu cuenta.
                      </p>
                    </div>
                  </div>
                )}

                {/* Blocked warning */}
                {wallet?.status === 'blocked' && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Cuenta bloqueada</p>
                      <p className="text-xs text-muted-foreground">
                        No puedes enviar ni recibir mensajes. Contacta al administrador.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h4 className="font-medium text-foreground mb-2">¿Cómo funciona?</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Cada mensaje que envíes o recibas consume 1 crédito de tu wallet.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Mensajes entrantes (1 crédito)
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Mensajes salientes (1 crédito)
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Campañas masivas (1 crédito por mensaje)
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Usuarios y contactos ilimitados
            </li>
          </ul>
        </div>

        {/* Support Info */}
        <div className="bg-muted/30 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Para recargar mensajes, contacta al administrador de NotyFive.{" "}
            <a href="mailto:soporte@notyfive.com" className="text-primary hover:underline">
              Contacta a soporte
            </a>{" "}
            si tienes preguntas.
          </p>
        </div>
      </div>
    </SettingsLayout>
  );
}
