import { ReactNode } from "react";
import { Lock, Sparkles, LifeBuoy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFeatureFlag, type FeatureName } from "@/hooks/useFeatureFlag";

interface PremiumGateProps {
  /** Override the computed access flag. When true, children render. */
  hasAccess?: boolean;
  /** Feature flags that grant access. ANY enabled flag unlocks the section. */
  requiredFlags?: FeatureName[];
  featureName: string;
  description?: string;
  children: ReactNode;
}

/**
 * Wraps premium settings views. If the tenant lacks premium access,
 * shows an elegant empty state directing the user to support.
 * TODO: replace `hasAccess` default with billing_state lookup once
 * the premium flag is exposed by the tenant context.
 */
export function PremiumGate({
  hasAccess,
  requiredFlags,
  featureName,
  description,
  children,
}: PremiumGateProps) {
  const navigate = useNavigate();
  const flagAccess = useFlagsAccess(requiredFlags);
  const granted = hasAccess ?? flagAccess;

  if (granted) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-border bg-card">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center relative">
          <Lock className="h-8 w-8 text-primary" />
          <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            Función Pro
          </div>
          <h2 className="text-xl font-semibold text-foreground">{featureName}</h2>
          <p className="text-sm text-muted-foreground">
            {description ??
              "Esta funcionalidad está disponible solo para cuentas con acceso premium. Contacta a nuestro equipo para activarla."}
          </p>
        </div>
        <Button onClick={() => navigate("/support")} className="w-full">
          <LifeBuoy className="h-4 w-4 mr-2" />
          Contactar a soporte
        </Button>
      </div>
    </div>
  );
}

/**
 * Returns true if ANY of the provided feature flags is enabled for the tenant.
 */
export function useFlagsAccess(flags?: FeatureName[]): boolean {
  // Hooks must be called unconditionally and in the same order.
  const a = useFeatureFlag(flags?.[0] ?? "api_access");
  const b = useFeatureFlag(flags?.[1] ?? "api_access");
  if (!flags || flags.length === 0) return false;
  if (flags.length === 1) return a.enabled;
  return a.enabled || b.enabled;
}

/** @deprecated Use <PremiumGate requiredFlags={[...]}> instead. */
export function useHasPremiumAccess(): boolean {
  return false;
}