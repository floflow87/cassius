/**
 * Cassius Design System - Tokens de border-radius
 * 
 * Rayons de bordure cohérents pour l'ensemble de l'application.
 */

export const radii = {
  /** Pas d'arrondi */
  none: "0",
  /** 3px - Très subtil */
  sm: "0.1875rem",
  /** 6px - Petit arrondi (défaut pour badges, inputs) */
  md: "0.375rem",
  /** 9px - Arrondi moyen (défaut pour boutons, cartes) */
  lg: "0.5625rem",
  /** 12px - Arrondi prononcé */
  xl: "0.75rem",
  /** 16px */
  "2xl": "1rem",
  /** 24px */
  "3xl": "1.5rem",
  /** Cercle parfait */
  full: "9999px",
} as const;

/** Rayons sémantiques pour les composants */
export const componentRadii = {
  /** Boutons */
  button: radii.md,
  /** Cartes */
  card: radii.lg,
  /** Badges et pills */
  badge: radii.md,
  /** Inputs et selects */
  input: radii.md,
  /** Modales et popovers */
  modal: radii.xl,
  /** Avatars */
  avatar: radii.full,
} as const;

export default radii;
