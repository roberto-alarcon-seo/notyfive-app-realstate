import { ReactNode, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useFeatureFlag, type FeatureName } from "@/hooks/useFeatureFlag";

interface FeatureFlagGuardProps {
  feature: FeatureName;
  children: ReactNode;
}

/**
 * Restricts access to a route based on a tenant feature flag.
 * If the feature is disabled, redirects to "/" with an info toast.
 */
export function FeatureFlagGuard({ feature, children }: FeatureFlagGuardProps) {
  const { enabled, isLoading } = useFeatureFlag(feature);
  const notified = useRef(false);

  useEffect(() => {
    if (!isLoading && !enabled && !notified.current) {
      notified.current = true;
      toast.error("Módulo no disponible en su plan", {
        description: "Contacta a soporte para activar esta funcionalidad.",
      });
    }
  }, [enabled, isLoading]);

  if (isLoading) return null;
  if (!enabled) return <Navigate to="/" replace />;
  return <>{children}</>;
}
