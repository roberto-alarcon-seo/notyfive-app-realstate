/**
 * Configuración estática de partners (white-label).
 *
 * Sirve como fallback para el primer paint (antes de que `usePartnerBranding`
 * pueda hacer fetch a la tabla `partners`). En runtime, los datos de la base
 * de datos sobreescriben estos valores si están disponibles.
 *
 * IMPORTANTE: Mantener sincronizado con la migración seed.
 */

export interface PartnerStaticConfig {
  id: string;
  name: string;
  primaryDomain: string;
  altDomains: string[];
  countryCode: string;
  logoUrl: string;
  logoMarkUrl?: string;
  primaryColorHex: string;
  primaryColorHsl: string; // formato "H S% L%" para CSS variables
  accentColorHex?: string;
  emailSenderName: string;
  emailSenderAddress: string;
  emailFooterText?: string;
}

export const PARTNERS: Record<string, PartnerStaticConfig> = {
  brokia: {
    id: "brokia",
    name: "Brokia24",
    primaryDomain: "app.brokia24.com",
    altDomains: [
      "linkasa.brokia24.com",
      "notyfive-app-realstate.lovable.app",
      "id-preview--d1cabd58-4d71-4307-9859-d54faa575f1e.lovable.app",
    ],
    countryCode: "MX",
    logoUrl: "/lovable-uploads/brokia-logo.png",
    primaryColorHex: "#942CCC",
    primaryColorHsl: "279 65% 49%",
    emailSenderName: "Brokia24",
    emailSenderAddress: "no-reply@notifications.brokia24.com",
    emailFooterText: "© Brokia24. Todos los derechos reservados.",
  },
  mls_latam: {
    id: "mls_latam",
    name: "MLS Latam",
    primaryDomain: "app.mlslatam.com",
    altDomains: [],
    countryCode: "CO",
    logoUrl: "/lovable-uploads/6d226a31-0e10-48e0-a7d1-e6301384077d.png",
    primaryColorHex: "#00A884",
    primaryColorHsl: "162 100% 33%",
    emailSenderName: "MLS Latam",
    emailSenderAddress: "no-reply@notifications.mlslatam.com",
    emailFooterText: "© MLS Latam. Todos los derechos reservados.",
  },
  responde: {
    id: "responde",
    name: "Responde",
    primaryDomain: "app.responde.mx",
    altDomains: [],
    countryCode: "MX",
    logoUrl: "/lovable-uploads/270634a4-1594-477d-817e-976a47e63473.png",
    primaryColorHex: "#7C3AED",
    primaryColorHsl: "262 83% 58%",
    emailSenderName: "Responde",
    emailSenderAddress: "no-reply@notifications.responde.mx",
    emailFooterText: "© Responde. Todos los derechos reservados.",
  },
};

export const DEFAULT_PARTNER_ID = "brokia";

/**
 * Resuelve el partner activo a partir del hostname del browser.
 * Coincide contra `primaryDomain` o cualquier `altDomains`.
 * Fallback: DEFAULT_PARTNER_ID.
 */
export function resolvePartnerByHostname(hostname: string): PartnerStaticConfig {
  const normalized = hostname.toLowerCase().replace(/:\d+$/, "");
  for (const partner of Object.values(PARTNERS)) {
    if (partner.primaryDomain === normalized) return partner;
    if (partner.altDomains.includes(normalized)) return partner;
  }
  // Cualquier subdominio *.lovable.app cae a Brokia por default
  return PARTNERS[DEFAULT_PARTNER_ID];
}

export function getPartnerById(id: string | null | undefined): PartnerStaticConfig {
  if (!id) return PARTNERS[DEFAULT_PARTNER_ID];
  return PARTNERS[id] ?? PARTNERS[DEFAULT_PARTNER_ID];
}