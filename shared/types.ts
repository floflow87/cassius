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

export interface Implant {
  id: string;
  operationId: string;
  patientId: string;
  marque: string;
  referenceFabricant: string | null;
  diametre: number;
  longueur: number;
  siteFdi: string;
  positionImplant: PositionImplant | null;
  typeOs: TypeOs | null;
  miseEnChargePrevue: TypeMiseEnCharge | null;
  isqPose: number | null;
  isq2m: number | null;
  isq3m: number | null;
  isq6m: number | null;
  statut: StatutImplant;
  datePose: string;
}

export interface Radio {
  id: string;
  patientId: string;
  operationId: string | null;
  implantId: string | null;
  type: TypeRadio;
  url: string;
  date: string;
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

export interface OperationWithImplants extends Operation {
  implants: Implant[];
}

export interface PatientDetail extends Patient {
  operations: OperationWithImplants[];
  implants: ImplantWithVisites[];
  radios: Radio[];
}

export interface ImplantDetail extends Implant {
  patient?: Patient;
  operation?: Operation;
  visites: Visite[];
  radios: Radio[];
}

export interface ImplantWithPatient extends Implant {
  patient?: Patient;
}

export interface DashboardStats {
  totalPatients: number;
  totalOperations: number;
  totalImplants: number;
  totalRadios: number;
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

export interface CreateImplantInput {
  operationId: string;
  patientId: string;
  marque: string;
  referenceFabricant?: string | null;
  diametre: number;
  longueur: number;
  siteFdi: string;
  positionImplant?: PositionImplant | null;
  typeOs?: TypeOs | null;
  miseEnChargePrevue?: TypeMiseEnCharge | null;
  isqPose?: number | null;
  isq2m?: number | null;
  isq3m?: number | null;
  isq6m?: number | null;
  statut?: StatutImplant;
  datePose: string;
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
