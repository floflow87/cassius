/**
 * Configuration centralisée du design system métier Cassius
 * 
 * Toutes les valeurs d'enums, labels et métadonnées UI sont définies ici.
 * Les valeurs correspondent exactement aux enums Drizzle dans schema.ts.
 * 
 * Usage frontend:
 *   import { STATUTS_IMPLANT, getOptionsFromConfig } from "@shared/config";
 *   const options = getOptionsFromConfig(STATUTS_IMPLANT);
 *   // => [{ value: "EN_SUIVI", label: "En suivi", color: "blue" }, ...]
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ConfigOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export type ConfigRecord<T extends string> = Record<T, ConfigOption>;

// ============================================================================
// STATUTS IMPLANT
// ============================================================================

export const STATUTS_IMPLANT = {
  EN_SUIVI: { value: "EN_SUIVI", label: "En suivi", color: "blue", description: "Implant en cours de suivi post-opératoire" },
  SUCCES: { value: "SUCCES", label: "Succès", color: "green", description: "Ostéointégration réussie" },
  COMPLICATION: { value: "COMPLICATION", label: "Complication", color: "orange", description: "Complication détectée, surveillance renforcée" },
  ECHEC: { value: "ECHEC", label: "Échec", color: "red", description: "Perte de l'implant ou échec d'ostéointégration" },
} as const;

export type StatutImplantKey = keyof typeof STATUTS_IMPLANT;

// ============================================================================
// TYPES D'INTERVENTION
// ============================================================================

export const TYPES_INTERVENTION = {
  POSE_IMPLANT: { value: "POSE_IMPLANT", label: "Pose d'implant", description: "Chirurgie de pose d'un ou plusieurs implants" },
  GREFFE_OSSEUSE: { value: "GREFFE_OSSEUSE", label: "Greffe osseuse", description: "Augmentation du volume osseux" },
  SINUS_LIFT: { value: "SINUS_LIFT", label: "Sinus lift", description: "Élévation du plancher sinusien" },
  EXTRACTION_IMPLANT_IMMEDIATE: { value: "EXTRACTION_IMPLANT_IMMEDIATE", label: "Extraction + implant immédiat", description: "Extraction dentaire suivie d'une pose immédiate" },
  REPRISE_IMPLANT: { value: "REPRISE_IMPLANT", label: "Reprise d'implant", description: "Révision ou remplacement d'un implant existant" },
  CHIRURGIE_GUIDEE: { value: "CHIRURGIE_GUIDEE", label: "Chirurgie guidée", description: "Chirurgie assistée par guide numérique" },
  POSE_PROTHESE: { value: "POSE_PROTHESE", label: "Pose de prothèse", description: "Pose d'une prothèse sur implant" },
  DEPOSE_IMPLANT: { value: "DEPOSE_IMPLANT", label: "Dépose d'implant", description: "Retrait chirurgical d'un implant" },
  DEPOSE_PROTHESE: { value: "DEPOSE_PROTHESE", label: "Dépose de prothèse", description: "Retrait d'une prothèse sur implant" },
} as const;

export type TypeInterventionKey = keyof typeof TYPES_INTERVENTION;

// ============================================================================
// TYPES DE CHIRURGIE (TEMPS)
// ============================================================================

export const TYPES_CHIRURGIE_TEMPS = {
  UN_TEMPS: { value: "UN_TEMPS", label: "Un temps", description: "Chirurgie en une seule phase" },
  DEUX_TEMPS: { value: "DEUX_TEMPS", label: "Deux temps", description: "Chirurgie en deux phases distinctes" },
} as const;

export type TypeChirurgieTempsKey = keyof typeof TYPES_CHIRURGIE_TEMPS;

// ============================================================================
// TYPES DE CHIRURGIE (APPROCHE)
// ============================================================================

export const TYPES_CHIRURGIE_APPROCHE = {
  LAMBEAU: { value: "LAMBEAU", label: "Avec lambeau", description: "Incision et décollement d'un lambeau mucopériosté" },
  FLAPLESS: { value: "FLAPLESS", label: "Flapless", description: "Technique sans lambeau, mini-invasive" },
} as const;

export type TypeChirurgieApprocheKey = keyof typeof TYPES_CHIRURGIE_APPROCHE;

// ============================================================================
// TYPES DE MISE EN CHARGE
// ============================================================================

export const TYPES_MISE_EN_CHARGE = {
  IMMEDIATE: { value: "IMMEDIATE", label: "Immédiate", color: "green", description: "Mise en charge dans les 48h post-opératoires" },
  PRECOCE: { value: "PRECOCE", label: "Précoce", color: "blue", description: "Mise en charge entre 48h et 3 mois" },
  DIFFEREE: { value: "DIFFEREE", label: "Différée", color: "gray", description: "Mise en charge après 3-6 mois de cicatrisation" },
} as const;

export type TypeMiseEnChargeKey = keyof typeof TYPES_MISE_EN_CHARGE;

// ============================================================================
// TYPES D'OS (CLASSIFICATION DE LEKHOLM & ZARB)
// ============================================================================

export const TYPES_OS = {
  D1: { value: "D1", label: "D1 - Os compact", color: "emerald", description: "Os cortical dense, quasi exclusivement cortical" },
  D2: { value: "D2", label: "D2 - Os dense", color: "green", description: "Corticale épaisse entourant un os trabéculaire dense" },
  D3: { value: "D3", label: "D3 - Os spongieux", color: "yellow", description: "Fine corticale entourant un os trabéculaire fin" },
  D4: { value: "D4", label: "D4 - Os très spongieux", color: "orange", description: "Très fine corticale, trabéculation fine et lâche" },
} as const;

export type TypeOsKey = keyof typeof TYPES_OS;

// ============================================================================
// POSITIONS IMPLANT
// ============================================================================

export const POSITIONS_IMPLANT = {
  CRESTAL: { value: "CRESTAL", label: "Crestal", description: "Plateforme au niveau de la crête osseuse" },
  SOUS_CRESTAL: { value: "SOUS_CRESTAL", label: "Sous-crestal", description: "Plateforme enfouie sous la crête" },
  SUPRA_CRESTAL: { value: "SUPRA_CRESTAL", label: "Supra-crestal", description: "Plateforme au-dessus de la crête" },
} as const;

export type PositionImplantKey = keyof typeof POSITIONS_IMPLANT;

// ============================================================================
// TYPES DE RADIOGRAPHIE
// ============================================================================

export const TYPES_RADIO = {
  PANORAMIQUE: { value: "PANORAMIQUE", label: "Panoramique", description: "Orthopantomogramme (OPT)" },
  CBCT: { value: "CBCT", label: "CBCT", description: "Cone Beam Computed Tomography (scanner 3D)" },
  RETROALVEOLAIRE: { value: "RETROALVEOLAIRE", label: "Rétroalvéolaire", description: "Radiographie intra-orale périapicale" },
} as const;

export type TypeRadioKey = keyof typeof TYPES_RADIO;

// ============================================================================
// TYPES DE PROTHÈSE
// ============================================================================

export const TYPES_PROTHESE = {
  VISSEE: { value: "VISSEE", label: "Vissée", description: "Prothèse fixée par vis transvissée" },
  SCELLEE: { value: "SCELLEE", label: "Scellée", description: "Prothèse fixée par ciment de scellement" },
} as const;

export type TypeProtheseKey = keyof typeof TYPES_PROTHESE;

// ============================================================================
// TYPES DE PILIER
// ============================================================================

export const TYPES_PILIER = {
  DROIT: { value: "DROIT", label: "Droit", description: "Pilier standard sans angulation" },
  ANGULE: { value: "ANGULE", label: "Angulé", description: "Pilier avec angulation (15°, 17°, 25°, 30°)" },
  MULTI_UNIT: { value: "MULTI_UNIT", label: "Multi-unit", description: "Pilier pour prothèse plurale transvissée" },
} as const;

export type TypePilierKey = keyof typeof TYPES_PILIER;

// ============================================================================
// SEXE
// ============================================================================

export const SEXES = {
  HOMME: { value: "HOMME", label: "Homme" },
  FEMME: { value: "FEMME", label: "Femme" },
} as const;

export type SexeKey = keyof typeof SEXES;

// ============================================================================
// RÔLES UTILISATEURS
// ============================================================================

export const ROLES = {
  CHIRURGIEN: { value: "CHIRURGIEN", label: "Collaborateur", description: "Collaborateur implantologue", color: "blue" },
  ASSISTANT: { value: "ASSISTANT", label: "Assistant(e)", description: "Assistant(e) dentaire", color: "gray" },
  ADMIN: { value: "ADMIN", label: "Administrateur", description: "Administrateur du cabinet", color: "purple" },
} as const;

export type RoleKey = keyof typeof ROLES;

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Convertit un objet de configuration en tableau d'options pour les selects/dropdowns
 * @example
 * const options = getOptionsFromConfig(STATUTS_IMPLANT);
 * // => [{ value: "EN_SUIVI", label: "En suivi", color: "blue" }, ...]
 */
