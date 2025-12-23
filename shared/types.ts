export type Sexe = "HOMME" | "FEMME";

export type TypeIntervention = 
  | "POSE_IMPLANT"
  | "GREFFE_OSSEUSE"
  | "SINUS_LIFT"
  | "EXTRACTION_IMPLANT_IMMEDIATE"
  | "REPRISE_IMPLANT"
  | "CHIRURGIE_GUIDEE";

export type TypeChirurgieTemps = "UN_TEMPS" | "DEUX_TEMPS";

export type TypeChirurgieApproche = "LAMBEAU" | "FLAPLESS";

export type TypeMiseEnCharge = "IMMEDIATE" | "PRECOCE" | "DIFFEREE";

export type PositionImplant = "CRESTAL" | "SOUS_CRESTAL" | "SUPRA_CRESTAL";

export type TypeOs = "D1" | "D2" | "D3" | "D4";

export type StatutImplant = "EN_SUIVI" | "SUCCES" | "COMPLICATION" | "ECHEC";

export type TypeRadio = "PANORAMIQUE" | "CBCT" | "RETROALVEOLAIRE";

export type Role = "CHIRURGIEN" | "ASSISTANT" | "ADMIN";

export type TypeProthese = "VISSEE" | "SCELLEE";

export type TypePilier = "DROIT" | "ANGULE" | "MULTI_UNIT";

export interface Patient {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: Sexe;
  telephone: string | null;
  email: string | null;
  contexteMedical: string | null;
  createdAt: Date;
}

export interface Operation {
  id: string;
  patientId: string;
  dateOperation: string;
  typeIntervention: TypeIntervention;
  typeChirurgieTemps: TypeChirurgieTemps | null;
  typeChirurgieApproche: TypeChirurgieApproche | null;
  greffeOsseuse: boolean | null;
  typeGreffe: string | null;
  greffeQuantite: string | null;
  greffeLocalisation: string | null;
  typeMiseEnCharge: TypeMiseEnCharge | null;
  conditionsMedicalesPreop: string | null;
  notesPerop: string | null;
  observationsPostop: string | null;
}

export type TypeImplant = "IMPLANT" | "MINI_IMPLANT";

// Implant = informations produit uniquement (catalogue/référentiel)
export interface Implant {
  id: string;
  organisationId: string;
  typeImplant: TypeImplant;
  marque: string;
  referenceFabricant: string | null;
  diametre: number;
  longueur: number;
  lot: string | null;
}

// SurgeryImplant = implant posé lors d'une chirurgie (avec contexte de pose)
export interface SurgeryImplant {
  id: string;
  organisationId: string;
  surgeryId: string;
  implantId: string;
  siteFdi: string;
  positionImplant: PositionImplant | null;
  typeOs: TypeOs | null;
  miseEnCharge: TypeMiseEnCharge | null;
  greffeOsseuse: boolean | null;
  typeGreffe: string | null;
  typeChirurgieTemps: TypeChirurgieTemps | null;
  isqPose: number | null;
  isq2m: number | null;
  isq3m: number | null;
  isq6m: number | null;
  boneLossScore: number | null;
  statut: StatutImplant;
  datePose: string;
  notes: string | null;
}

// SurgeryImplant enrichi avec les infos de l'implant et de la chirurgie
export interface SurgeryImplantWithDetails extends SurgeryImplant {
  implant: Implant;
  surgery?: Operation;
  patient?: Patient;
}

export interface Radio {
  id: string;
  organisationId: string;
  patientId: string;
  operationId: string | null;
  implantId: string | null;
  type: TypeRadio;
  title: string;
  filePath: string | null; // Supabase Storage path (nullable for legacy)
  url: string | null; // Legacy Replit URL (kept for backward compatibility)
  mimeType: string | null;
  sizeBytes: number | null;
  fileName: string | null;
  date: string;
  createdBy: string | null;
  createdAt: Date;
  signedUrl?: string | null;
}

export interface Visite {
  id: string;
  implantId: string;
  patientId: string;
  date: string;
  isq: number | null;
  notes: string | null;
  radioId: string | null;
}

export interface Prothese {
  id: string;
  implantId: string;
  protheseUnitaire: boolean;
  typeProthese: TypeProthese;
  typePilier: TypePilier | null;
  datePose: string | null;
  notes: string | null;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  nom: string | null;
  prenom: string | null;
}

export interface UserPublic {
  id: string;
  username: string;
  role: Role;
  nom: string | null;
  prenom: string | null;
}

export interface ImplantWithVisites extends Implant {
  visites: Visite[];
}

// Opération avec ses implants posés (via surgery_implants)
export interface OperationWithImplants extends Operation {
  surgeryImplants: SurgeryImplantWithDetails[];
}

