/**
 * Partner Theme Engine
 * --------------------
 * Centralizes the design tokens that each partner can customize.
 * Tokens are persisted as JSON in `partners.branding` and applied
 * at runtime as CSS variables on `document.documentElement`.
 */

export interface PartnerTheme {
  /** Background of the main app surface (body / main area). HSL "H S% L%" */
  app_bg: string;
  /** Background for cards and elevated containers. HSL */
  card_bg: string;
  /** Sidebar background. HSL */
  sidebar_bg: string;
  /** Sidebar text + icon color. HSL */
  sidebar_text: string;
  /** Sidebar visual style. */
  sidebar_style: "solid" | "gradient" | "contrast";
  /** Primary / accent color (used for buttons, active states, links). HSL */
  primary_color: string;
  /**
   * Surface mode. Controls foreground/text and border tokens so light
   * presets (white app bg) render readable text instead of inheriting the
   * default dark theme tokens. Defaults to "dark" when missing.
   */
  mode?: "dark" | "light";
  /** Optional preset key the user picked, for UX recall. */
  theme_preset?: string;
}

/** Convert "#RRGGBB" to "H S% L%" string used in CSS variables */
export function hexToHslString(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return "0 0% 0%";
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Convert "H S% L%" back to "#RRGGBB" for color picker inputs. */
export function hslStringToHex(hsl: string): string {
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return "#000000";
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Lighten/darken a HSL string by delta lightness percentage points. */
function shiftLightness(hsl: string, deltaL: number): string {
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return hsl;
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]);
  const l = Math.max(0, Math.min(100, parseFloat(m[3]) + deltaL));
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

/** Built-in presets shown in the "Cargar plantilla" menu. */
export const THEME_PRESETS: Record<string, { label: string; theme: PartnerTheme }> = {
  classic_dark: {
    label: "Classic Dark",
    theme: {
      app_bg: "0 0% 6%",
      card_bg: "0 0% 10%",
      sidebar_bg: "0 0% 8%",
      sidebar_text: "220 9% 70%",
      sidebar_style: "solid",
      primary_color: "279 65% 49%",
      theme_preset: "classic_dark",
    },
  },
  mls_standard: {
    label: "MLS Estándar (Verde/Gris)",
    theme: {
      app_bg: "220 13% 12%",
      card_bg: "220 13% 16%",
      sidebar_bg: "220 13% 9%",
      sidebar_text: "150 20% 80%",
      sidebar_style: "solid",
      primary_color: "152 76% 40%",
      theme_preset: "mls_standard",
    },
  },
  responde_pro: {
    label: "Responde Pro (Morado/Negro)",
    theme: {
      app_bg: "260 15% 8%",
      card_bg: "260 15% 12%",
      sidebar_bg: "260 20% 6%",
      sidebar_text: "270 25% 80%",
      sidebar_style: "gradient",
      primary_color: "270 75% 60%",
      theme_preset: "responde_pro",
    },
  },
  carbon_gray: {
    label: "Gris Carbón",
    theme: {
      app_bg: "0 0% 14%",
      card_bg: "0 0% 18%",
      sidebar_bg: "0 0% 11%",
      sidebar_text: "0 0% 75%",
      sidebar_style: "solid",
      primary_color: "199 89% 48%",
      theme_preset: "carbon_gray",
    },
  },
  mls_latam_light: {
    label: "MLS Latam (Claro / Rojo)",
    theme: {
      // MLS Latam — official spec.
      // Light surfaces (#FDFAFB / #FFFFFF), dark text (#1B2030), brand red
      // accent (#E14132). Main sidebar stays DARK permanently as part of the
      // brand identity, with the brand red as active state.
      app_bg: "340 33% 99%", // #FDFAFB
      card_bg: "0 0% 100%", // #FFFFFF
      sidebar_bg: "220 26% 14%", // #1B2030 (always dark)
      sidebar_text: "220 9% 70%", // #A8ADBA
      sidebar_style: "solid",
      primary_color: "4 74% 54%", // #E14132
      mode: "light",
      theme_preset: "mls_latam_light",
    },
  },
};

/** App background presets for the dropdown selector. */
export const APP_BG_PRESETS: { value: string; label: string }[] = [
  { value: "0 0% 6%", label: "Oscuro Profundo" },
  { value: "0 0% 14%", label: "Gris Carbón" },
  { value: "220 13% 12%", label: "Azul Pizarra" },
  { value: "260 15% 8%", label: "Morado Nocturno" },
  { value: "0 0% 100%", label: "Blanco Puro (Claro)" },
  { value: "0 0% 98%", label: "Gris Suave (Claro)" },
];

/** Sidebar style options. */
export const SIDEBAR_STYLE_OPTIONS: { value: PartnerTheme["sidebar_style"]; label: string }[] = [
  { value: "solid", label: "Color sólido" },
  { value: "gradient", label: "Degradado" },
  { value: "contrast", label: "Contraste" },
];

/** Default theme used when a partner has no `branding` saved yet. */
export function buildDefaultTheme(primaryHsl?: string | null): PartnerTheme {
  return {
    ...THEME_PRESETS.classic_dark.theme,
    primary_color: primaryHsl || THEME_PRESETS.classic_dark.theme.primary_color,
  };
}

/**
 * Apply a partner theme to the document root by writing CSS variables.
 * Safe to call from React effects; idempotent.
 */
export function applyPartnerTheme(theme: PartnerTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Detect surface mode. Either explicit (`mode`) or inferred from the app_bg
  // lightness: anything brighter than 50% lightness is treated as "light".
  const explicitMode = theme.mode;
  const lightnessMatch = theme.app_bg.trim().match(/(\d+(?:\.\d+)?)%\s*$/);
  const inferredLight =
    !!lightnessMatch && parseFloat(lightnessMatch[1]) >= 50;
  const isLight = explicitMode ? explicitMode === "light" : inferredLight;

  // Core surfaces
  root.style.setProperty("--background", theme.app_bg);
  root.style.setProperty("--card", theme.card_bg);
  root.style.setProperty("--popover", theme.card_bg);

  // Text + ancillary tokens that flip with the surface mode
  if (isLight) {
    root.style.setProperty("--foreground", "0 0% 10%");
    root.style.setProperty("--card-foreground", "0 0% 10%");
    root.style.setProperty("--popover-foreground", "0 0% 10%");
    root.style.setProperty("--secondary", "0 0% 96%");
    root.style.setProperty("--secondary-foreground", "0 0% 10%");
    root.style.setProperty("--muted", "0 0% 96%");
    root.style.setProperty("--muted-foreground", "0 0% 35%");
    root.style.setProperty("--accent", "0 0% 96%");
    root.style.setProperty("--accent-foreground", "0 0% 10%");
    root.style.setProperty("--border", "0 0% 90%");
    root.style.setProperty("--input", "0 0% 90%");
    root.style.setProperty("--message-incoming", "0 0% 94%");
  } else {
    root.style.setProperty("--foreground", "0 0% 100%");
    root.style.setProperty("--card-foreground", "0 0% 100%");
    root.style.setProperty("--popover-foreground", "0 0% 100%");
    root.style.setProperty("--secondary", "0 0% 16%");
    root.style.setProperty("--secondary-foreground", "0 0% 100%");
    root.style.setProperty("--muted", "0 0% 16%");
    root.style.setProperty("--muted-foreground", "220 9% 60%");
    root.style.setProperty("--accent", "217 91% 60%");
    root.style.setProperty("--accent-foreground", "0 0% 100%");
    root.style.setProperty("--border", "0 0% 17%");
    root.style.setProperty("--input", "0 0% 17%");
    root.style.setProperty("--message-incoming", "0 0% 16%");
  }

  // Primary / accent
  root.style.setProperty("--primary", theme.primary_color);
  root.style.setProperty("--ring", theme.primary_color);
  root.style.setProperty("--message-outgoing", theme.primary_color);

  // Sidebar
  let sidebarBg = theme.sidebar_bg;
  if (theme.sidebar_style === "contrast") {
    // Contrast = nudge sidebar away from the app surface. On dark themes that
    // means darker; on light themes that means slightly darker too (so the
    // sidebar looks like a separate panel rather than blending with cards).
    sidebarBg = shiftLightness(theme.sidebar_bg, isLight ? -2 : -3);
  }
  // Detect a light sidebar so accent/border shift downwards instead of up
  // (otherwise white + lighten = invisible).
  const sidebarLightnessMatch = sidebarBg.trim().match(/(\d+(?:\.\d+)?)%\s*$/);
  const sidebarIsLight =
    !!sidebarLightnessMatch && parseFloat(sidebarLightnessMatch[1]) >= 50;
  const accentDelta = sidebarIsLight ? -5 : 4;
  const borderDelta = sidebarIsLight ? -10 : 6;
  root.style.setProperty("--sidebar-background", sidebarBg);
  root.style.setProperty("--sidebar-foreground", theme.sidebar_text);
  root.style.setProperty("--sidebar-primary", theme.primary_color);
  root.style.setProperty("--sidebar-ring", theme.primary_color);
  root.style.setProperty("--sidebar-accent", shiftLightness(sidebarBg, accentDelta));
  root.style.setProperty("--sidebar-border", shiftLightness(sidebarBg, borderDelta));

  // Optional gradient surface for the sidebar background
  if (theme.sidebar_style === "gradient") {
    root.style.setProperty(
      "--sidebar-gradient",
      `linear-gradient(180deg, hsl(${sidebarBg}) 0%, hsl(${shiftLightness(sidebarBg, -4)}) 100%)`,
    );
  } else {
    root.style.removeProperty("--sidebar-gradient");
  }
}
