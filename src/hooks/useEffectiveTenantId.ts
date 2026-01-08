import { useSupportMode } from '@/contexts/SupportModeContext';

/**
 * Returns the tenant id that should be used for tenant-scoped queries.
 * - In support mode: impersonated tenant id
 * - Otherwise: the user's own tenant id
 */
export function useEffectiveTenantId(): string | null {
  const { getEffectiveTenantId } = useSupportMode();
  return getEffectiveTenantId();
}
