import { useTenantContextWithFeatures } from "@/hooks/useTenantContextWithFeatures";

export type FeatureName =
  | "campaigns"
  | "segments"
  | "automations_builder"
  | "templates_library"
  | "quick_automations";

/**
 * Returns true if the current tenant has the given feature flag enabled.
 * Reads from `tenants.enabled_features` (text[]).
 */
export function useFeatureFlag(featureName: FeatureName): {
  enabled: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useTenantContextWithFeatures();
  const enabled = !!data?.enabled_features?.includes(featureName);
  return { enabled, isLoading };
}
