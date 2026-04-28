import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PARTNER_ID,
  PARTNERS,
  type PartnerStaticConfig,
  resolvePartnerByHostname,
} from "@/config/partnerConfig";
import {
  applyPartnerTheme,
  buildDefaultTheme,
  type PartnerTheme,
} from "@/lib/partnerTheme";

export interface PartnerBranding {
  id: string;
  name: string;
  primaryDomain: string;
  altDomains: string[];
  countryCode: string;
  logoUrl: string;
  logoMarkUrl: string | null;
  primaryColorHex: string;
  primaryColorHsl: string;
  accentColorHex: string | null;
  emailSenderName: string;
  emailSenderAddress: string;
  emailFooterText: string | null;
  /**
   * URL of the partner's master Core dashboard. Tenant users are redirected
   * here from the CRM landing page, since access to the CRM is SSO-only.
   */
  dashboardUrl: string | null;
  /** Optional redirect for unauthenticated users hitting the landing page. */
  nonSsoRedirectUrl: string | null;
  /** Optional redirect after the user signs out. */
  logoutRedirectUrl: string | null;
  /** Full design tokens for this partner (loaded from `partners.branding`). */
  theme: PartnerTheme;
}

interface PartnerBrandingContextValue {
  partner: PartnerBranding;
  isLoading: boolean;
  /**
   * Apply a theme on the fly (without persisting). Useful for the
   * Partner Settings preview while the user tweaks tokens.
   * Pass `null` to revert to the saved partner theme.
   */
  setLiveTheme: (theme: PartnerTheme | null) => void;
  /**
   * Switch the active partner branding to a specific partner_id.
   * Used by the auth bridge to apply the theme of the tenant's partner
   * once the user is authenticated. Pass `null` to revert to the
   * hostname-resolved partner (anonymous default).
   */
  setActivePartnerId: (partnerId: string | null) => void;
}

const PartnerBrandingContext = createContext<PartnerBrandingContextValue | undefined>(
  undefined,
);

function staticToBranding(p: PartnerStaticConfig): PartnerBranding {
  return {
    id: p.id,
    name: p.name,
    primaryDomain: p.primaryDomain,
    altDomains: p.altDomains,
    countryCode: p.countryCode,
    logoUrl: p.logoUrl,
    logoMarkUrl: p.logoMarkUrl ?? null,
    primaryColorHex: p.primaryColorHex,
    primaryColorHsl: p.primaryColorHsl,
    accentColorHex: p.accentColorHex ?? null,
    emailSenderName: p.emailSenderName,
    emailSenderAddress: p.emailSenderAddress,
    emailFooterText: p.emailFooterText ?? null,
    // Static fallback: assume the dashboard lives at the partner's primary
    // domain. The DB value (when available) takes precedence.
    dashboardUrl: p.primaryDomain ? `https://${p.primaryDomain}` : null,
    nonSsoRedirectUrl: null,
    logoutRedirectUrl: null,
    theme: buildDefaultTheme(p.primaryColorHsl),
  };
}

function applyCssVariables(partner: PartnerBranding) {
  const root = document.documentElement;
  // Apply full design-token theme (sidebar, surfaces, accent, etc.)
  applyPartnerTheme(partner.theme);

  // Title + theme-color meta
  if (typeof document !== "undefined") {
    document.title = partner.name;
    let meta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = partner.primaryColorHex;
  }
  void root;
}

export function PartnerBrandingProvider({ children }: { children: ReactNode }) {
  // Resolve initial partner synchronously from hostname (no flash)
  const initialStatic = useMemo(() => {
    if (typeof window === "undefined") return PARTNERS[DEFAULT_PARTNER_ID];
    return resolvePartnerByHostname(window.location.hostname);
  }, []);

  const [partner, setPartner] = useState<PartnerBranding>(() =>
    staticToBranding(initialStatic),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [liveTheme, setLiveThemeState] = useState<PartnerTheme | null>(null);
  // Active partner_id requested by the auth bridge. When set, overrides
  // the hostname-based resolution so each tenant sees its own branding
  // even when multiple tenants share the same domain (e.g. *.lovable.app).
  const [activePartnerId, setActivePartnerIdState] = useState<string | null>(
    null,
  );

  // Apply CSS vars on mount + whenever partner OR live preview changes
  useEffect(() => {
    if (liveTheme) {
      applyPartnerTheme(liveTheme);
    } else {
      applyCssVariables(partner);
    }
  }, [partner, liveTheme]);

  // Hydrate partner branding from DB. Re-runs whenever the auth bridge
  // requests a different active partner so the theme follows the tenant.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const hostname = window.location.hostname
          .toLowerCase()
          .replace(/:\d+$/, "");

        const { data, error } = await supabase
          .from("partners")
          .select("*")
          .eq("is_active", true);

        if (cancelled || error || !data) {
          setIsLoading(false);
          return;
        }

        // Resolution priority:
        //   1. Explicit activePartnerId (from authenticated tenant).
        //   2. Hostname match (primary_domain or alt_domains).
        //   3. DEFAULT_PARTNER_ID fallback.
        const match =
          (activePartnerId
            ? data.find((p) => p.id === activePartnerId)
            : null) ??
          data.find(
            (p) =>
              p.primary_domain === hostname ||
              (p.alt_domains as string[] | null)?.includes(hostname),
          ) ??
          data.find((p) => p.id === DEFAULT_PARTNER_ID);

        if (match) {
          const savedTheme = (match.branding ?? null) as Partial<PartnerTheme> | null;
          const baseTheme = buildDefaultTheme(match.primary_color_hsl);
          const mergedTheme: PartnerTheme = {
            ...baseTheme,
            ...(savedTheme && typeof savedTheme === "object" ? savedTheme : {}),
            primary_color: savedTheme?.primary_color || match.primary_color_hsl,
          };
          setPartner({
            id: match.id,
            name: match.name,
            primaryDomain: match.primary_domain,
            altDomains: (match.alt_domains as string[]) ?? [],
            countryCode: match.country_code,
            logoUrl: match.logo_url,
            logoMarkUrl: match.logo_mark_url,
            primaryColorHex: match.primary_color_hex,
            primaryColorHsl: match.primary_color_hsl,
            accentColorHex: match.accent_color_hex,
            emailSenderName: match.email_sender_name,
            emailSenderAddress: match.email_sender_address,
            emailFooterText: match.email_footer_text,
            dashboardUrl:
              (match as { dashboard_url?: string | null }).dashboard_url ??
              (match.primary_domain ? `https://${match.primary_domain}` : null),
            nonSsoRedirectUrl:
              (match as { non_sso_redirect_url?: string | null })
                .non_sso_redirect_url ?? null,
            logoutRedirectUrl:
              (match as { logout_redirect_url?: string | null })
                .logout_redirect_url ?? null,
            theme: mergedTheme,
          });
        }
      } catch (e) {
        console.warn("[PartnerBranding] hydrate failed", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePartnerId]);

  const value = useMemo<PartnerBrandingContextValue>(
    () => ({
      partner,
      isLoading,
      setLiveTheme: (theme) => setLiveThemeState(theme),
      setActivePartnerId: (id) => setActivePartnerIdState(id),
    }),
    [partner, isLoading],
  );

  return (
    <PartnerBrandingContext.Provider value={value}>
      {children}
    </PartnerBrandingContext.Provider>
  );
}

export function usePartnerBranding(): PartnerBrandingContextValue {
  const ctx = useContext(PartnerBrandingContext);
  if (!ctx) {
    throw new Error(
      "usePartnerBranding must be used within PartnerBrandingProvider",
    );
  }
  return ctx;
}