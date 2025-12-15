/**
 * Cassius Design System - Tokens de typographie
 * 
 * Définit les polices, tailles et styles de texte.
 */

export const fontFamily = {
  /** Police principale (UI, contenu) */
  sans: "'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  /** Police pour les titres (optionnel, même que sans par défaut) */
  heading: "'Poppins', system-ui, sans-serif",
  /** Police monospace (code, données techniques) */
  mono: "'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
} as const;

export const fontSize = {
  /** 12px */
  xs: "0.75rem",
  /** 14px */
  sm: "0.875rem",
  /** 16px - Base */
  base: "1rem",
  /** 18px */
  lg: "1.125rem",
  /** 20px */
  xl: "1.25rem",
  /** 24px */
  "2xl": "1.5rem",
  /** 30px */
  "3xl": "1.875rem",
  /** 36px */
  "4xl": "2.25rem",
  /** 48px */
  "5xl": "3rem",
} as const;

export const fontWeight = {
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const lineHeight = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;

export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

/** Styles de texte prédéfinis */
export const textStyles = {
  h1: {
    fontSize: fontSize["4xl"],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
  },
  h4: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
  },
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
  },
} as const;

export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
} as const;

export default typography;
