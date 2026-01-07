/**
 * Cassius Design System - Tokens de couleurs
 * 
 * Source unique de vérité pour toutes les couleurs de l'application.
 * Ces valeurs sont synchronisées avec les variables CSS dans index.css
 * et les configurations Tailwind.
 * 
 * Usage:
 *   import { colors, cassiusColors } from "@/design-system/tokens/colors";
 */

// ============================================================================
// COULEURS PRINCIPALES CASSIUS
// ============================================================================

export const cassiusColors = {
  /** Bleu principal - CTA, boutons primaires, liens actifs */
  mainBlue: "#2563EB",
  /** Bleu secondaire - Accents, éléments secondaires, survol */
  secondaryBlue: "#0D5C94",
  /** Bleu clair - Backgrounds légers, états hover subtils */
  lightBlue: "#DBEAFE",
  /** Bleu très clair - Backgrounds très subtils */
  paleBlue: "#EFF6FF",
} as const;

// ============================================================================
// CONVERSION HEX -> HSL (pour les variables CSS)
// ============================================================================

/**
 * Valeurs HSL correspondantes pour les variables CSS
 * Format: "H S% L%" (sans hsl() wrapper, pour Tailwind)
 */
export const cassiusColorsHSL = {
  /** #2563EB en HSL */
  mainBlue: "217 91% 60%",
  /** #0D5C94 en HSL */
  secondaryBlue: "203 83% 32%",
  /** #DBEAFE en HSL */
  lightBlue: "214 95% 93%",
  /** #EFF6FF en HSL */
  paleBlue: "214 100% 97%",
} as const;

// ============================================================================
// NEUTRES
// ============================================================================

export const neutrals = {
  white: "#FFFFFF",
  black: "#000000",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",
  gray950: "#030712",
} as const;

// ============================================================================
// COULEURS SÉMANTIQUES
// ============================================================================

export const semanticColors = {
  success: {
    light: "#DCFCE7",
    DEFAULT: "#22C55E",
    dark: "#15803D",
  },
  warning: {
    light: "#FEF3C7",
    DEFAULT: "#F59E0B",
    dark: "#B45309",
  },
  error: {
    light: "#FEE2E2",
    DEFAULT: "#EF4444",
    dark: "#B91C1C",
  },
  info: {
    light: "#DBEAFE",
    DEFAULT: "#3B82F6",
    dark: "#1D4ED8",
  },
} as const;

// ============================================================================
// COULEURS STATUTS IMPLANTS (métier)
// ============================================================================

export const implantStatusColors = {
  EN_SUIVI: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    hex: "#3B82F6",
  },
  SUCCES: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
    hex: "#22C55E",
  },
  COMPLICATION: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    hex: "#F97316",
  },
  ECHEC: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    hex: "#EF4444",
  },
} as const;

// ============================================================================
// COULEURS GRAPHIQUES STATS
// ============================================================================

export const statsChartColors = {
  chart1: "#3c83f6",  // Bleu principal
  chart2: "#9dc1fb",  // Bleu clair
  chart3: "#d399ff",  // Violet clair
  chart4: "#676da2",  // Gris violet
} as const;

export const statsChartColorsHSL = {
  chart1: "217 91% 60%",
  chart2: "215 93% 80%",
  chart3: "277 100% 80%",
  chart4: "232 24% 52%",
} as const;

// ============================================================================
// COULEURS BADGES
// ============================================================================

export const badgeColors = {
  blue: "#3c83f6",    // Bleu
  cyan: "#3abff8",    // Cyan
  orange: "#f28f3b",  // Orange
  pink: "#f92a82",    // Rose
  dark: "#303036",    // Gris foncé
} as const;

export const badgeColorsHSL = {
  blue: "217 91% 60%",
  cyan: "196 93% 60%",
  orange: "27 88% 59%",
  pink: "335 94% 57%",
  dark: "240 7% 20%",
} as const;

export const badgeColorClasses = {
  blue: "bg-[hsl(217,91%,60%)] text-white dark:bg-[hsl(217,91%,65%)]",
  cyan: "bg-[hsl(196,93%,60%)] text-white dark:bg-[hsl(196,93%,65%)]",
  orange: "bg-[hsl(27,88%,59%)] text-white dark:bg-[hsl(27,88%,65%)]",
  pink: "bg-[hsl(335,94%,57%)] text-white dark:bg-[hsl(335,94%,62%)]",
  dark: "bg-[hsl(240,7%,20%)] text-white dark:bg-[hsl(240,7%,35%)]",
} as const;

// ============================================================================
// EXPORT CONSOLIDÉ
// ============================================================================

export const colors = {
  cassius: cassiusColors,
  cassiusHSL: cassiusColorsHSL,
  neutrals,
  semantic: semanticColors,
  implantStatus: implantStatusColors,
  statsChart: statsChartColors,
  statsChartHSL: statsChartColorsHSL,
  badge: badgeColors,
  badgeHSL: badgeColorsHSL,
  badgeClasses: badgeColorClasses,
} as const;

export default colors;
