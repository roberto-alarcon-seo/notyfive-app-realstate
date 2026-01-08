import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Zap, TrendingUp, Crown, Sparkles, Info, Loader2, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantCredits, getTotalCredits, getPlanMonthlyCredits } from "@/hooks/useTenantCredits";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PlansCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLAN_ORDER = ["trial", "starter", "growth", "pro", "scale", "enterprise"];

// Note: Price IDs are now resolved server-side in the edge function
// No need for VITE_STRIPE_PRICE_* environment variables

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$69",
    period: "/ mes",
    messages: "1,000 mensajes incluidos",
    lineHelper: "Incluye 1 línea telefónica de WhatsApp",
    secondaryHelper: "Mensajes acumulables",
    icon: Zap,
    badge: null,
    highlighted: false,
    monthlyCredits: 1000,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$179",
    period: "/ mes",
    messages: "3,000 mensajes incluidos",
    lineHelper: "Incluye 1 línea telefónica de WhatsApp",
    secondaryHelper: "Menor costo por mensaje",
    tooltipText: "Este plan ofrece un mejor balance entre volumen y costo.",
    icon: TrendingUp,
    badge: "Más popular",
    highlighted: true,
    monthlyCredits: 3000,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$339",
    period: "/ mes",
    messages: "6,000 mensajes incluidos",
    lineHelper: "Incluye 1 línea telefónica de WhatsApp",
    secondaryHelper: null,
    icon: Crown,
    badge: null,
    highlighted: false,
    monthlyCredits: 6000,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$649",
    period: "/ mes",
    messages: "12,000 mensajes incluidos",
    lineHelper: "Incluye 1 línea telefónica de WhatsApp",
    secondaryHelper: "Ideal para alto volumen",
    icon: Sparkles,
    badge: "Mejor valor",
    highlighted: false,
    monthlyCredits: 12000,
  },
];

const creditPacks = [
  { messages: "+1,000 mensajes", price: "$89", badge: null, pack: 1000 },
  { messages: "+3,000 mensajes", price: "$249", badge: null, pack: 3000 },
  { messages: "+6,000 mensajes", price: "$489", badge: "Mejor valor", pack: 6000 },
];

function getDirection(currentPlan: string, targetPlan: string): "same" | "upgrade" | "downgrade" {
  const a = PLAN_ORDER.indexOf(currentPlan);
  const b = PLAN_ORDER.indexOf(targetPlan);
  if (a === -1 || b === -1 || a === b) return "same";
  return b > a ? "upgrade" : "downgrade";
}

// Note: Both upgrades and downgrades are now scheduled for the next billing cycle
// This ensures credits are only granted after payment is confirmed

