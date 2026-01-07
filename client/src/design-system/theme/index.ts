/**
 * Cassius Design System - Thème central
 * 
 * Point d'entrée unique pour le thème complet de l'application.
 * Regroupe tous les tokens et configurations de style.
 * 
 * Usage:
 *   import { theme } from "@/design-system/theme";
 *   const primaryColor = theme.colors.cassius.mainBlue;
 */

import { colors, cassiusColors, cassiusColorsHSL, neutrals, semanticColors, implantStatusColors } from "../tokens/colors";
import { spacing, componentSpacing } from "../tokens/spacing";
import { typography, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles } from "../tokens/typography";
import { radii, componentRadii } from "../tokens/radii";

export const theme = {
  colors: {
    ...colors,
    primary: cassiusColors.mainBlue,
    secondary: cassiusColors.secondaryBlue,
  },
  spacing,
  componentSpacing,
  typography,
  radii,
  componentRadii,
} as const;

/** Configuration des couleurs pour intégration Tailwind */
export const tailwindColors = {
  cassius: {
    main: `hsl(${cassiusColorsHSL.mainBlue})`,
    secondary: `hsl(${cassiusColorsHSL.secondaryBlue})`,
    light: `hsl(${cassiusColorsHSL.lightBlue})`,
    pale: `hsl(${cassiusColorsHSL.paleBlue})`,
  },
} as const;

/** Classes Tailwind utilitaires pour les statuts d'implants */
export const implantStatusClasses = {
  EN_SUIVI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SUCCES: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  COMPLICATION: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  ECHEC: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
} as const;

export default theme;

// Re-export des tokens individuels pour un accès direct
export {
  colors,
  cassiusColors,
  cassiusColorsHSL,
  neutrals,
  semanticColors,
  implantStatusColors,
  spacing,
  componentSpacing,
  typography,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
  radii,
  componentRadii,
};

// Re-export des composants Design System
export {
  CassiusButton,
  CassiusBadge,
  CassiusCard,
  CassiusCardHeader,
  CassiusCardContent,
  CassiusCardFooter,
} from "../components";