export function getOptionsFromConfig<T extends string>(
  config: ConfigRecord<T>
): ConfigOption[] {
  return Object.values(config) as ConfigOption[];
}

/**
 * Récupère le label d'une valeur à partir de sa config
 * @example
 * const label = getLabelFromConfig(STATUTS_IMPLANT, "EN_SUIVI");
 * // => "En suivi"
 */
export function getLabelFromConfig<T extends string>(
  config: ConfigRecord<T>,
  value: T
): string {
  return config[value]?.label ?? value;
}

/**
 * Récupère la couleur d'une valeur à partir de sa config
 * @example
 * const color = getColorFromConfig(STATUTS_IMPLANT, "SUCCES");
 * // => "green"
 */
export function getColorFromConfig<T extends string>(
  config: ConfigRecord<T>,
  value: T
): string | undefined {
  return config[value]?.color;
}

/**
 * Récupère l'option complète d'une valeur
 * @example
 * const option = getOptionFromConfig(TYPES_OS, "D2");
 * // => { value: "D2", label: "D2 - Os dense", color: "green", description: "..." }
 */
export function getOptionFromConfig<T extends string>(
  config: ConfigRecord<T>,
  value: T
): ConfigOption | undefined {
  return config[value];
}

// ============================================================================
// EXPORT GROUPÉ POUR FACILITER L'IMPORT
// ============================================================================

export const CASSIUS_CONFIG = {
  STATUTS_IMPLANT,
  TYPES_INTERVENTION,
  TYPES_CHIRURGIE_TEMPS,
  TYPES_CHIRURGIE_APPROCHE,
  TYPES_MISE_EN_CHARGE,
  TYPES_OS,
  POSITIONS_IMPLANT,
  TYPES_RADIO,
  TYPES_PROTHESE,
  TYPES_PILIER,
  SEXES,
  ROLES,
} as const;
