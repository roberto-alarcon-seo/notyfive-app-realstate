import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";

/**
 * Bridge component that syncs the active partner branding with the
 * authenticated tenant's `partner_id`. Without this, all tenants sharing
 * the same hostname (e.g. *.lovable.app) would inherit the same theme.
 *
 * Mounted inside <AuthProvider> so it can read the tenant. Talks to
 * <PartnerBrandingProvider> through `setActivePartnerId`.
 */
export function PartnerThemeSync() {
  const { tenant, isLoading } = useAuth();
  const { setActivePartnerId } = usePartnerBranding();

  useEffect(() => {
    if (isLoading) return;
    // When there's no tenant (logged out, super admin without tenant,
    // or auth still resolving), fall back to hostname resolution.
    setActivePartnerId(tenant?.partner_id ?? null);
  }, [tenant?.partner_id, isLoading, setActivePartnerId]);

  return null;
}