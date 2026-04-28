import { useEffect, useState } from 'react';
import { MessageSquare, Phone, Crown, CheckCircle2, XCircle, AlertCircle, Loader2, Gift, CreditCard, Mail, User, RefreshCw, ExternalLink, Copy, Users, Lock, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { getCreditStatus } from '@/hooks/useTenantCredits';
import { toast } from 'sonner';
import { TenantFeatureFlagsCard } from './TenantFeatureFlagsCard';

interface Tenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  billing_state?: string;
  message_credits?: number;
  initial_credits_granted?: boolean;
  external_id?: string | null;
  managed_externally?: boolean;
  max_users?: number;
  partner_id?: string | null;
}

interface TenantIntegration {
  id: string;
  status: string;
  phone_number: string | null;
  phone_number_name: string | null;
  messaging_service_sid: string | null;
}

interface TenantOwner {
  id: string;
  name: string;
  email: string;
  status: string;
  first_login_required: boolean;
  invited_at: string | null;
}

interface TenantOverviewTabProps {
  tenant: Tenant;
  onTenantUpdate?: () => void;
}

export function TenantOverviewTab({ tenant, onTenantUpdate }: TenantOverviewTabProps) {
  const [integration, setIntegration] = useState<TenantIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<TenantOwner[]>([]);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [inviteFallback, setInviteFallback] = useState<{
    email: string;
    activationLink: string;
    emailId: string | null;
  } | null>(null);
  const [billingData, setBillingData] = useState<{
    billing_state: string;
    message_credits: number;
    initial_credits_granted: boolean;
  } | null>(null);
  const [showOnboardingConfirm, setShowOnboardingConfirm] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [maxUsersValue, setMaxUsersValue] = useState<string>(String(tenant.max_users ?? 1));
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [savingMaxUsers, setSavingMaxUsers] = useState(false);

  const fetchBillingData = async () => {
    const { data, error } = await supabase
      .from('tenants')
      .select('billing_state, message_credits, initial_credits_granted')
      .eq('id', tenant.id)
      .single();
    
    if (!error && data) {
      setBillingData(data);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch integration, billing data, and owners in parallel
      const [integrationResult, ownersResult] = await Promise.all([
        supabase
          .from('tenant_integrations')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('provider', 'twilio')
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('id, name, email, status, first_login_required, invited_at')
          .eq('tenant_id', tenant.id),
      ]);

      if (!integrationResult.error && integrationResult.data) {
        setIntegration(integrationResult.data);
      }

      if (!ownersResult.error && ownersResult.data) {
        // Filter to get owners (check user_roles)
        const ownerIds = ownersResult.data.map(p => p.id);
        if (ownerIds.length > 0) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('user_id', ownerIds)
            .eq('tenant_role', 'owner');
          
          const ownerUserIds = new Set(roles?.map(r => r.user_id) || []);
          setOwners(ownersResult.data.filter(p => ownerUserIds.has(p.id)) as TenantOwner[]);
        }
        // Count active non-owner/non-admin users (matches limit logic)
        const ownerIdsAll = ownersResult.data.map(p => p.id);
        if (ownerIdsAll.length > 0) {
          const { data: rolesAll } = await supabase
            .from('user_roles')
            .select('user_id, tenant_role')
            .in('user_id', ownerIdsAll);
          const exemptIds = new Set(
            (rolesAll || [])
              .filter((r) => r.tenant_role === 'owner' || r.tenant_role === 'administrador')
              .map((r) => r.user_id),
          );
          const activeCount = ownersResult.data.filter(
            (p) => p.status === 'active' && !exemptIds.has(p.id),
          ).length;
          setActiveUsersCount(activeCount);
        }
      }

      setLoading(false);
    };

    fetchData();
    fetchBillingData();
  }, [tenant.id]);

  useEffect(() => {
    setMaxUsersValue(String(tenant.max_users ?? 1));
  }, [tenant.max_users]);

  const handleSaveMaxUsers = async () => {
    const parsed = parseInt(maxUsersValue, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 1000) {
      toast.error('El límite debe ser un entero entre 1 y 1000');
      return;
    }
    setSavingMaxUsers(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ max_users: parsed })
        .eq('id', tenant.id);
      if (error) {
        toast.error(error.message || 'Error al actualizar límite de usuarios');
        return;
      }
      toast.success('Límite de usuarios actualizado');
      onTenantUpdate?.();
    } catch (err) {
      console.error('Error updating max_users:', err);
      toast.error('Error inesperado');
    } finally {
      setSavingMaxUsers(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    setResendingInvite(userId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-invite-owner/resend', {
        body: { userId },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || 'Error al reenviar invitación');
        return;
      }

      toast.success('Invitación reenviada');

      if (data?.activationLink && data?.message) {
        // Fallback: show activation link so testing can proceed even if email delivery is delayed/blocked.
        setInviteFallback({
          email: owners.find((o) => o.id === userId)?.email || '—',
          activationLink: data.activationLink,
          emailId: data.emailId ?? null,
        });
      }
    } catch (err) {
      console.error('Resend invite error:', err);
      toast.error('Error al reenviar invitación');
    } finally {
      setResendingInvite(null);
    }
  };

  const handleCompleteOnboarding = async () => {
    setCompletingOnboarding(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-complete-onboarding', {
        body: { tenantId: tenant.id },
      });

      if (error) {
        console.error('Error completing onboarding:', error);
        toast.error('Error al completar onboarding');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Onboarding completado - 1,000 créditos asignados');
      await fetchBillingData();
      onTenantUpdate?.();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Error inesperado');
    } finally {
      setCompletingOnboarding(false);
      setShowOnboardingConfirm(false);
    }
  };

  const whatsappStatus = integration?.status === 'connected' ? 'connected' : 
                         integration?.status === 'error' ? 'error' : 'disconnected';
  const whatsappNumber = integration?.phone_number || 'No configurado';

  const getStatusConfig = (status: 'connected' | 'error' | 'disconnected') => {
    switch (status) {
      case 'connected':
        return { icon: CheckCircle2, label: 'Conectado', color: 'text-success', bg: 'bg-success/10' };
      case 'error':
        return { icon: AlertCircle, label: 'Error', color: 'text-destructive', bg: 'bg-destructive/10' };
      case 'disconnected':
        return { icon: XCircle, label: 'Desconectado', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
  };

  const getWalletStatusConfig = (status: 'active' | 'low' | 'blocked') => {
    switch (status) {
      case 'active':
        return { label: 'Activo', color: 'text-success', bg: 'bg-success/10' };
      case 'low':
        return { label: 'Bajo', color: 'text-warning', bg: 'bg-warning/10' };
      case 'blocked':
        return { label: 'Bloqueado', color: 'text-destructive', bg: 'bg-destructive/10' };
    }
  };

  const getBillingStateConfig = (state?: string) => {
    switch (state) {
      case 'ONBOARDING_PAID':
        return { label: 'Onboarding Pagado', color: 'text-warning', bg: 'bg-warning/10' };
      case 'ACTIVE_WITH_CREDITS':
        return { label: 'Activo con Créditos', color: 'text-success', bg: 'bg-success/10' };
      case 'CREDITS_EXHAUSTED':
        return { label: 'Créditos Agotados', color: 'text-destructive', bg: 'bg-destructive/10' };
      case 'SUBSCRIPTION_REQUIRED':
        return { label: 'Requiere Suscripción', color: 'text-destructive', bg: 'bg-destructive/10' };
      case 'SUBSCRIBED_ACTIVE':
        return { label: 'Suscripción Activa', color: 'text-success', bg: 'bg-success/10' };
      default:
        return { label: state || 'Desconocido', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
  };

  const statusConfig = getStatusConfig(whatsappStatus);
  const StatusIcon = statusConfig.icon;
  
  // Use billingData.message_credits as single source of truth for credit status
  const creditStatus = billingData ? getCreditStatus(billingData.message_credits, billingData.billing_state) : 'blocked';
  const walletConfig = getWalletStatusConfig(creditStatus);
  const billingStateConfig = getBillingStateConfig(billingData?.billing_state);

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      trial: 'Trial',
      starter: 'Starter',
      growth: 'Growth',
      pro: 'Pro',
      enterprise: 'Enterprise',
    };
    return labels[plan] || plan;
  };

  const getPlanDescription = (plan: string) => {
    const descriptions: Record<string, string> = {
      trial: 'Funciones básicas',
      starter: 'Para equipos pequeños',
      growth: 'IA + Automatización',
      pro: 'IA avanzada + Soporte prioritario',
      enterprise: 'Todas las funciones + Soporte dedicado',
    };
    return descriptions[plan] || '';
  };

  const canCompleteOnboarding = billingData?.billing_state === 'ONBOARDING_PAID' && !billingData?.initial_credits_granted;
  const isExternallyManaged = !!tenant.managed_externally;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* External management notice */}
      {isExternallyManaged && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3">
          <ExternalLink className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Gestionado por Sistema Core</p>
            <p className="text-xs text-muted-foreground mt-1">
              Este tenant se sincroniza desde un sistema externo. Los flujos de suscripción
              de Stripe están deshabilitados.
            </p>
            {tenant.external_id && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">External ID:</span>
                <code className="text-xs bg-background/60 px-2 py-0.5 rounded border border-border text-foreground">
                  {tenant.external_id}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tenant.external_id || '');
                      toast.success('External ID copiado');
                    } catch {
                      toast.error('No se pudo copiar');
                    }
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* WhatsApp Status */}
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
              <MessageSquare className={`h-5 w-5 ${statusConfig.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado WhatsApp</p>
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                <span className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Number */}
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Número Activo</p>
              <p className="font-medium text-foreground">{whatsappNumber}</p>
            </div>
          </div>
        </div>

        {/* Wallet Balance - Message Based */}
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${walletConfig.bg}`}>
              <CreditCard className={`h-5 w-5 ${walletConfig.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensajes Disponibles</p>
              <p className="font-medium text-foreground">
                {billingData ? billingData.message_credits.toLocaleString('es-MX') : '0'} mensajes
              </p>
              <Badge variant="outline" className={`text-xs mt-1 ${walletConfig.color}`}>
                {walletConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Crown className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              {isExternallyManaged ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="default" className="capitalize mt-1 gap-1 cursor-help">
                        {getPlanLabel(tenant.plan)}
                        <Lock className="h-3 w-3" />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Este valor es controlado por el Sistema Core
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge variant="default" className="capitalize mt-1">
                  {getPlanLabel(tenant.plan)}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {getPlanDescription(tenant.plan)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Billing State Card */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${billingStateConfig.bg}`}>
              <Gift className={`h-5 w-5 ${billingStateConfig.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado de Facturación</p>
              <Badge variant="outline" className={`mt-1 ${billingStateConfig.color}`}>
                {billingStateConfig.label}
              </Badge>
              {billingData && (
                <p className="text-xs text-muted-foreground mt-1">
                  Créditos: {billingData.message_credits.toLocaleString('es-MX')} | 
                  Iniciales: {billingData.initial_credits_granted ? 'Sí' : 'No'}
                </p>
              )}
            </div>
          </div>
          {canCompleteOnboarding && (
            isExternallyManaged ? (
              <div className="text-right">
                <Button variant="outline" size="sm" disabled className="cursor-not-allowed">
                  <Gift className="h-4 w-4 mr-2" />
                  Configurar Suscripción
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Gestionado por Sistema Core</p>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowOnboardingConfirm(true)}
                disabled={completingOnboarding}
              >
                {completingOnboarding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Gift className="h-4 w-4 mr-2" />
                )}
                Completar Onboarding
              </Button>
            )
          )}
        </div>
      </div>

      {/* Feature Flags */}
      <TenantFeatureFlagsCard
        tenantId={tenant.id}
        partnerId={(tenant as Tenant & { partner_id?: string | null }).partner_id ?? null}
        onUpdate={onTenantUpdate}
      />

      {/* Account Status */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estado de Cuenta</p>
            <Badge 
              variant={tenant.status === 'active' ? 'default' : 'secondary'} 
              className="capitalize mt-1"
            >
              {tenant.status === 'active' ? 'Activo' : tenant.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Seats / Max Users */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Límite de Usuarios (Seats)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activos no-admin: <span className="text-foreground font-medium">{activeUsersCount}</span>
                {' / '}
                <span className="text-foreground font-medium">{tenant.max_users ?? '—'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExternallyManaged ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={maxUsersValue}
                        readOnly
                        disabled
                        className="w-24 cursor-not-allowed"
                      />
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Lock className="h-3 w-3" />
                        Solo lectura
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Este valor es controlado por el Sistema Core
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxUsersValue}
                  onChange={(e) => setMaxUsersValue(e.target.value)}
                  disabled={savingMaxUsers}
                  className="w-24"
                />
              <Button
                size="sm"
                onClick={handleSaveMaxUsers}
                disabled={savingMaxUsers || maxUsersValue === String(tenant.max_users ?? 1)}
              >
                {savingMaxUsers ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                <span className="ml-1">Guardar</span>
              </Button>
              </>
            )}
          </div>
        </div>
        {isExternallyManaged && (
          <p className="text-xs text-muted-foreground mt-3">
            Este límite se gestiona desde el sistema Core. Para modificarlo, actualízalo en el sistema externo.
          </p>
        )}
      </div>

      {/* Owner Users */}
      {owners.length > 0 && (
        <div className="bg-secondary/30 border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Usuarios Owner</p>
          </div>
          <div className="space-y-3">
            {owners.map((owner) => (
              <div key={owner.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{owner.name}</p>
                    <p className="text-xs text-muted-foreground">{owner.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={owner.status === 'active' ? 'default' : 'secondary'}>
                    {owner.status === 'active' ? 'Activo' : 'Pendiente'}
                  </Badge>
                  {(owner.status === 'inactive' || owner.first_login_required) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvite(owner.id)}
                      disabled={resendingInvite === owner.id}
                    >
                      {resendingInvite === owner.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span className="ml-1">Reenviar</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
        <p>
          Cada mensaje (entrante o saliente) consume 1 crédito del wallet. 
          Usuarios y contactos ilimitados.
        </p>
      </div>

      {/* Creation Date */}
      <div className="text-sm text-muted-foreground">
        Creado el {new Date(tenant.created_at).toLocaleDateString('es-MX', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showOnboardingConfirm} onOpenChange={setShowOnboardingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completar Onboarding</AlertDialogTitle>
            <AlertDialogDescription>
              Esto activará el tenant y asignará 1,000 mensajes iniciales. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingOnboarding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCompleteOnboarding}
              disabled={completingOnboarding}
            >
              {completingOnboarding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite fallback dialog (in case email delivery is blocked) */}
      <Dialog open={!!inviteFallback} onOpenChange={(open) => !open && setInviteFallback(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enlace de activación</DialogTitle>
            <DialogDescription>
              Si el correo no llega (filtros/tiempos), usa este enlace para completar el alta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Destinatario: <span className="text-foreground">{inviteFallback?.email}</span>
              {inviteFallback?.emailId ? (
                <span className="ml-2 text-xs text-muted-foreground">(id: {inviteFallback.emailId})</span>
              ) : null}
            </div>

            <Input value={inviteFallback?.activationLink || ''} readOnly />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const link = inviteFallback?.activationLink;
                  if (!link) return;
                  try {
                    await navigator.clipboard.writeText(link);
                    toast.success('Enlace copiado');
                  } catch {
                    toast.error('No se pudo copiar el enlace');
                  }
                }}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  const link = inviteFallback?.activationLink;
                  if (link) window.open(link, '_blank', 'noopener,noreferrer');
                }}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setInviteFallback(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
