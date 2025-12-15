/**
 * Cassius Design System - Tokens d'espacement
 * 
 * Échelle d'espacement cohérente pour l'ensemble de l'application.
 * Basée sur une unité de base de 4px (0.25rem).
 */

export const spacing = {
  /** 0px */
  none: "0",
  /** 2px - Micro espacement */
  px: "1px",
  /** 2px */
  "0.5": "0.125rem",
  /** 4px - Espacement minimal */
  "1": "0.25rem",
  /** 6px */
  "1.5": "0.375rem",
  /** 8px - Petit espacement */
  "2": "0.5rem",
  /** 10px */
  "2.5": "0.625rem",
  /** 12px */
  "3": "0.75rem",
  /** 14px */
  "3.5": "0.875rem",
  /** 16px - Espacement moyen (base) */
  "4": "1rem",
  /** 20px */
  "5": "1.25rem",
  /** 24px - Espacement large */
  "6": "1.5rem",
  /** 28px */
  "7": "1.75rem",
  /** 32px */
  "8": "2rem",
  /** 36px */
  "9": "2.25rem",
  /** 40px */
  "10": "2.5rem",
  /** 48px */
  "12": "3rem",
  /** 64px - Très large */
  "16": "4rem",
  /** 80px */
  "20": "5rem",
  /** 96px */
  "24": "6rem",
} as const;

/** Espacements sémantiques pour les composants */
export const componentSpacing = {
  /** Padding interne des boutons */
  buttonPadding: {
    sm: { x: spacing["3"], y: spacing["1.5"] },
    md: { x: spacing["4"], y: spacing["2"] },
    lg: { x: spacing["6"], y: spacing["3"] },
  },
  /** Padding interne des cartes */
  cardPadding: spacing["6"],
  /** Gap entre éléments de formulaire */
  formGap: spacing["4"],
  /** Gap dans les grilles */
  gridGap: spacing["6"],
  /** Marges de section */
  sectionMargin: spacing["8"],
} as const;

export default spacing;
