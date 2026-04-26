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
  const { tenant, partnerScope, isLoading } = useAuth();
  const { setActivePartnerId } = usePartnerBranding();

  useEffect(() => {
    if (isLoading) return;
    // Resolution priority:
    //   1. partnerScope for partner_admin users
    //   2. tenant.partner_id for tenant-scoped users
    //   3. null => fallback to hostname resolution
    setActivePartnerId(partnerScope ?? tenant?.partner_id ?? null);
  }, [partnerScope, tenant?.partner_id, isLoading, setActivePartnerId]);

  return null;
}