import { useState, useEffect } from "react";
import { CreditCard, Wallet, AlertTriangle, CheckCircle2, ArrowUpCircle, Calendar, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { PlansCreditsModal } from "@/components/billing/PlansCreditsModal";
import { CancelSubscriptionModal } from "@/components/billing/CancelSubscriptionModal";
import { useTenantCredits, getCreditStatus } from "@/hooks/useTenantCredits";
import { InvoiceHistoryCard } from "@/components/billing/InvoiceHistoryCard";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsBilling() {
  const { tenant } = useAuth();
  const { data: tenantCredits, isLoading: creditsLoading, refetch: refetchCredits } = useTenantCredits();
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle credit pack success/cancel redirects
  useEffect(() => {
    const credits = searchParams.get("credits");
    if (credits === "success") {
      toast.success("¡Créditos adicionales acreditados exitosamente!");
      refetchCredits();
      // Clean up URL
      searchParams.delete("credits");
      setSearchParams(searchParams, { replace: true });
    } else if (credits === "cancel") {
      toast("Pago cancelado");
      searchParams.delete("credits");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refetchCredits]);

  const renewalDate = tenantCredits?.next_refill_at 
    ? format(new Date(tenantCredits.next_refill_at), "d MMM yyyy", { locale: es })
    : null;

  const periodEndDate = tenantCredits?.current_period_end
    ? format(new Date(tenantCredits.current_period_end), "d 'de' MMMM yyyy", { locale: es })
    : null;
  
  // Credit breakdown
  const monthlyCredits = tenantCredits?.monthly_credits_remaining ?? 0;
  const accumulatedCredits = tenantCredits?.accumulated_credits ?? 0;
  const extraCredits = tenantCredits?.extra_credits ?? 0;
  const totalCredits = monthlyCredits + accumulatedCredits + extraCredits;
  const billingState = tenantCredits?.billing_state ?? 'ONBOARDING_PAID';

  // Check if cancellation is pending
  const subscriptionStatus = tenantCredits?.subscription_status;
  const isCancelPending = subscriptionStatus === "cancel_pending";

  // Determine wallet status from tenantCredits (single source of truth)
  const walletStatus = getCreditStatus(totalCredits, billingState);

  const planLabels: Record<string, { label: string; color: string }> = {
    trial: { label: "Trial", color: "bg-yellow-500/10 text-yellow-500" },
    starter: { label: "Starter", color: "bg-blue-500/10 text-blue-500" },
    growth: { label: "Growth", color: "bg-green-500/10 text-green-500" },
    pro: { label: "Pro", color: "bg-primary/10 text-primary" },
    scale: { label: "Scale", color: "bg-purple-500/10 text-purple-500" },
    enterprise: { label: "Enterprise", color: "bg-purple-500/10 text-purple-500" },
  };

  const currentPlan = tenantCredits?.plan || tenant?.plan || "trial";
  const planInfo = planLabels[currentPlan] || planLabels.trial;

  const getWalletStatusConfig = () => {
    switch (walletStatus) {
      case 'active':
        return { label: 'Activo', color: 'text-success', icon: CheckCircle2 };
      case 'low':
        return { label: 'Saldo bajo', color: 'text-warning', icon: AlertTriangle };
      case 'blocked':
        return { label: 'Bloqueado', color: 'text-destructive', icon: AlertTriangle };
    }
  };

  const walletConfig = getWalletStatusConfig();
  const WalletIcon = walletConfig.icon;

  const handleReactivate = async () => {
    if (!tenant?.id) return;

    setIsReactivating(true);
    try {
      const { error } = await supabase.functions.invoke("stripe-reactivate-subscription", {
        body: { tenant_id: tenant.id },
      });

      if (error) throw error;

      toast.success("¡Suscripción reactivada exitosamente!");
      refetchCredits();
    } catch (error: unknown) {
      console.error("Error reactivating subscription:", error);
      const message = error instanceof Error ? error.message : "Error al reactivar la suscripción";
      toast.error(message);
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <SettingsLayout
      title="Facturación"
      description="Tu plan y mensajes disponibles"
      icon={CreditCard}
    >
      <div className="space-y-6 max-w-2xl">
        {/* Cancellation Pending Banner */}
        {isCancelPending && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">Cancelación programada</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Tu cuenta se cancelará el <span className="font-medium text-foreground">{periodEndDate}</span>.
                  Hasta entonces, podrás seguir usando el servicio normalmente.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={handleReactivate}
                  disabled={isReactivating}
                >
                  {isReactivating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reactivar servicio
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Plan actual</h3>
              <p className="text-muted-foreground text-sm">Tu plan de suscripción</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={isCancelPending ? "bg-destructive/10 text-destructive" : planInfo.color}>
                {isCancelPending ? "Cancelación pendiente" : planInfo.label}
              </Badge>
              {!isCancelPending && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPlansModalOpen(true)}
                  className="gap-2"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Cambiar plan
                </Button>
              )}
            </div>
          </div>
          
          {/* Pending plan change notice */}
          {tenantCredits?.pending_plan && tenantCredits?.pending_plan_effective_at && !isCancelPending && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <Calendar className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Cambio de plan programado</p>
                <p className="text-sm text-muted-foreground">
                  Tu plan cambiará a <span className="font-medium capitalize">{tenantCredits.pending_plan}</span> el{" "}
                  {format(new Date(tenantCredits.pending_plan_effective_at), "d 'de' MMMM yyyy", { locale: es })}.
                </p>
              </div>
            </div>
          )}
          
          {/* Renewal date */}
          {renewalDate && !tenantCredits?.pending_plan && !isCancelPending && (
            <div className="flex items-center gap-2 pt-3 border-t border-border mt-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Próxima renovación: <span className="text-foreground font-medium">{renewalDate}</span>
              </span>
            </div>
          )}

          {/* Cancel subscription button */}
          {!isCancelPending && currentPlan !== "trial" && (
            <div className="pt-3 border-t border-border mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setCancelModalOpen(true)}
              >
                Cancelar suscripción
              </Button>
            </div>
          )}
        </div>

        {/* Wallet Balance - Message Based */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${walletStatus === 'active' ? 'bg-success/10' : walletStatus === 'low' ? 'bg-warning/10' : 'bg-destructive/10'}`}>
              <Wallet className={`h-6 w-6 ${walletConfig.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-foreground">Mensajes Disponibles</h3>
                <Badge variant="outline" className={`${walletConfig.color} border-current`}>
                  <WalletIcon className="h-3 w-3 mr-1" />
                  {walletConfig.label}
                </Badge>
              </div>
              <p className="text-3xl font-bold text-foreground mb-1">
                {creditsLoading ? '...' : totalCredits.toLocaleString('es-MX')}
                <span className="text-lg text-muted-foreground ml-2">mensajes</span>
              </p>
              
              {/* Credit breakdown */}
              <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
                <span className="text-muted-foreground">
                  Del mes: <span className="text-purple-400 font-medium">{monthlyCredits.toLocaleString('es-MX')}</span>
                </span>
                <span className="text-muted-foreground">
                  Acumulados: <span className="text-blue-400 font-medium">{accumulatedCredits.toLocaleString('es-MX')}</span>
                </span>
                {extraCredits > 0 && (
                  <span className="text-muted-foreground">
                    Adicionales: <span className="text-emerald-400 font-medium">{extraCredits.toLocaleString('es-MX')}</span>
                  </span>
                )}
              </div>
              
              {/* Progress bar with 3 segments */}
              {totalCredits > 0 && (
                <div className="mb-3">
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden flex">
                    {/* Monthly credits segment (purple) */}
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${(monthlyCredits / totalCredits) * 100}%` }}
                    />
                    {/* Accumulated credits segment (blue) */}
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(accumulatedCredits / totalCredits) * 100}%` }}
                    />
                    {/* Extra credits segment (emerald) */}
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(extraCredits / totalCredits) * 100}%` }}
                    />
                  </div>
                  
                  {/* Legend */}
                  {(accumulatedCredits > 0 || extraCredits > 0) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {accumulatedCredits > 0 && (
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                          +{accumulatedCredits.toLocaleString('es-MX')} acumulados
                        </Badge>
                      )}
                      {extraCredits > 0 && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          +{extraCredits.toLocaleString('es-MX')} adicionales
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                Cada mensaje enviado o recibido consume 1 crédito.
              </p>

              {/* Status warnings */}
              {walletStatus === 'low' && (
                <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    Tu saldo está bajo. Recarga créditos para continuar enviando mensajes.
                  </p>
                </div>
              )}

              {walletStatus === 'blocked' && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    Tu cuenta está bloqueada por falta de créditos. Recarga para continuar.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice History */}
        <InvoiceHistoryCard />

        {/* Plan Features */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Funciones del plan</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-foreground">Usuarios ilimitados</span>
              <Badge variant="outline" className="text-success">Incluido</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-foreground">Contactos ilimitados</span>
              <Badge variant="outline" className="text-success">Incluido</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-foreground">Automatización con IA</span>
              <Badge variant="outline" className={currentPlan === 'trial' || currentPlan === 'starter' ? 'text-muted-foreground' : 'text-success'}>
                {currentPlan === 'trial' || currentPlan === 'starter' ? 'No incluido' : 'Incluido'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-muted/30 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Para recargar mensajes, contacta al administrador de NotyFive.
          </p>
        </div>
      </div>

      <PlansCreditsModal open={plansModalOpen} onOpenChange={setPlansModalOpen} />
      
      <CancelSubscriptionModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        tenantId={tenant?.id || ""}
        periodEndDate={tenantCredits?.current_period_end}
        onSuccess={refetchCredits}
      />
    </SettingsLayout>
  );
}
