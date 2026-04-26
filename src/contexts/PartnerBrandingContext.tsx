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

  // Apply CSS vars on mount + whenever partner OR live preview changes
  useEffect(() => {
    if (liveTheme) {
      applyPartnerTheme(liveTheme);
    } else {
      applyCssVariables(partner);
    }
  }, [partner, liveTheme]);

  // Hydrate from DB
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const hostname = window.location.hostname.toLowerCase().replace(/:\d+$/, "");

        // Try to find partner by primary_domain or alt_domains
        const { data, error } = await supabase
          .from("partners")
          .select("*")
          .eq("is_active", true);

        if (cancelled || error || !data) {
          setIsLoading(false);
          return;
        }

        const match = data.find(
          (p) =>
            p.primary_domain === hostname ||
            (p.alt_domains as string[] | null)?.includes(hostname),
        ) ?? data.find((p) => p.id === DEFAULT_PARTNER_ID);

        if (match) {
          const savedTheme = (match.branding ?? null) as Partial<PartnerTheme> | null;
          const baseTheme = buildDefaultTheme(match.primary_color_hsl);
          const mergedTheme: PartnerTheme = {
            ...baseTheme,
            ...(savedTheme && typeof savedTheme === "object" ? savedTheme : {}),
            // Always keep primary_color in sync with the dedicated column if branding is empty
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
            theme: mergedTheme,
          });
        }
      } catch (e) {
        // Silent: keep static fallback
        console.warn("[PartnerBranding] hydrate failed", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<PartnerBrandingContextValue>(
    () => ({
      partner,
      isLoading,
      setLiveTheme: (theme) => setLiveThemeState(theme),
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