// Détails d'un patient avec toutes ses données
export interface PatientDetail extends Patient {
  operations: OperationWithImplants[];
  surgeryImplants: SurgeryImplantWithDetails[]; // Tous les implants posés via surgeries
  radios: Radio[];
}

// Détails complets d'un implant posé (surgery_implant)
export interface ImplantDetail extends SurgeryImplant {
  implant: Implant;
  patient?: Patient;
  surgery?: Operation;
  visites: Visite[];
  radios: Radio[];
}

// Détails complets d'une opération (acte chirurgical)
export interface OperationDetail extends Operation {
  patient: Patient;
  surgeryImplants: SurgeryImplantWithDetails[];
  radios: Radio[];
  visites: Visite[];
}

export interface ImplantWithPatient extends SurgeryImplant {
  implant: Implant;
  patient?: Patient;
}

export interface DashboardStats {
  totalPatients: number;
  totalOperations: number;
  totalImplants: number;
  totalRadios: number;
  monthlyImplants: number;
  monthlyOperations: number;
  implantsByStatus: Record<string, number>;
  recentOperations: Operation[];
}

export interface AdvancedStats {
  successRate: number;
  complicationRate: number;
  failureRate: number;
  avgIsqPose: number;
  avgIsq3m: number;
  avgIsq6m: number;
  implantsByBrand: Record<string, number>;
  implantsBySite: Record<string, number>;
  isqTrends: IsqTrend[];
}

export interface IsqTrend {
  month: string;
  avgIsq: number;
}

export interface ClinicalStats {
  activityByPeriod: { period: string; count: number }[];
  implantsByPeriod: { period: string; count: number }[];
  totalImplantsInPeriod: number;
  actsByType: { type: string; count: number }[];
  successRate: number;
  complicationRate: number;
  failureRate: number;
  isqDistribution: { category: string; count: number }[];
  isqEvolution: { period: string; avgIsq: number }[];
  avgDelayToFirstVisit: number | null;
  implantsWithoutFollowup: {
    patientId: string;
    patientNom: string;
    patientPrenom: string;
    implantId: string;
    siteFdi: string;
    datePose: string;
    lastVisitDate: string | null;
    daysSinceVisit: number | null;
  }[];
}

export interface ImplantFilters {
  marque?: string;
  siteFdi?: string;
  typeOs?: string;
  statut?: string;
}

export interface CreatePatientInput {
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: Sexe;
  telephone?: string | null;
  email?: string | null;
  contexteMedical?: string | null;
}

export interface CreateOperationInput {
  patientId: string;
  dateOperation: string;
  typeIntervention: TypeIntervention;
  typeChirurgieTemps?: TypeChirurgieTemps | null;
  typeChirurgieApproche?: TypeChirurgieApproche | null;
  greffeOsseuse?: boolean | null;
  typeGreffe?: string | null;
  greffeQuantite?: string | null;
  greffeLocalisation?: string | null;
  typeMiseEnCharge?: TypeMiseEnCharge | null;
  conditionsMedicalesPreop?: string | null;
  notesPerop?: string | null;
  observationsPostop?: string | null;
}

// Création d'un implant (catalogue/produit)
export interface CreateImplantInput {
  typeImplant?: TypeImplant;
  marque: string;
  referenceFabricant?: string | null;
  diametre: number;
  longueur: number;
  lot?: string | null;
}

// Création d'un implant posé lors d'une chirurgie
export interface CreateSurgeryImplantInput {
  surgeryId: string;
  implantId: string;
  siteFdi: string;
  positionImplant?: PositionImplant | null;
  typeOs?: TypeOs | null;
  miseEnCharge?: TypeMiseEnCharge | null;
  greffeOsseuse?: boolean | null;
  typeGreffe?: string | null;
  typeChirurgieTemps?: TypeChirurgieTemps | null;
  isqPose?: number | null;
  statut?: StatutImplant;
  datePose: string;
  notes?: string | null;
}

// Création combinée: implant + pose en une seule opération
export interface CreateImplantWithPoseInput {
  surgeryId: string;
  // Infos implant produit
  typeImplant?: TypeImplant;
  marque: string;
  referenceFabricant?: string | null;
  diametre: number;
  longueur: number;
  lot?: string | null;
  // Infos pose
  siteFdi: string;
  positionImplant?: PositionImplant | null;
  typeOs?: TypeOs | null;
  miseEnCharge?: TypeMiseEnCharge | null;
  greffeOsseuse?: boolean | null;
  typeGreffe?: string | null;
  typeChirurgieTemps?: TypeChirurgieTemps | null;
  isqPose?: number | null;
  statut?: StatutImplant;
  datePose: string;
  notes?: string | null;
}

