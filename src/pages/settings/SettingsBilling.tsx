import { CreditCard, Wallet, Lock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantCredits } from "@/hooks/useTenantCredits";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function SettingsBilling() {
  const { tenant } = useAuth();
  const { data: tenantCredits, isLoading: creditsLoading } = useTenantCredits();

  const monthlyCredits = tenantCredits?.monthly_credits_remaining ?? 0;
  const accumulatedCredits = tenantCredits?.accumulated_credits ?? 0;
  const extraCredits = tenantCredits?.extra_credits ?? 0;
  const totalCredits = monthlyCredits + accumulatedCredits + extraCredits;

  const renewalDate = tenantCredits?.next_refill_at
    ? format(new Date(tenantCredits.next_refill_at), "d 'de' MMMM yyyy", { locale: es })
    : null;

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

  return (
    <SettingsLayout
      title="Facturación"
      description="Saldo y plan gestionados desde Brokia24 Core"
      icon={CreditCard}
    >
      <div className="space-y-6 max-w-2xl">
        {/* Read-only notice */}
        <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Solo lectura</p>
            <p className="text-sm text-muted-foreground">
              Tu saldo y plan son administrados desde Brokia24 Core. Para realizar cambios, ingresa
              a tu panel principal de Brokia24.
            </p>
          </div>
        </div>

        {/* Current Plan */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Plan actual</h3>
              <p className="text-muted-foreground text-sm">Tu plan vigente</p>
            </div>
            <Badge className={planInfo.color}>{planInfo.label}</Badge>
          </div>

          {renewalDate && (
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Próxima renovación:{" "}
                <span className="text-foreground font-medium">{renewalDate}</span>
              </span>
            </div>
          )}
        </div>

        {/* Wallet Balance - Read Only */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-foreground">Mensajes Disponibles</h3>
                <Badge variant="outline" className="text-muted-foreground border-current">
                  <Lock className="h-3 w-3 mr-1" />
                  Gestionado por Brokia24 Core
                </Badge>
              </div>
              <p className="text-3xl font-bold text-foreground mb-3">
                {creditsLoading ? "..." : totalCredits.toLocaleString("es-MX")}
                <span className="text-lg text-muted-foreground ml-2">mensajes</span>
              </p>

              <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
                <span className="text-muted-foreground">
                  Del mes:{" "}
                  <span className="text-purple-400 font-medium">
                    {monthlyCredits.toLocaleString("es-MX")}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Acumulados:{" "}
                  <span className="text-blue-400 font-medium">
                    {accumulatedCredits.toLocaleString("es-MX")}
                  </span>
                </span>
                {extraCredits > 0 && (
                  <span className="text-muted-foreground">
                    Adicionales:{" "}
                    <span className="text-emerald-400 font-medium">
                      {extraCredits.toLocaleString("es-MX")}
                    </span>
                  </span>
                )}
              </div>

              {totalCredits > 0 && (
                <div className="mb-3">
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden flex">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${(monthlyCredits / totalCredits) * 100}%` }}
                    />
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(accumulatedCredits / totalCredits) * 100}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(extraCredits / totalCredits) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Cada mensaje enviado o recibido consume 1 crédito.
              </p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-muted/30 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Para gestionar tu plan o recargar mensajes, ingresa al panel principal de Brokia24.
          </p>
        </div>
      </div>
    </SettingsLayout>
  );
}