export function PlansCreditsModal({
  open,
  onOpenChange,
}: PlansCreditsModalProps) {
  const { data: credits, isLoading, refetch } = useTenantCredits();
  const { tenant } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    planId: string;
    planName: string;
    direction: "upgrade" | "downgrade";
    effectiveDate?: string;
  } | null>(null);
  
  const totalCredits = getTotalCredits(credits);
  const monthlyRemaining = credits?.monthly_credits_remaining ?? 0;
  const accumulated = credits?.accumulated_credits ?? 0;
  const extra = credits?.extra_credits ?? 0;
  const currentPlan = credits?.plan ?? 'starter';
  const subscriptionStatus = credits?.subscription_status;
  const planMaxCredits = getPlanMonthlyCredits(currentPlan);
  const hasActiveSubscription = subscriptionStatus === "active" && credits?.stripe_subscription_id;
  
  // Pending plan info
  const pendingPlan = credits?.pending_plan;
  const pendingPlanEffectiveAt = credits?.pending_plan_effective_at;
  
  // Format next refill date
  const nextRefillDate = credits?.next_refill_at 
    ? format(new Date(credits.next_refill_at), "d MMM yyyy", { locale: es })
    : "—";

  // Get plan display name
  const planDisplayName = plans.find(p => p.id === currentPlan)?.name ?? currentPlan;

  // No longer needed - all plan changes are scheduled for next billing cycle
  // Credits are granted only when payment is confirmed via webhook

  const handleSelectPlan = async (planId: string) => {
    if (!tenant?.id) {
      toast.error("No se pudo obtener la información del tenant");
      return;
    }

    const direction = getDirection(currentPlan, planId);
    
    if (direction === "same") {
      return;
    }

    // If user has an active subscription, show confirmation dialog for plan change
    if (hasActiveSubscription) {
      const targetPlan = plans.find(p => p.id === planId);
      const effectiveDate = credits?.current_period_end 
        ? format(new Date(credits.current_period_end), "d 'de' MMMM yyyy", { locale: es })
        : undefined;
      
      setConfirmDialog({
        open: true,
        planId,
        planName: targetPlan?.name || planId,
        direction,
        effectiveDate,
      });
      return;
    }

    // No active subscription - redirect to checkout for new subscription
    setLoadingPlan(planId);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: {
          tenant_id: tenant.id,
          plan: planId,
        },
      });

      if (error) {
        console.error("Error creating checkout session:", error);
        toast.error("Error al crear la sesión de pago");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("No se recibió la URL de pago");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error al procesar la solicitud");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!confirmDialog || !tenant?.id) return;

    setLoadingPlan(confirmDialog.planId);

    try {
      // Price ID is now resolved server-side, no need to pass it
      const { data, error } = await supabase.functions.invoke("stripe-update-subscription-plan", {
        body: {
          tenant_id: tenant.id,
          target_plan: confirmDialog.planId,
        },
      });

      if (error) {
        console.error("Error updating plan:", error);
        toast.error("Error al cambiar el plan. Intenta nuevamente.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Both upgrade and downgrade are now scheduled for next billing cycle
      toast.success(`Cambio programado. Tu plan cambiará a ${confirmDialog.planName} en tu próxima renovación.`);

      // Refetch credits to update UI
      await refetch();
      setConfirmDialog(null);
      
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error al procesar la solicitud");
    } finally {
      setLoadingPlan(null);
    }
  };

  // Check if plan button should be disabled
  const isPlanDisabled = (planId: string) => {
    // Disabled if it's the current plan AND subscription is active
    // Also disabled if there's a pending change to this plan
    return (planId === currentPlan && subscriptionStatus === "active") || pendingPlan === planId;
  };

  // Get button label for plan
  const getPlanButtonLabel = (planId: string) => {
    if (pendingPlan === planId) {
      return "Programado";
    }
    if (planId === currentPlan && subscriptionStatus === "active") {
      return "Plan actual";
    }
    if (!hasActiveSubscription) {
      return "Seleccionar";
    }
    const direction = getDirection(currentPlan, planId);
    if (direction === "upgrade") {
      return "Mejorar";
    }
    if (direction === "downgrade") {
      return "Cambiar";
    }
    return "Seleccionar";
  };

  // Handle credit pack purchase
  const handleBuyCredits = async (pack: number) => {
    if (!tenant?.id) {
      toast.error("No se pudo obtener la información del tenant");
      return;
    }

    setLoadingPack(pack);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-credit-pack-checkout", {
        body: {
          tenant_id: tenant.id,
          pack: pack,
        },
      });

      if (error) {
        console.error("Error creating credit pack checkout:", error);
        toast.error("Error al crear la sesión de pago");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error("No se recibió la URL de pago");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error al procesar la solicitud");
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Planes y créditos
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Administra tu plan mensual y recarga mensajes cuando lo necesites.
            </DialogDescription>
          </DialogHeader>

          {/* Current Status Card */}
          <div className="bg-card rounded-xl p-5 border border-border mt-4">
            <div className="grid grid-cols-3 gap-6 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Plan actual</p>
                <p className="text-lg font-semibold text-foreground capitalize">{planDisplayName}</p>
                {subscriptionStatus === "active" && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    Suscripción activa
                  </Badge>
                )}
                {/* Pending plan badge */}
                {pendingPlan && pendingPlanEffectiveAt && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                      <Calendar className="h-3 w-3 mr-1" />
                      Cambio programado
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cambia a <span className="font-medium capitalize">{pendingPlan}</span> el{" "}
                      {format(new Date(pendingPlanEffectiveAt), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Mensajes disponibles
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {isLoading ? "..." : totalCredits.toLocaleString()}
                </p>
                {/* Breakdown - Monthly first, then accumulated, then extra */}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Del mes: <span className="text-purple-400 font-medium">{monthlyRemaining.toLocaleString()}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Acumulados: <span className="text-blue-400 font-medium">{accumulated.toLocaleString()}</span>
                  </span>
                  {extra > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Adicionales: <span className="text-emerald-400 font-medium">{extra.toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Renueva</p>
                <p className="text-lg font-semibold text-foreground">
                  {nextRefillDate}
                </p>
              </div>
            </div>

            {/* Progress bar with 3 segments: monthly (purple), accumulated (blue), extra (emerald) */}
            {totalCredits > 0 && (
              <div className="mb-2">
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden flex">
                  {/* Monthly credits segment (purple) - consumed first */}
                  <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${(monthlyRemaining / totalCredits) * 100}%` }}
                  />
                  {/* Accumulated credits segment (blue) */}
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(accumulated / totalCredits) * 100}%` }}
                  />
                  {/* Extra credits segment (emerald) */}
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(extra / totalCredits) * 100}%` }}
                  />
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] text-muted-foreground">Del mes (se usan primero)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-muted-foreground">Acumulados</span>
                  </div>
                  {extra > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">Créditos adicionales</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Monthly Plans Section */}
          <div className="mt-6">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Tu plan mensual
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const isDisabled = isPlanDisabled(plan.id);
                const isLoading = loadingPlan === plan.id;
                const direction = getDirection(currentPlan, plan.id);
                const isPending = pendingPlan === plan.id;
                
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative rounded-xl border p-4 transition-all",
                      plan.highlighted
                        ? "border-primary bg-primary/5 shadow-glow-sm"
                        : "border-border bg-card",
                      isCurrent && "ring-1 ring-primary/50",
                      isPending && "ring-1 ring-amber-500/50"
                    )}
                  >
                    {plan.badge && !isPending && (
                      <Badge
                        className={cn(
                          "absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5",
                          plan.highlighted
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground"
                        )}
                      >
                        {plan.badge}
                      </Badge>
                    )}
                    
                    {isPending && (
                      <Badge
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 bg-amber-500 text-white"
                      >
                        Programado
                      </Badge>
                    )}

                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          plan.highlighted
                            ? "bg-primary/20"
                            : "bg-secondary"
                        )}
                      >
                        <plan.icon
                          className={cn(
                            "h-4 w-4",
                            plan.highlighted
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <span className="font-medium text-foreground">
                        {plan.name}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-2xl font-bold text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>

                    <p className="text-sm text-foreground font-medium mb-1">
                      {plan.messages}
                    </p>

                    <p className="text-xs text-muted-foreground mb-1">
                      {plan.lineHelper}
                    </p>

                    {plan.secondaryHelper && (
                      <div className="flex items-center gap-1 text-xs text-primary mb-3">
                        <span>{plan.secondaryHelper}</span>
                        {plan.tooltipText && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] text-xs">
                                {plan.tooltipText}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}

                    {!plan.secondaryHelper && <div className="h-4 mb-3" />}

                    <Button
                      variant={isDisabled ? "secondary" : plan.highlighted ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      disabled={isDisabled || isLoading}
                      onClick={() => handleSelectPlan(plan.id)}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Cargando...
                        </>
                      ) : isDisabled && isCurrent ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                          Plan actual
                        </>
                      ) : isPending ? (
                        <>
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          Programado
                        </>
                      ) : direction === "upgrade" && hasActiveSubscription ? (
                        <>
                          <ArrowUp className="h-3.5 w-3.5 mr-1.5" />
                          Mejorar
                        </>
                      ) : direction === "downgrade" && hasActiveSubscription ? (
                        <>
                          <ArrowDown className="h-3.5 w-3.5 mr-1.5" />
                          Cambiar
                        </>
                      ) : (
                        "Seleccionar"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extra Credits Section */}
          <div className="mt-6">
            <h3 className="text-base font-semibold text-foreground mb-1">
              Créditos adicionales
            </h3>
            <p className="text-sm text-muted-foreground mb-1">
              Agrega mensajes extra a tu saldo actual cuando lo necesites.
            </p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Para uso constante, te conviene subir de plan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {creditPacks.map((pack, index) => (
                <div
                  key={index}
                  className={cn(
                    "relative rounded-xl border bg-card p-4 flex flex-col",
                    pack.badge ? "border-accent" : "border-border"
                  )}
                >
                  {pack.badge && (
                    <Badge
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 bg-accent text-accent-foreground"
                    >
                      {pack.badge}
                    </Badge>
                  )}
                  <p className="font-medium text-foreground mb-1 mt-1">
                    {pack.messages}
                  </p>
                  <p className="text-2xl font-bold text-foreground mb-2">
                    {pack.price}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Se agregan como créditos adicionales
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-auto" 
                    disabled={loadingPack !== null}
                    onClick={() => handleBuyCredits(pack.pack)}
                  >
                    {loadingPack === pack.pack ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      "Comprar"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pb-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              Todos los planes incluyen una línea telefónica de WhatsApp sin costo adicional.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Todos los precios están expresados en USD. Los mensajes incluyen envío por WhatsApp, uso de IA y operación de la plataforma.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Plan Changes */}
      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmDialog?.direction === "upgrade" ? (
                <>
                  <ArrowUp className="h-5 w-5 text-success" />
                  Mejorar a {confirmDialog?.planName}
                </>
              ) : (
                <>
                  <ArrowDown className="h-5 w-5 text-muted-foreground" />
                  Cambiar a {confirmDialog?.planName}
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  El cambio se aplicará en tu <strong>próxima renovación</strong> ({confirmDialog?.effectiveDate}).
                </p>
                <p className="text-sm text-muted-foreground">
                  No se realizará ningún cobro adicional hoy. Continuarás disfrutando de tu plan actual hasta la fecha indicada.
                </p>
                {confirmDialog?.direction === "upgrade" && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <p className="text-sm text-foreground">
                      💡 Si necesitas más créditos antes de la renovación, puedes comprar <strong>créditos adicionales</strong> en cualquier momento.
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Tu saldo actual de créditos no se pierde.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!loadingPlan}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPlanChange}
              disabled={!!loadingPlan}
            >
              {loadingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Programar cambio"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