export interface CreateRadioInput {
  patientId: string;
  operationId?: string | null;
  implantId?: string | null;
  type: TypeRadio;
  url: string;
  date: string;
}

export interface CreateVisiteInput {
  implantId: string;
  patientId: string;
  date: string;
  isq?: number | null;
  notes?: string | null;
  radioId?: string | null;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role?: Role;
  nom?: string | null;
  prenom?: string | null;
  organisationId?: string | null;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ApiError {
  error: string;
}

export interface ApiValidationError {
  error: Array<{
    code: string;
    expected?: string;
    received?: string;
    path: string[];
    message: string;
  }>;
}

export interface DbTestResponse {
  success: boolean;
  message: string;
  tests?: {
    connexion: string;
    insert: string;
    select: string;
    delete: string;
  };
  patientTest?: {
    id: string;
    nom: string;
    prenom: string;
    dateNaissance: string;
  };
  database: string;
  timestamp: string;
  error?: string;
  conseil?: string;
}

export interface UploadUrlRequest {
  fileName: string;
  contentType: string;
  patientId: string;
  operationId?: string;
  implantId?: string;
  type: TypeRadio;
  date: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  radioId: string;
}

// === Advanced Filter Types ===

export type FilterField = 
  // Patient fields
  | "patient_nom"
  | "patient_prenom"
  | "patient_dateNaissance"
  | "patient_age"
  | "patient_statut"
  | "patient_derniereVisite"
  | "patient_implantCount"
  // Surgery fields
  | "surgery_hasSurgery"
  | "surgery_dateOperation"
  | "surgery_successRate"
  | "surgery_typeIntervention"
  // Implant fields
  | "implant_marque"
  | "implant_reference"
  | "implant_siteFdi"
  | "implant_successRate"
  | "implant_datePose"
  | "implant_statut";

export type FilterOperator = 
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "is_true"
  | "is_false"
  | "after"
  | "before"
  | "last_n_days"
  | "last_n_months"
  | "last_n_years";

export interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | number | boolean | null;
  value2?: string | number | null; // For "between" operator
}

export interface FilterGroup {
  id: string;
  operator: "AND" | "OR";
  rules: (FilterRule | FilterGroup)[];
}

export interface PatientSearchRequest {
  pagination?: {
    page: number;
    pageSize: number;
  };
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  filters?: FilterGroup;
}

export interface PatientSearchResult {
  patients: Patient[];
  implantCounts: Record<string, number>;
  lastVisits: Record<string, { date: string; titre: string | null }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterFieldConfig {
  field: FilterField;
  label: string;
  category: "patient" | "surgery" | "implant";
  type: "text" | "number" | "date" | "boolean" | "select";
  operators: FilterOperator[];
  options?: { value: string; label: string }[];
}

// Timeline types for operation detail page
export type TimelineEventType = "SURGERY" | "VISIT" | "ISQ" | "RADIO";

export interface TimelineEvent {
  type: TimelineEventType;
  at: string;
  title: string;
  description?: string;
  status: "done" | "upcoming";
  
  // For SURGERY events
  actId?: string;
  
  // For VISIT events
  visitId?: string;
  visitType?: string;
  
  // For ISQ events
  surgeryImplantId?: string;
  implantLabel?: string;
  siteFdi?: string;
  value?: number;
  stability?: "low" | "moderate" | "high";
  delta?: number;
  previousValue?: number;
  
  // For RADIO events
  radioId?: string;
  radioType?: string;
}

export interface OperationTimeline {
  operation: {
    id: string;
    dateOperation: string;
    typeIntervention: string;
    patientId: string;
    patientNom: string;
    patientPrenom: string;
  };
  events: TimelineEvent[];
}

// Global search types
export interface GlobalSearchPatient {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
}

export interface GlobalSearchActe {
  id: string;
  typeIntervention: TypeIntervention;
  dateOperation: string;
  patientId: string;
  patientNom: string;
  patientPrenom: string;
}

export interface GlobalSearchImplant {
  id: string;
  marque: string;
  referenceFabricant: string | null;
  siteFdi: string;
  patientId: string;
  patientNom: string;
  patientPrenom: string;
}

export interface GlobalSearchDocument {
  id: string;
  nom: string;
  type: string;
  patientId: string;
  patientNom: string;
  patientPrenom: string;
  date: string;
}

export interface GlobalSearchResults {
  patients: GlobalSearchPatient[];
  actes: GlobalSearchActe[];
  implants: GlobalSearchImplant[];
  documents: GlobalSearchDocument[];
}
