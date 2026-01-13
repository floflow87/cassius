import {
  patients,
  operations,
  implants,
  surgeryImplants,
  radios,
  visites,
  protheses,
  users,
  organisations,
  notes,
  rendezVous,
  documents,
  savedFilters,
  appointments,
  flags,
  googleCalendarEvents,
  syncConflicts,
  emailTokens,
  invitations,
  emailOutbox,
  type Patient,
  type InsertPatient,
  type Operation,
  type InsertOperation,
  type Implant,
  type InsertImplant,
  type SurgeryImplant,
  type InsertSurgeryImplant,
  type Radio,
  type InsertRadio,
  type Visite,
  type InsertVisite,
  type Prothese,
  type InsertProthese,
  type User,
  type Organisation,
  type InsertOrganisation,
  type Note,
  type InsertNote,
  type RendezVous,
  type InsertRendezVous,
  type Document,
  type InsertDocument,
  type ImplantWithStats,
  type SavedFilter,
  type InsertSavedFilter,
  type SavedFilterPageType,
  type Appointment,
  type InsertAppointment,
  type AppointmentWithDetails,
  type Flag,
  type InsertFlag,
  type FlagWithEntity,
  type FlagType,
  type AppointmentWithPatient,
  type DocumentWithDetails,
  calendarIntegrations,
  type CalendarIntegration,
  type InsertCalendarIntegration,
  type GoogleCalendarEvent,
  type SyncConflict,
  type EmailToken,
  type Invitation,
  type EmailOutbox,
  radioNotes,
  implantStatusReasons,
  implantStatusHistory,
  implantMeasurements,
  appointmentRadios,
  type RadioNote,
  type RadioNoteWithAuthor,
  type ImplantStatusReason,
  type ImplantStatusHistory,
  type ImplantStatusHistoryWithDetails,
  type ImplantMeasurement,
  type AppointmentRadio,
  SYSTEM_STATUS_REASONS,
} from "@shared/schema";
import type {
  PatientDetail,
  ImplantDetail,
  ImplantWithPatient,
  SurgeryImplantWithDetails,
  DashboardStats,
  AdvancedStats,
  ClinicalStats,
  ImplantFilters,
  CreateUserInput,
  OperationDetail,
  PatientSearchRequest,
  PatientSearchResult,
  FilterGroup,
  FilterRule,
  OperationTimeline,
  TimelineEvent,
  GlobalSearchResults,
  TopFlag,
  LatestIsq,
  DocumentTree,
  DocumentTreeNode,
  DocumentFilters,
  UnifiedFile,
  AppointmentClinicalData,
  ClinicalFlag,
  StatusSuggestion,
} from "@shared/types";
import { db, pool } from "./db";
import { eq, desc, ilike, or, and, lte, inArray, sql, gte, lt, gt, like, ne, SQL, isNull, not } from "drizzle-orm";

export type PatientSummary = {
  patients: Patient[];
  implantCounts: Record<string, number>;
  lastVisits: Record<string, { date: string; titre: string | null }>;
};

export type { DocumentTree, DocumentTreeNode, DocumentFilters };

export interface IStorage {
  // Patient methods - all require organisationId for multi-tenant isolation
  getPatients(organisationId: string): Promise<Patient[]>;
  getPatient(organisationId: string, id: string): Promise<Patient | undefined>;
  getPatientWithDetails(organisationId: string, id: string): Promise<PatientDetail | undefined>;
  createPatient(organisationId: string, patient: InsertPatient): Promise<Patient>;
  updatePatient(organisationId: string, id: string, patient: Partial<InsertPatient>): Promise<Patient | undefined>;
  deletePatient(organisationId: string, id: string): Promise<boolean>;
  searchPatients(organisationId: string, query: string): Promise<Patient[]>;
  getPatientImplantCounts(organisationId: string): Promise<Record<string, number>>;
  getPatientsWithSummary(organisationId: string): Promise<PatientSummary>;
  searchPatientsAdvanced(organisationId: string, request: PatientSearchRequest): Promise<PatientSearchResult>;

  // Operation methods
  getOperation(organisationId: string, id: string): Promise<Operation | undefined>;
  getOperationWithDetails(organisationId: string, id: string): Promise<OperationDetail | undefined>;
  getAllOperations(organisationId: string): Promise<(Operation & { patientNom: string; patientPrenom: string; implantCount: number; successRate: number | null })[]>;
  createOperation(organisationId: string, operation: InsertOperation): Promise<Operation>;
  updateOperation(organisationId: string, id: string, data: Partial<InsertOperation>): Promise<Operation | undefined>;
  deleteOperation(organisationId: string, id: string): Promise<boolean>;
  createOperationWithImplants(
    organisationId: string,
    operationData: InsertOperation,
    implantsData: Array<{
      typeImplant?: "IMPLANT" | "MINI_IMPLANT";
      marque: string;
      referenceFabricant?: string | null;
      diametre: number;
      longueur: number;
      lot?: string | null;
      siteFdi: string;
      positionImplant?: string | null;
      typeOs?: string | null;
      miseEnCharge?: string | null;
      greffeOsseuse?: boolean | null;
      typeGreffe?: string | null;
      typeChirurgieTemps?: string | null;
      isqPose?: number | null;
      notes?: string | null;
    }>
  ): Promise<{ operation: Operation; surgeryImplants: SurgeryImplant[] }>;

  // Implant catalog methods
  getImplant(organisationId: string, id: string): Promise<Implant | undefined>;
  createImplant(organisationId: string, implant: InsertImplant): Promise<Implant>;
  updateCatalogImplant(organisationId: string, id: string, updates: Partial<InsertImplant>): Promise<Implant | undefined>;
  deleteImplant(organisationId: string, id: string): Promise<boolean>;
  getAllImplants(organisationId: string): Promise<Implant[]>;
  getAllImplantsWithStats(organisationId: string): Promise<ImplantWithStats[]>;
  getImplantBrands(organisationId: string): Promise<string[]>;

  // Surgery implant methods (implants posés)
  getSurgeryImplant(organisationId: string, id: string): Promise<SurgeryImplant | undefined>;
  getSurgeryImplantWithDetails(organisationId: string, id: string): Promise<ImplantDetail | undefined>;
  getPatientSurgeryImplants(organisationId: string, patientId: string): Promise<SurgeryImplantWithDetails[]>;
  getSurgeryImplantsByCatalogImplant(organisationId: string, implantId: string): Promise<SurgeryImplantWithDetails[]>;
  getAllSurgeryImplants(organisationId: string): Promise<SurgeryImplantWithDetails[]>;
  filterSurgeryImplants(organisationId: string, filters: ImplantFilters): Promise<ImplantWithPatient[]>;
  createSurgeryImplant(organisationId: string, data: InsertSurgeryImplant): Promise<SurgeryImplant>;
  deleteSurgeryImplants(organisationId: string, ids: string[]): Promise<number>;

  // Radio methods
  getRadio(organisationId: string, id: string): Promise<Radio | undefined>;
  getPatientRadios(organisationId: string, patientId: string): Promise<Radio[]>;
  createRadio(organisationId: string, radio: InsertRadio & { createdBy?: string | null }): Promise<Radio>;
  updateRadio(organisationId: string, id: string, updates: { title?: string }): Promise<Radio | undefined>;
  deleteRadio(organisationId: string, id: string): Promise<boolean>;

  // Visite methods
  getVisite(organisationId: string, id: string): Promise<Visite | undefined>;
  getImplantVisites(organisationId: string, implantId: string): Promise<Visite[]>;
  createVisite(organisationId: string, visite: InsertVisite): Promise<Visite>;
  getPatientLastVisits(organisationId: string): Promise<Record<string, { date: string; titre: string | null }>>;
  findSurgeryImplantForVisite(organisationId: string, catalogImplantId: string, patientId: string): Promise<string | null>;
  syncVisiteIsqToSurgeryImplant(organisationId: string, surgeryImplantId: string, isqValue: number, visiteDate: string): Promise<void>;

  // Prothese methods
  createProthese(organisationId: string, prothese: InsertProthese): Promise<Prothese>;
  getImplantProtheses(organisationId: string, implantId: string): Promise<Prothese[]>;

  // Stats methods
  getStats(organisationId: string): Promise<DashboardStats>;
  getAdvancedStats(organisationId: string): Promise<AdvancedStats>;
  getClinicalStats(organisationId: string, dateFrom?: string, dateTo?: string, implantModelId?: string, patientIds?: string[], operationIds?: string[]): Promise<ClinicalStats>;
  getPatientStats(organisationId: string): Promise<import("@shared/types").PatientStats[]>;

  // User methods (not tenant-filtered, users are global)
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: CreateUserInput): Promise<User>;
  updateUser(id: string, data: Partial<{ password: string; role: "ADMIN" | "CHIRURGIEN" | "ASSISTANT"; nom: string | null; prenom: string | null }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getUsersByOrganisation(organisationId: string): Promise<User[]>;

  // Organisation methods
  createOrganisation(data: InsertOrganisation): Promise<Organisation>;
  getOrganisationById(id: string): Promise<Organisation | undefined>;
  updateOrganisation(id: string, data: Partial<{ nom: string; adresse: string; timezone: string }>): Promise<Organisation | undefined>;

  // Note methods
  getPatientNotes(organisationId: string, patientId: string): Promise<(Note & { user: { nom: string | null; prenom: string | null } })[]>;
  createNote(organisationId: string, userId: string, note: InsertNote): Promise<Note>;
  updateNote(organisationId: string, id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(organisationId: string, id: string): Promise<boolean>;

  // RendezVous methods
  getPatientRendezVous(organisationId: string, patientId: string): Promise<RendezVous[]>;
  getPatientUpcomingRendezVous(organisationId: string, patientId: string): Promise<RendezVous[]>;
  createRendezVous(organisationId: string, rdv: InsertRendezVous): Promise<RendezVous>;
  updateRendezVous(organisationId: string, id: string, rdv: Partial<InsertRendezVous>): Promise<RendezVous | undefined>;
  deleteRendezVous(organisationId: string, id: string): Promise<boolean>;

  // Appointment methods (unified RDV)
  getAllAppointments(organisationId: string, status?: string): Promise<Appointment[]>;
  getAllAppointmentsWithPatient(organisationId: string, status?: string): Promise<AppointmentWithPatient[]>;
  getCalendarAppointments(organisationId: string, filters: import('../shared/types').CalendarFilters): Promise<import('../shared/types').CalendarAppointment[]>;
  getAppointment(organisationId: string, id: string): Promise<Appointment | undefined>;
  getAppointmentWithDetails(organisationId: string, id: string): Promise<AppointmentWithDetails | undefined>;
  getPatientAppointments(organisationId: string, patientId: string): Promise<Appointment[]>;
  getPatientUpcomingAppointments(organisationId: string, patientId: string): Promise<Appointment[]>;
  getPatientCompletedAppointments(organisationId: string, patientId: string): Promise<Appointment[]>;
  createAppointment(organisationId: string, appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(organisationId: string, id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(organisationId: string, id: string): Promise<boolean>;

  // Document methods
  getDocument(organisationId: string, id: string): Promise<Document | undefined>;
  getPatientDocuments(organisationId: string, patientId: string): Promise<Document[]>;
  getDocumentTree(organisationId: string): Promise<DocumentTree>;
  getDocumentsFiltered(organisationId: string, filters: DocumentFilters): Promise<{ documents: DocumentWithDetails[]; totalCount: number }>;
  createDocument(organisationId: string, doc: InsertDocument & { createdBy?: string | null }): Promise<Document>;
  updateDocument(organisationId: string, id: string, updates: { title?: string; tags?: string[]; patientId?: string | null; operationId?: string | null }): Promise<Document | undefined>;
  deleteDocument(organisationId: string, id: string): Promise<boolean>;

  // SavedFilter methods
  getSavedFilters(organisationId: string, pageType: SavedFilterPageType): Promise<SavedFilter[]>;
  createSavedFilter(organisationId: string, filter: InsertSavedFilter): Promise<SavedFilter>;
  deleteSavedFilter(organisationId: string, id: string): Promise<boolean>;

  // Timeline methods
  getOperationTimeline(organisationId: string, operationId: string): Promise<OperationTimeline | null>;
  
  // Global search
  globalSearch(organisationId: string, query: string, limit?: number): Promise<GlobalSearchResults>;

  // Flag methods
  getFlags(organisationId: string, includeResolved?: boolean): Promise<Flag[]>;
  getFlagsWithEntity(organisationId: string, includeResolved?: boolean): Promise<FlagWithEntity[]>;
  getEntityFlags(organisationId: string, entityType: string, entityId: string): Promise<Flag[]>;
  createFlag(organisationId: string, flag: InsertFlag): Promise<Flag>;
  resolveFlag(organisationId: string, id: string, userId: string): Promise<Flag | undefined>;
  resolveFlagByTypeAndPatient(organisationId: string, type: FlagType, patientId: string, userId: string): Promise<number>;
  deleteFlag(organisationId: string, id: string): Promise<boolean>;
  upsertFlag(organisationId: string, flag: InsertFlag): Promise<Flag>;
  
  // Flag aggregation methods
  getPatientFlagSummary(organisationId: string, patientId: string): Promise<{ topFlag?: TopFlag; activeFlagCount: number }>;
  getAllPatientFlagSummaries(organisationId: string): Promise<Map<string, { topFlag?: TopFlag; activeFlagCount: number }>>;
  getSurgeryImplantFlagSummary(organisationId: string, surgeryImplantId: string): Promise<{ topFlag?: TopFlag; activeFlagCount: number }>;
  
  // Calendar integration methods (multi-tenant: org-level or user-level)
  getCalendarIntegration(organisationId: string, userId?: string): Promise<CalendarIntegration | undefined>;
  getActiveIntegrationForAppointment(organisationId: string, assignedUserId?: string | null): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(organisationId: string, data: InsertCalendarIntegration): Promise<CalendarIntegration>;
  updateCalendarIntegration(organisationId: string, id: string, data: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined>;
  deleteCalendarIntegration(organisationId: string, id: string): Promise<boolean>;
  getAppointmentsForSync(organisationId: string, lastSyncAt?: Date): Promise<(Appointment & { patient?: { nom: string; prenom: string } })[]>;
  updateAppointmentSync(organisationId: string, id: string, data: { externalProvider?: string; externalCalendarId?: string; externalEventId?: string; externalEtag?: string; syncStatus?: string; lastSyncedAt?: Date; syncError?: string | null }): Promise<void>;
  updateIntegrationSyncStatus(organisationId: string, id: string, data: { lastSyncAt?: Date; syncErrorCount?: number; lastSyncError?: string | null }): Promise<void>;
  
  // V2: Google Calendar Import (Google -> Cassius)
  upsertGoogleCalendarEvent(organisationId: string, data: {
    integrationId: string;
    googleCalendarId: string;
    googleEventId: string;
    etag?: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
    summary?: string | null;
    description?: string | null;
    location?: string | null;
    startAt?: Date | null;
    endAt?: Date | null;
    allDay?: boolean;
    attendees?: string | null;
    htmlLink?: string | null;
    updatedAtGoogle?: Date | null;
  }): Promise<{ isNew: boolean; event: GoogleCalendarEvent }>;
  getGoogleCalendarEvents(organisationId: string, startDate: Date, endDate: Date): Promise<GoogleCalendarEvent[]>;
  getGoogleCalendarEventsCount(organisationId: string): Promise<number>;
  getSyncConflicts(organisationId: string, status: 'open' | 'resolved' | 'ignored'): Promise<SyncConflict[]>;
  resolveConflict(organisationId: string, id: string, status: 'resolved' | 'ignored', userId: string | null): Promise<void>;

  // Email token methods (password reset, email verification)
  createEmailToken(data: { userId?: string | null; email: string; type: 'PASSWORD_RESET' | 'EMAIL_VERIFY'; tokenHash: string; expiresAt: Date }): Promise<EmailToken>;
  getEmailTokenByHash(tokenHash: string): Promise<EmailToken | undefined>;
  markEmailTokenUsed(id: string): Promise<void>;
  invalidateEmailTokens(email: string, type: 'PASSWORD_RESET' | 'EMAIL_VERIFY'): Promise<void>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserEmailVerified(userId: string): Promise<void>;

  // Invitation methods
  createInvitation(organisationId: string, data: { email: string; role: 'ADMIN' | 'CHIRURGIEN' | 'ASSISTANT'; tokenHash: string; expiresAt: Date; invitedByUserId: string; nom?: string | null; prenom?: string | null }): Promise<Invitation>;
  getInvitationByToken(tokenHash: string): Promise<Invitation | undefined>;
  getInvitationsByOrganisation(organisationId: string): Promise<Invitation[]>;
  acceptInvitation(id: string): Promise<void>;
  cancelInvitation(organisationId: string, id: string): Promise<void>;
  getInvitationByEmail(organisationId: string, email: string): Promise<Invitation | undefined>;
  getInvitationById(id: string): Promise<Invitation | undefined>;
  deleteInvitation(id: string): Promise<void>;

  // Email outbox methods
  logEmail(data: { organisationId?: string | null; toEmail: string; template: string; subject: string; payload?: string | null; status: 'PENDING' | 'SENT' | 'FAILED'; sentAt?: Date | null; errorMessage?: string | null }): Promise<EmailOutbox>;
  updateEmailStatus(id: string, status: 'PENDING' | 'SENT' | 'FAILED', errorMessage?: string | null): Promise<void>;

  // Radio notes methods
  getRadioNotes(organisationId: string, radioId: string): Promise<import("@shared/schema").RadioNoteWithAuthor[]>;
  createRadioNote(organisationId: string, authorId: string, radioId: string, body: string): Promise<import("@shared/schema").RadioNote>;
  updateRadioNote(organisationId: string, id: string, body: string): Promise<import("@shared/schema").RadioNote | undefined>;
  deleteRadioNote(organisationId: string, id: string): Promise<boolean>;

  // Implant status reasons methods
  getStatusReasons(organisationId: string, status?: 'SUCCES' | 'COMPLICATION' | 'ECHEC'): Promise<import("@shared/schema").ImplantStatusReason[]>;
  createStatusReason(organisationId: string, data: { status: 'SUCCES' | 'COMPLICATION' | 'ECHEC'; code: string; label: string }): Promise<import("@shared/schema").ImplantStatusReason>;
  seedSystemStatusReasons(): Promise<void>;

  // Implant status history methods
  getImplantStatusHistory(organisationId: string, implantId: string): Promise<import("@shared/schema").ImplantStatusHistoryWithDetails[]>;
  changeImplantStatus(organisationId: string, data: { implantId: string; fromStatus?: 'EN_SUIVI' | 'SUCCES' | 'COMPLICATION' | 'ECHEC' | null; toStatus: 'EN_SUIVI' | 'SUCCES' | 'COMPLICATION' | 'ECHEC'; reasonId?: string | null; reasonFreeText?: string | null; evidence?: string | null; changedByUserId: string }): Promise<import("@shared/schema").ImplantStatusHistory>;

  // Implant measurements methods (source of truth for ISQ)
  upsertImplantMeasurement(organisationId: string, data: {
    surgeryImplantId: string;
    appointmentId: string;
    type: 'POSE' | 'FOLLOW_UP' | 'CONTROL' | 'EMERGENCY';
    isqValue: number | null;
    notes?: string | null;
    measuredByUserId: string;
    measuredAt: Date;
  }): Promise<import("@shared/schema").ImplantMeasurement>;
  getImplantMeasurements(organisationId: string, surgeryImplantId: string): Promise<import("@shared/schema").ImplantMeasurement[]>;
  getAppointmentMeasurement(organisationId: string, appointmentId: string): Promise<import("@shared/schema").ImplantMeasurement | undefined>;
  getAppointmentClinicalData(organisationId: string, appointmentId: string): Promise<import("@shared/types").AppointmentClinicalData | undefined>;
  calculateIsqFlags(organisationId: string, surgeryImplantId: string): Promise<import("@shared/types").ClinicalFlag[]>;
  generateStatusSuggestions(organisationId: string, surgeryImplantId: string, flags: import("@shared/types").ClinicalFlag[]): Promise<import("@shared/types").StatusSuggestion[]>;
  
  // Appointment radio linking methods
  getAppointmentRadios(organisationId: string, appointmentId: string): Promise<import("@shared/schema").AppointmentRadio[]>;
  linkRadioToAppointment(organisationId: string, appointmentId: string, radioId: string, linkedBy: string, notes?: string): Promise<import("@shared/schema").AppointmentRadio>;
  unlinkRadioFromAppointment(organisationId: string, appointmentId: string, radioId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // ========== PATIENTS ==========
  async getPatients(organisationId: string): Promise<Patient[]> {
    return db.select().from(patients)
      .where(eq(patients.organisationId, organisationId))
      .orderBy(desc(patients.createdAt));
  }

  async getPatient(organisationId: string, id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients)
      .where(and(
        eq(patients.id, id),
        eq(patients.organisationId, organisationId)
      ));
    return patient || undefined;
  }

  async getPatientWithDetails(organisationId: string, id: string): Promise<PatientDetail | undefined> {
    // Optimized: Uses batch queries instead of N+1 pattern
    // 4 queries total instead of 1 + N + N*M queries
    
    const patient = await this.getPatient(organisationId, id);
    if (!patient) return undefined;

    // Query 2: Get all operations for patient
    const patientOperations = await db
      .select()
      .from(operations)
      .where(and(
        eq(operations.patientId, id),
        eq(operations.organisationId, organisationId)
      ))
      .orderBy(desc(operations.dateOperation));

    // Query 3: Get all surgery_implants with their catalog implants in one batch query
    const operationIds = patientOperations.map(op => op.id);
    let allSurgeryImplantsData: Array<{
      surgeryImplant: SurgeryImplant;
      implant: Implant;
    }> = [];
    
    if (operationIds.length > 0) {
      const joinedData = await db
        .select({
          surgeryImplant: surgeryImplants,
          implant: implants,
        })
        .from(surgeryImplants)
        .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
        .where(and(
          inArray(surgeryImplants.surgeryId, operationIds),
          eq(surgeryImplants.organisationId, organisationId)
        ));
      allSurgeryImplantsData = joinedData;
    }

    // Build a map of surgeryId -> surgery_implants with details
    const surgeryImplantsMap = new Map<string, SurgeryImplantWithDetails[]>();
    const allSurgeryImplants: SurgeryImplantWithDetails[] = [];
    
    // Create a map of operationId -> operation for quick lookups
    const operationsMap = new Map<string, Operation>();
    for (const op of patientOperations) {
      operationsMap.set(op.id, op);
      surgeryImplantsMap.set(op.id, []);
    }

    // Group surgery implants by surgery
    for (const { surgeryImplant, implant } of allSurgeryImplantsData) {
      const surgery = operationsMap.get(surgeryImplant.surgeryId);
      if (surgery) {
        const withDetails: SurgeryImplantWithDetails = {
          ...surgeryImplant,
          implant,
          surgery,
          patient,
        };
        surgeryImplantsMap.get(surgeryImplant.surgeryId)?.push(withDetails);
        allSurgeryImplants.push(withDetails);
      }
    }

    // Build operations with their surgery implants
    const operationsWithSurgeryImplants = patientOperations.map(op => ({
      ...op,
      surgeryImplants: surgeryImplantsMap.get(op.id) || [],
    }));

    // Query 4: Get all radios for patient
    const patientRadios = await db
      .select()
      .from(radios)
      .where(and(
        eq(radios.patientId, id),
        eq(radios.organisationId, organisationId)
      ))
      .orderBy(desc(radios.date));

    return {
      ...patient,
      operations: operationsWithSurgeryImplants,
      surgeryImplants: allSurgeryImplants,
      radios: patientRadios,
    };
  }

  async createPatient(organisationId: string, patient: InsertPatient): Promise<Patient> {
    const [newPatient] = await db.insert(patients).values({
      ...patient,
      organisationId,
    }).returning();
    return newPatient;
  }

  async updatePatient(organisationId: string, id: string, patient: Partial<InsertPatient>): Promise<Patient | undefined> {
    const [updated] = await db.update(patients)
      .set(patient)
      .where(and(
        eq(patients.id, id),
        eq(patients.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deletePatient(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(patients)
      .where(and(
        eq(patients.id, id),
        eq(patients.organisationId, organisationId)
      ))
      .returning({ id: patients.id });
    return result.length > 0;
  }

  async searchPatients(organisationId: string, query: string): Promise<Patient[]> {
    const searchTerm = `%${query}%`;
    return db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.organisationId, organisationId),
          or(
            ilike(patients.nom, searchTerm),
            ilike(patients.prenom, searchTerm),
            ilike(patients.email, searchTerm)
          )
        )
      )
      .orderBy(desc(patients.createdAt));
  }

  async getPatientImplantCounts(organisationId: string): Promise<Record<string, number>> {
    const result = await db
      .select({
        patientId: operations.patientId,
      })
      .from(surgeryImplants)
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .where(eq(surgeryImplants.organisationId, organisationId));
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.patientId] = (counts[row.patientId] || 0) + 1;
    }
    return counts;
  }

  async getPatientsWithSummary(organisationId: string): Promise<PatientSummary> {
    // OPTIMIZATION: Combines 3 separate API calls into 1 for the patient list view
    // Runs 3 queries in parallel for better performance
    const [patientsList, implantCounts, lastVisits] = await Promise.all([
      this.getPatients(organisationId),
      this.getPatientImplantCounts(organisationId),
      this.getPatientLastVisits(organisationId),
    ]);
    
    return {
      patients: patientsList,
      implantCounts,
      lastVisits,
    };
  }

  async searchPatientsAdvanced(organisationId: string, request: PatientSearchRequest): Promise<PatientSearchResult> {
    const { pagination, sort, filters } = request;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const sortField = sort?.field ?? "nom";
    const sortDir = sort?.direction ?? "asc";

    // Build WHERE clause based on filters
    const { whereClause, params } = this.buildFilterSql(filters, organisationId);
    
    // Determine if we need JOINs based on filter fields
    const needsSurgeryJoin = this.filterUsesField(filters, ["surgery_", "implant_"]);
    const needsImplantJoin = this.filterUsesField(filters, ["implant_"]);
    const needsLastVisitJoin = this.filterUsesField(filters, ["patient_derniereVisite"]);
    
    // Build FROM clause with necessary JOINs
    let fromClause = "patients p";
    if (needsSurgeryJoin) {
      fromClause += " LEFT JOIN operations o ON o.patient_id = p.id AND o.organisation_id = p.organisation_id";
    }
    if (needsImplantJoin) {
      fromClause += " LEFT JOIN surgery_implants si ON si.surgery_id = o.id AND si.organisation_id = p.organisation_id";
      fromClause += " LEFT JOIN implants i ON i.id = si.implant_id";
    }
    if (needsLastVisitJoin) {
      fromClause += ` LEFT JOIN LATERAL (
        SELECT date_start as date FROM appointments WHERE patient_id = p.id AND organisation_id = p.organisation_id AND status = 'COMPLETED'
        ORDER BY date_start DESC LIMIT 1
      ) last_rv ON true`;
    }
    
    // Build sort clause
    const sortColumn = this.getSortColumn(sortField);
    const sortClause = `${sortColumn} ${sortDir === "desc" ? "DESC" : "ASC"} NULLS LAST`;
    
    // Count query (distinct patients)
    const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM ${fromClause} WHERE ${whereClause}`;
    
    // Main query with pagination
    const mainSql = `
      SELECT DISTINCT p.* 
      FROM ${fromClause} 
      WHERE ${whereClause} 
      ORDER BY ${sortClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    
    try {
      // Execute queries
      const [countResult, patientsResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(mainSql, params),
      ]);
      
      const total = parseInt(countResult.rows[0]?.total ?? "0", 10);
      const patientRows = patientsResult.rows;
      
      // Map to Patient type
      const patientList: Patient[] = patientRows.map((row: any) => ({
        id: row.id,
        organisationId: row.organisation_id,
        nom: row.nom,
        prenom: row.prenom,
        dateNaissance: row.date_naissance,
        sexe: row.sexe,
        telephone: row.telephone,
        email: row.email,
        adresse: row.adresse,
        codePostal: row.code_postal,
        ville: row.ville,
        pays: row.pays,
        allergies: row.allergies,
        traitement: row.traitement,
        conditions: row.conditions,
        contexteMedical: row.contexte_medical,
        statut: row.statut,
        createdAt: row.created_at,
      }));
      
      // Get implant counts and last visits for these patients
      const patientIds = patientList.map(p => p.id);
      const [implantCounts, lastVisits] = await Promise.all([
        this.getImplantCountsForPatients(organisationId, patientIds),
        this.getLastVisitsForPatients(organisationId, patientIds),
      ]);
      
      return {
        patients: patientList,
        implantCounts,
        lastVisits,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error("[SEARCH] Advanced patient search failed:", error);
      throw error;
    }
  }

  private filterUsesField(filters: FilterGroup | undefined, prefixes: string[]): boolean {
    if (!filters) return false;
    
    const checkRule = (rule: FilterRule | FilterGroup): boolean => {
      if ("field" in rule) {
        return prefixes.some(prefix => rule.field.startsWith(prefix));
      }
      return rule.rules.some(checkRule);
    };
    
    return filters.rules.some(checkRule);
  }

  private getSortColumn(field: string): string {
    const mapping: Record<string, string> = {
      nom: "p.nom",
      prenom: "p.prenom",
      dateNaissance: "p.date_naissance",
      statut: "p.statut",
      createdAt: "p.created_at",
    };
    return mapping[field] || "p.nom";
  }

  private buildFilterSql(filters: FilterGroup | undefined, organisationId: string): { whereClause: string; params: any[] } {
    const params: any[] = [organisationId];
    let paramIndex = 2;
    
    if (!filters || filters.rules.length === 0) {
      return { whereClause: "p.organisation_id = $1", params };
    }
    
    const buildCondition = (rule: FilterRule | FilterGroup): string => {
      if ("operator" in rule && "rules" in rule) {
        // It's a FilterGroup
        const group = rule as FilterGroup;
        if (group.rules.length === 0) return "TRUE";
        const conditions = group.rules.map(buildCondition);
        return `(${conditions.join(` ${group.operator} `)})`;
      }
      
      // It's a FilterRule
      const filterRule = rule as FilterRule;
      const { field, operator, value, value2 } = filterRule;
      
      // Get the SQL column for this field
      const column = this.getColumnForField(field);
      if (!column) return "TRUE";
      
      // Numeric fields that need value coercion
      const numericFields = ["patient_age", "patient_implantCount", "implant_successRate", "surgery_successRate"];
      const isNumericField = numericFields.includes(field);
      
      // Helper to coerce values to numbers for numeric fields
      const coerceValue = (v: any) => {
        if (isNumericField && v !== null && v !== undefined && v !== "") {
          const num = Number(v);
          return isNaN(num) ? v : num;
        }
        return v;
      };
      
      // Build the condition based on operator
      switch (operator) {
        case "equals":
          params.push(coerceValue(value));
          return `${column} = $${paramIndex++}`;
        case "not_equals":
          params.push(coerceValue(value));
          return `${column} != $${paramIndex++}`;
        case "contains":
          params.push(`%${value}%`);
          return `${column} ILIKE $${paramIndex++}`;
        case "not_contains":
          params.push(`%${value}%`);
          return `${column} NOT ILIKE $${paramIndex++}`;
        case "greater_than":
          params.push(coerceValue(value));
          return `${column} > $${paramIndex++}`;
        case "greater_than_or_equal":
          params.push(coerceValue(value));
          return `${column} >= $${paramIndex++}`;
        case "less_than":
          params.push(coerceValue(value));
          return `${column} < $${paramIndex++}`;
        case "less_than_or_equal":
          params.push(coerceValue(value));
          return `${column} <= $${paramIndex++}`;
        case "between":
          params.push(coerceValue(value), coerceValue(value2));
          return `${column} BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        case "is_true":
          return `${column} = TRUE`;
        case "is_false":
          return `${column} = FALSE OR ${column} IS NULL`;
        case "after":
          params.push(value);
          return `${column} > $${paramIndex++}`;
        case "before":
          params.push(value);
          return `${column} < $${paramIndex++}`;
        case "last_n_days":
          params.push(value);
          return `${column} >= CURRENT_DATE - ($${paramIndex++} || ' days')::interval`;
        case "last_n_months":
          params.push(value);
          return `${column} >= CURRENT_DATE - ($${paramIndex++} || ' months')::interval`;
        case "last_n_years":
          params.push(value);
          return `${column} >= CURRENT_DATE - ($${paramIndex++} || ' years')::interval`;
        default:
          return "TRUE";
      }
    };
    
    const filterCondition = buildCondition(filters);
    return {
      whereClause: `p.organisation_id = $1 AND ${filterCondition}`,
      params,
    };
  }

  private getColumnForField(field: string): string | null {
    const mapping: Record<string, string> = {
      // Patient fields
      patient_nom: "p.nom",
      patient_prenom: "p.prenom",
      patient_dateNaissance: "p.date_naissance",
      patient_age: "CASE WHEN p.date_naissance IS NOT NULL THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_naissance::date))::integer ELSE NULL END",
      patient_statut: "p.statut",
      patient_derniereVisite: "last_rv.date",
      patient_implantCount: "(SELECT COUNT(*) FROM surgery_implants si2 JOIN operations o2 ON si2.surgery_id = o2.id WHERE o2.patient_id = p.id)",
      // Surgery fields
      surgery_hasSurgery: "(SELECT COUNT(*) FROM operations o3 WHERE o3.patient_id = p.id) > 0",
      surgery_dateOperation: "o.date_operation",
      surgery_successRate: "CASE WHEN si.statut = 'SUCCES' THEN 100 WHEN si.statut = 'ECHEC' THEN 0 WHEN si.statut = 'COMPLICATION' THEN 50 ELSE NULL END",
      surgery_typeIntervention: "o.type_intervention",
      // Implant fields
      implant_marque: "i.marque",
      implant_reference: "i.reference_fabricant",
      implant_siteFdi: "si.site_fdi",
      implant_successRate: "CASE WHEN si.bone_loss_score IS NULL THEN NULL ELSE (5 - si.bone_loss_score) * 20 END",
      implant_datePose: "si.date_pose",
      implant_statut: "si.statut",
    };
    return mapping[field] || null;
  }

  private async getImplantCountsForPatients(organisationId: string, patientIds: string[]): Promise<Record<string, number>> {
    if (patientIds.length === 0) return {};
    
    const result = await db
      .select({
        patientId: operations.patientId,
      })
      .from(surgeryImplants)
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .where(and(
        eq(surgeryImplants.organisationId, organisationId),
        inArray(operations.patientId, patientIds)
      ));
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.patientId] = (counts[row.patientId] || 0) + 1;
    }
    return counts;
  }

  private async getLastVisitsForPatients(organisationId: string, patientIds: string[]): Promise<Record<string, { date: string; titre: string | null }>> {
    if (patientIds.length === 0) return {};
    
    const result = await db
      .select({
        patientId: rendezVous.patientId,
        date: rendezVous.date,
        titre: rendezVous.titre,
      })
      .from(rendezVous)
      .where(and(
        eq(rendezVous.organisationId, organisationId),
        inArray(rendezVous.patientId, patientIds)
      ))
      .orderBy(desc(rendezVous.date));
    
    const visits: Record<string, { date: string; titre: string | null }> = {};
    for (const row of result) {
      if (!visits[row.patientId]) {
        visits[row.patientId] = { date: row.date, titre: row.titre };
      }
    }
    return visits;
  }

  // ========== GLOBAL SEARCH ==========
  async globalSearch(organisationId: string, query: string, limit: number = 5): Promise<GlobalSearchResults> {
    if (!query || query.trim().length < 2) {
      return { patients: [], actes: [], implants: [], documents: [] };
    }

    const searchTerm = `%${query.trim()}%`;
    
    // Run all searches in parallel for performance
    const [patientsResult, actesResult, implantsResult, documentsResult] = await Promise.all([
      // Search patients by nom or prenom
      db.execute<{ id: string; nom: string; prenom: string; date_naissance: string }>(sql`
        SELECT id, nom, prenom, date_naissance
        FROM patients
        WHERE organisation_id = ${organisationId}
          AND (nom ILIKE ${searchTerm} OR prenom ILIKE ${searchTerm} 
               OR CONCAT(prenom, ' ', nom) ILIKE ${searchTerm}
               OR CONCAT(nom, ' ', prenom) ILIKE ${searchTerm})
        ORDER BY nom, prenom
        LIMIT ${limit}
      `),
      
      // Search actes by type intervention or patient name
      db.execute<{ 
        id: string; 
        type_intervention: string; 
        date_operation: string;
        patient_id: string;
        patient_nom: string;
        patient_prenom: string;
      }>(sql`
        SELECT o.id, o.type_intervention, o.date_operation, 
               p.id as patient_id, p.nom as patient_nom, p.prenom as patient_prenom
        FROM operations o
        JOIN patients p ON o.patient_id = p.id AND p.organisation_id = ${organisationId}
        WHERE o.organisation_id = ${organisationId}
          AND (o.type_intervention::TEXT ILIKE ${searchTerm} 
               OR p.nom ILIKE ${searchTerm} 
               OR p.prenom ILIKE ${searchTerm}
               OR CONCAT(p.prenom, ' ', p.nom) ILIKE ${searchTerm})
        ORDER BY o.date_operation DESC
        LIMIT ${limit}
      `),
      
      // Search implants by marque, reference or patient name
      db.execute<{ 
        id: string; 
        marque: string; 
        reference_fabricant: string | null;
        site_fdi: string;
        patient_id: string;
        patient_nom: string;
        patient_prenom: string;
      }>(sql`
        SELECT si.id, i.marque, i.reference_fabricant, si.site_fdi,
               p.id as patient_id, p.nom as patient_nom, p.prenom as patient_prenom
        FROM surgery_implants si
        JOIN implants i ON si.implant_id = i.id AND i.organisation_id = ${organisationId}
        JOIN operations o ON si.surgery_id = o.id AND o.organisation_id = ${organisationId}
        JOIN patients p ON o.patient_id = p.id AND p.organisation_id = ${organisationId}
        WHERE si.organisation_id = ${organisationId}
          AND (i.marque ILIKE ${searchTerm} 
               OR i.reference_fabricant ILIKE ${searchTerm}
               OR si.site_fdi ILIKE ${searchTerm}
               OR p.nom ILIKE ${searchTerm} 
               OR p.prenom ILIKE ${searchTerm})
        ORDER BY si.date_pose DESC
        LIMIT ${limit}
      `),
      
      // Search documents by title, file_name or patient name
      db.execute<{ 
        id: string; 
        title: string; 
        file_name: string;
        created_at: string;
        patient_id: string;
        patient_nom: string;
        patient_prenom: string;
      }>(sql`
        SELECT d.id, d.title, d.file_name, d.created_at,
               p.id as patient_id, p.nom as patient_nom, p.prenom as patient_prenom
        FROM documents d
        JOIN patients p ON d.patient_id = p.id AND p.organisation_id = ${organisationId}
        WHERE d.organisation_id = ${organisationId}
          AND (d.title ILIKE ${searchTerm} 
               OR d.file_name ILIKE ${searchTerm}
               OR p.nom ILIKE ${searchTerm} 
               OR p.prenom ILIKE ${searchTerm})
        ORDER BY d.created_at DESC
        LIMIT ${limit}
      `)
    ]);

    return {
      patients: patientsResult.rows.map(row => ({
        id: row.id,
        nom: row.nom,
        prenom: row.prenom,
        dateNaissance: row.date_naissance
      })),
      actes: actesResult.rows.map(row => ({
        id: row.id,
        typeIntervention: row.type_intervention as any,
        dateOperation: row.date_operation,
        patientId: row.patient_id,
        patientNom: row.patient_nom,
        patientPrenom: row.patient_prenom
      })),
      implants: implantsResult.rows.map(row => ({
        id: row.id,
        marque: row.marque,
        referenceFabricant: row.reference_fabricant,
        siteFdi: row.site_fdi,
        patientId: row.patient_id,
        patientNom: row.patient_nom,
        patientPrenom: row.patient_prenom
      })),
      documents: documentsResult.rows.map(row => ({
        id: row.id,
        nom: row.title || row.file_name,
        type: row.file_name?.split('.').pop() || 'pdf',
        date: row.created_at,
        patientId: row.patient_id,
        patientNom: row.patient_nom,
        patientPrenom: row.patient_prenom
      }))
    };
  }

  // ========== OPERATIONS ==========
  async getOperation(organisationId: string, id: string): Promise<Operation | undefined> {
    const [operation] = await db.select().from(operations)
      .where(and(
        eq(operations.id, id),
        eq(operations.organisationId, organisationId)
      ));
    return operation || undefined;
  }

  async getOperationWithDetails(organisationId: string, id: string): Promise<OperationDetail | undefined> {
    // Get operation with patient info in one query
    const operationWithPatient = await db
      .select({
        operation: operations,
        patient: patients,
      })
      .from(operations)
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(and(
        eq(operations.id, id),
        eq(operations.organisationId, organisationId)
      ));

    if (operationWithPatient.length === 0) {
      return undefined;
    }

    const { operation, patient } = operationWithPatient[0];

    // Get surgery implants with their catalog implant details
    const surgeryImplantsData = await db
      .select({
        surgeryImplant: surgeryImplants,
        implant: implants,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .where(and(
        eq(surgeryImplants.surgeryId, id),
        eq(surgeryImplants.organisationId, organisationId)
      ))
      .orderBy(surgeryImplants.siteFdi);

    // Get all catalog implant IDs for this surgery
    const implantIds = surgeryImplantsData.map(d => d.implant.id);

    // Fetch radios and visites in parallel
    const [operationRadios, operationVisites] = await Promise.all([
      // Get radios for this patient
      db.select().from(radios)
        .where(and(
          eq(radios.patientId, operation.patientId),
          eq(radios.organisationId, organisationId)
        ))
        .orderBy(desc(radios.date)),
      // Get visites for all implants in this surgery
      implantIds.length > 0
        ? db.select().from(visites)
            .where(and(
              inArray(visites.implantId, implantIds),
              eq(visites.organisationId, organisationId)
            ))
            .orderBy(desc(visites.date))
        : Promise.resolve([]),
    ]);

    // Map surgery implants with details
    const surgeryImplantsWithDetails: SurgeryImplantWithDetails[] = surgeryImplantsData.map(({ surgeryImplant, implant }) => ({
      ...surgeryImplant,
      implant,
      surgery: operation,
    }));

    return {
      ...operation,
      patient,
      surgeryImplants: surgeryImplantsWithDetails,
      radios: operationRadios,
      visites: operationVisites,
    };
  }

  async getAllOperations(organisationId: string): Promise<(Operation & { patientNom: string; patientPrenom: string; implantCount: number; successRate: number | null })[]> {
    // Get all operations with patient info
    const operationsWithPatients = await db
      .select({
        operation: operations,
        patientNom: patients.nom,
        patientPrenom: patients.prenom,
      })
      .from(operations)
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(eq(operations.organisationId, organisationId))
      .orderBy(desc(operations.dateOperation));
    
    // Get implant counts and statuses per operation for success rate calculation
    const implantData = await db
      .select({
        surgeryId: surgeryImplants.surgeryId,
        statut: surgeryImplants.statut,
      })
      .from(surgeryImplants)
      .where(eq(surgeryImplants.organisationId, organisationId));
    
    // Build maps for count and success rate
    const countMap: Record<string, number> = {};
    const successCountMap: Record<string, number> = {};
    for (const row of implantData) {
      countMap[row.surgeryId] = (countMap[row.surgeryId] || 0) + 1;
      if (row.statut === "SUCCES" || row.statut === "EN_SUIVI") {
        successCountMap[row.surgeryId] = (successCountMap[row.surgeryId] || 0) + 1;
      }
    }
    
    return operationsWithPatients.map(({ operation, patientNom, patientPrenom }) => {
      const implantCount = countMap[operation.id] || 0;
      const successCount = successCountMap[operation.id] || 0;
      const successRate = implantCount > 0 ? Math.round((successCount / implantCount) * 100) : null;
      
      return {
        ...operation,
        patientNom,
        patientPrenom,
        implantCount,
        successRate,
      };
    });
  }

  async createOperation(organisationId: string, operation: InsertOperation): Promise<Operation> {
    const [newOperation] = await db.insert(operations).values({
      ...operation,
      organisationId,
    }).returning();
    return newOperation;
  }

  async createOperationWithImplants(
    organisationId: string,
    operationData: InsertOperation,
    implantsData: Array<{
      typeImplant?: "IMPLANT" | "MINI_IMPLANT";
      marque: string;
      referenceFabricant?: string | null;
      diametre: number;
      longueur: number;
      lot?: string | null;
      siteFdi: string;
      positionImplant?: string | null;
      typeOs?: string | null;
      miseEnCharge?: string | null;
      greffeOsseuse?: boolean | null;
      typeGreffe?: string | null;
      typeChirurgieTemps?: string | null;
      isqPose?: number | null;
      notes?: string | null;
    }>
  ): Promise<{ operation: Operation; surgeryImplants: SurgeryImplant[] }> {
    return await db.transaction(async (tx) => {
      const [operation] = await tx.insert(operations).values({
        ...operationData,
        organisationId,
      }).returning();

      const createdSurgeryImplants: SurgeryImplant[] = [];
      for (const implantData of implantsData) {
        const [implant] = await tx.insert(implants).values({
          organisationId,
          typeImplant: implantData.typeImplant || "IMPLANT",
          marque: implantData.marque,
          referenceFabricant: implantData.referenceFabricant || null,
          diametre: implantData.diametre,
          longueur: implantData.longueur,
          lot: implantData.lot || null,
        }).returning();

        const [surgeryImplant] = await tx.insert(surgeryImplants).values({
          organisationId,
          surgeryId: operation.id,
          implantId: implant.id,
          siteFdi: implantData.siteFdi,
          positionImplant: implantData.positionImplant as any || null,
          typeOs: implantData.typeOs as any || null,
          miseEnCharge: implantData.miseEnCharge as any || null,
          greffeOsseuse: implantData.greffeOsseuse || false,
          typeGreffe: implantData.typeGreffe || null,
          typeChirurgieTemps: implantData.typeChirurgieTemps as any || null,
          isqPose: implantData.isqPose || null,
          statut: "EN_SUIVI",
          datePose: operationData.dateOperation,
          notes: implantData.notes || null,
        }).returning();
        createdSurgeryImplants.push(surgeryImplant);
      }

      return { operation, surgeryImplants: createdSurgeryImplants };
    });
  }

  async deleteOperation(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(operations)
      .where(and(
        eq(operations.id, id),
        eq(operations.organisationId, organisationId)
      ))
      .returning({ id: operations.id });
    return result.length > 0;
  }

  async updateOperation(organisationId: string, id: string, data: Partial<InsertOperation>): Promise<Operation | undefined> {
    const [updated] = await db.update(operations)
      .set(data)
      .where(and(
        eq(operations.id, id),
        eq(operations.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  // ========== IMPLANTS ==========
  async getImplant(organisationId: string, id: string): Promise<Implant | undefined> {
    const [implant] = await db.select().from(implants)
      .where(and(
        eq(implants.id, id),
        eq(implants.organisationId, organisationId)
      ));
    return implant || undefined;
  }

  async createImplant(organisationId: string, implant: InsertImplant): Promise<Implant> {
    const [newImplant] = await db.insert(implants).values({
      ...implant,
      organisationId,
    }).returning();
    return newImplant;
  }

  async updateCatalogImplant(organisationId: string, id: string, updates: Partial<InsertImplant>): Promise<Implant | undefined> {
    const [updated] = await db.update(implants)
      .set(updates)
      .where(and(
        eq(implants.id, id),
        eq(implants.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteImplant(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(implants)
      .where(and(
        eq(implants.id, id),
        eq(implants.organisationId, organisationId)
      ))
      .returning({ id: implants.id });
    return result.length > 0;
  }

  async getAllImplants(organisationId: string): Promise<Implant[]> {
    return db.select().from(implants)
      .where(eq(implants.organisationId, organisationId));
  }

  async getAllImplantsWithStats(organisationId: string): Promise<ImplantWithStats[]> {
    const allImplants = await db.select().from(implants)
      .where(eq(implants.organisationId, organisationId));
    
    const allSurgeryImplants = await db.select().from(surgeryImplants)
      .where(eq(surgeryImplants.organisationId, organisationId));
    
    // Helper: convert bone loss score (0-5) to success rate (100-0%)
    const boneLossToSuccessRate = (score: number | null): number | null => {
      if (score === null || score === undefined) return null;
      const rates = [100, 80, 60, 40, 20, 0];
      return rates[score] ?? null;
    };
    
    return allImplants.map(implant => {
      const poses = allSurgeryImplants.filter(si => si.implantId === implant.id);
      const poseCount = poses.length;
      
      const lastPose = poses.reduce((latest, pose) => {
        if (!pose.datePose) return latest;
        if (!latest) return pose.datePose;
        return pose.datePose > latest ? pose.datePose : latest;
      }, null as string | null);
      
      // Calculate average success rate from boneLossScore
      const posesWithScore = poses.filter(p => p.boneLossScore !== null && p.boneLossScore !== undefined);
      let successRate: number | null = null;
      
      if (posesWithScore.length > 0) {
        const totalRate = posesWithScore.reduce((sum, p) => {
          const rate = boneLossToSuccessRate(p.boneLossScore);
          return sum + (rate ?? 0);
        }, 0);
        successRate = Math.round((totalRate / posesWithScore.length) * 10) / 10;
      }
      
      return {
        ...implant,
        poseCount,
        lastPoseDate: lastPose,
        successRate,
      };
    });
  }

  async getImplantBrands(organisationId: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ marque: implants.marque })
      .from(implants)
      .where(eq(implants.organisationId, organisationId))
      .orderBy(implants.marque);
    return results.map((r) => r.marque);
  }

  // ========== SURGERY IMPLANTS ==========
  async getSurgeryImplant(organisationId: string, id: string): Promise<SurgeryImplant | undefined> {
    const [surgeryImplant] = await db.select().from(surgeryImplants)
      .where(and(
        eq(surgeryImplants.id, id),
        eq(surgeryImplants.organisationId, organisationId)
      ));
    return surgeryImplant || undefined;
  }

  async getSurgeryImplantWithDetails(organisationId: string, id: string): Promise<ImplantDetail | undefined> {
    const start = Date.now();
    
    // Optimized: Single JOIN query for all main entities instead of 3 sequential round trips
    const t1 = Date.now();
    const joinedData = await db
      .select({
        surgeryImplant: surgeryImplants,
        implant: implants,
        surgery: operations,
        patient: patients,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(and(
        eq(surgeryImplants.id, id),
        eq(surgeryImplants.organisationId, organisationId)
      ));
    const d1 = Date.now() - t1;
    
    if (joinedData.length === 0) {
      console.log(`[IMPLANT-DETAIL] id=${id} not found after ${d1}ms`);
      return undefined;
    }

    const { surgeryImplant, implant, surgery, patient } = joinedData[0];

    // Parallel fetch for visites and radios (using catalog implant.id)
    const t2 = Date.now();
    const [implantVisites, implantRadios] = await Promise.all([
      db.select().from(visites)
        .where(and(eq(visites.implantId, implant.id), eq(visites.organisationId, organisationId)))
        .orderBy(desc(visites.date)),
      db.select().from(radios)
        .where(and(eq(radios.implantId, implant.id), eq(radios.organisationId, organisationId)))
        .orderBy(desc(radios.date)),
    ]);
    const d2 = Date.now() - t2;

    const total = Date.now() - start;
    console.log(`[IMPLANT-DETAIL] id=${id} total=${total}ms join=${d1}ms visites+radios=${d2}ms visites=${implantVisites.length} radios=${implantRadios.length}`);

    return {
      ...surgeryImplant,
      implant,
      patient,
      surgery,
      visites: implantVisites,
      radios: implantRadios,
    };
  }

  async getPatientSurgeryImplants(organisationId: string, patientId: string): Promise<SurgeryImplantWithDetails[]> {
    // Optimized: Single JOIN query instead of N+1 pattern
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(
        eq(patients.id, patientId),
        eq(patients.organisationId, organisationId)
      ));

    if (!patient) return [];

    // Single query with all JOINs
    const joinedData = await db
      .select({
        surgeryImplant: surgeryImplants,
        implant: implants,
        surgery: operations,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .where(and(
        eq(operations.patientId, patientId),
        eq(surgeryImplants.organisationId, organisationId)
      ))
      .orderBy(desc(surgeryImplants.datePose));

    return joinedData.map(({ surgeryImplant, implant, surgery }) => ({
      ...surgeryImplant,
      implant,
      surgery,
      patient,
    }));
  }

  async getSurgeryImplantsByCatalogImplant(organisationId: string, implantId: string): Promise<SurgeryImplantWithDetails[]> {
    // Optimized: Single JOIN query instead of N+1 pattern
    const [implant] = await db
      .select()
      .from(implants)
      .where(and(
        eq(implants.id, implantId),
        eq(implants.organisationId, organisationId)
      ));

    if (!implant) return [];

    // Single query with all JOINs
    const joinedData = await db
      .select({
        surgeryImplant: surgeryImplants,
        surgery: operations,
        patient: patients,
      })
      .from(surgeryImplants)
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(and(
        eq(surgeryImplants.implantId, implantId),
        eq(surgeryImplants.organisationId, organisationId)
      ))
      .orderBy(desc(surgeryImplants.datePose));

    return joinedData.map(({ surgeryImplant, surgery, patient }) => ({
      ...surgeryImplant,
      implant,
      surgery,
      patient,
    }));
  }

  async getAllSurgeryImplants(organisationId: string): Promise<SurgeryImplantWithDetails[]> {
    // Optimized: Single 4-table JOIN query instead of N+1 pattern
    const joinedData = await db
      .select({
        surgeryImplant: surgeryImplants,
        implant: implants,
        surgery: operations,
        patient: patients,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(eq(surgeryImplants.organisationId, organisationId))
      .orderBy(desc(surgeryImplants.datePose));

    return joinedData.map(({ surgeryImplant, implant, surgery, patient }) => ({
      ...surgeryImplant,
      implant,
      surgery,
      patient,
    }));
  }

  async filterSurgeryImplants(organisationId: string, filters: ImplantFilters): Promise<ImplantWithPatient[]> {
    // Optimized: Single JOIN query with in-memory filtering for complex conditions
    // Build WHERE conditions based on filters
    const conditions = [eq(surgeryImplants.organisationId, organisationId)];
    
    if (filters.siteFdi) {
      conditions.push(eq(surgeryImplants.siteFdi, filters.siteFdi));
    }
    if (filters.typeOs) {
      conditions.push(eq(surgeryImplants.typeOs, filters.typeOs as any));
    }
    if (filters.statut) {
      conditions.push(eq(surgeryImplants.statut, filters.statut as any));
    }

    const joinedData = await db
      .select({
        surgeryImplant: surgeryImplants,
        implant: implants,
        patient: patients,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(desc(surgeryImplants.datePose));

    // Apply marque filter in memory (case-insensitive partial match)
    const result: ImplantWithPatient[] = [];
    for (const { surgeryImplant, implant, patient } of joinedData) {
      if (filters.marque && !implant.marque.toLowerCase().includes(filters.marque.toLowerCase())) {
        continue;
      }
      result.push({
        ...surgeryImplant,
        implant,
        patient,
      });
    }

    return result;
  }

  async createSurgeryImplant(organisationId: string, data: InsertSurgeryImplant): Promise<SurgeryImplant> {
    const [newSurgeryImplant] = await db.insert(surgeryImplants).values({
      ...data,
      organisationId,
    }).returning();
    return newSurgeryImplant;
  }

  async deleteSurgeryImplants(organisationId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    let deletedCount = 0;
    for (const id of ids) {
      const result = await db.delete(surgeryImplants)
        .where(and(
          eq(surgeryImplants.id, id),
          eq(surgeryImplants.organisationId, organisationId)
        ))
        .returning();
      if (result.length > 0) deletedCount++;
    }
    return deletedCount;
  }

  async updateSurgeryImplant(organisationId: string, id: string, data: Partial<InsertSurgeryImplant>): Promise<SurgeryImplant | undefined> {
    const [updated] = await db.update(surgeryImplants)
      .set(data)
      .where(and(
        eq(surgeryImplants.id, id),
        eq(surgeryImplants.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  // ========== RADIOS ==========
  async getRadio(organisationId: string, id: string): Promise<Radio | undefined> {
    const [radio] = await db.select().from(radios)
      .where(and(
        eq(radios.id, id),
        eq(radios.organisationId, organisationId)
      ));
    return radio || undefined;
  }

  async getPatientRadios(organisationId: string, patientId: string): Promise<Radio[]> {
    return db.select().from(radios)
      .where(and(
        eq(radios.patientId, patientId),
        eq(radios.organisationId, organisationId)
      ))
      .orderBy(desc(radios.createdAt));
  }

  async createRadio(organisationId: string, radio: InsertRadio & { createdBy?: string | null }): Promise<Radio> {
    const [newRadio] = await db.insert(radios).values({
      ...radio,
      organisationId,
    }).returning();
    return newRadio;
  }

  async updateRadio(organisationId: string, id: string, data: { title?: string }): Promise<Radio | undefined> {
    const [updated] = await db.update(radios)
      .set(data)
      .where(and(
        eq(radios.id, id),
        eq(radios.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteRadio(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(radios)
      .where(and(
        eq(radios.id, id),
        eq(radios.organisationId, organisationId)
      ))
      .returning();
    return result.length > 0;
  }

  // ========== VISITES ==========
  async getVisite(organisationId: string, id: string): Promise<Visite | undefined> {
    const [visite] = await db.select().from(visites)
      .where(and(
        eq(visites.id, id),
        eq(visites.organisationId, organisationId)
      ));
    return visite || undefined;
  }

  async getImplantVisites(organisationId: string, implantId: string): Promise<Visite[]> {
    return db
      .select()
      .from(visites)
      .where(and(
        eq(visites.implantId, implantId),
        eq(visites.organisationId, organisationId)
      ))
      .orderBy(desc(visites.date));
  }

  async createVisite(organisationId: string, visite: InsertVisite): Promise<Visite> {
    const [newVisite] = await db.insert(visites).values({
      ...visite,
      organisationId,
    }).returning();
    return newVisite;
  }

  async getPatientLastVisits(organisationId: string): Promise<Record<string, { date: string; titre: string | null }>> {
    const now = new Date();
    const allAppointments = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.organisationId, organisationId),
        eq(appointments.status, 'COMPLETED'),
        lte(appointments.dateStart, now)
      ))
      .orderBy(desc(appointments.dateStart));

    const lastVisitByPatient: Record<string, { date: string; titre: string | null }> = {};
    for (const apt of allAppointments) {
      if (!lastVisitByPatient[apt.patientId]) {
        lastVisitByPatient[apt.patientId] = {
          date: apt.dateStart.toISOString().split('T')[0],
          titre: apt.title,
        };
      }
    }
    return lastVisitByPatient;
  }

  async findSurgeryImplantForVisite(organisationId: string, catalogImplantId: string, patientId: string): Promise<string | null> {
    const result = await db
      .select({ surgeryImplantId: surgeryImplants.id })
      .from(surgeryImplants)
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .where(and(
        eq(surgeryImplants.implantId, catalogImplantId),
        eq(operations.patientId, patientId),
        eq(surgeryImplants.organisationId, organisationId)
      ))
      .orderBy(desc(surgeryImplants.datePose))
      .limit(1);
    
    return result.length > 0 ? result[0].surgeryImplantId : null;
  }

  async syncVisiteIsqToSurgeryImplant(organisationId: string, surgeryImplantId: string, isqValue: number, visiteDate: string): Promise<void> {
    const [si] = await db
      .select({ datePose: surgeryImplants.datePose })
      .from(surgeryImplants)
      .where(and(
        eq(surgeryImplants.id, surgeryImplantId),
        eq(surgeryImplants.organisationId, organisationId)
      ));
    
    if (!si) return;
    
    const poseDate = new Date(si.datePose);
    const visiteDateObj = new Date(visiteDate);
    const daysDiff = Math.floor((visiteDateObj.getTime() - poseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let updateField: 'isqPose' | 'isq2m' | 'isq3m' | 'isq6m';
    if (daysDiff < 30) {
      updateField = 'isqPose';
    } else if (daysDiff < 75) {
      updateField = 'isq2m';
    } else if (daysDiff < 135) {
      updateField = 'isq3m';
    } else {
      updateField = 'isq6m';
    }
    
    await db
      .update(surgeryImplants)
      .set({ [updateField]: isqValue })
      .where(and(
        eq(surgeryImplants.id, surgeryImplantId),
        eq(surgeryImplants.organisationId, organisationId)
      ));
    
    console.log(`[ISQ-SYNC] Updated surgery_implant ${surgeryImplantId} ${updateField}=${isqValue} (daysDiff=${daysDiff})`);
  }

  // ========== PROTHESES ==========
  async createProthese(organisationId: string, prothese: InsertProthese): Promise<Prothese> {
    const [newProthese] = await db.insert(protheses).values({
      ...prothese,
      organisationId,
    }).returning();
    return newProthese;
  }

  async getImplantProtheses(organisationId: string, implantId: string): Promise<Prothese[]> {
    return db
      .select()
      .from(protheses)
      .where(and(
        eq(protheses.implantId, implantId),
        eq(protheses.organisationId, organisationId)
      ))
      .orderBy(desc(protheses.datePose));
  }

  // ========== STATS ==========
  async getStats(organisationId: string): Promise<DashboardStats> {
    const allPatients = await db.select().from(patients)
      .where(eq(patients.organisationId, organisationId));
    const allOperations = await db.select().from(operations)
      .where(eq(operations.organisationId, organisationId))
      .orderBy(desc(operations.dateOperation));
    const allSurgeryImplants = await db.select().from(surgeryImplants)
      .where(eq(surgeryImplants.organisationId, organisationId));
    const allRadios = await db.select().from(radios)
      .where(eq(radios.organisationId, organisationId));

    const implantsByStatus: Record<string, number> = {};
    allSurgeryImplants.forEach((si) => {
      const status = si.statut || "EN_SUIVI";
      implantsByStatus[status] = (implantsByStatus[status] || 0) + 1;
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyImplants = allSurgeryImplants.filter(si => 
      si.datePose.startsWith(currentMonth)
    ).length;

    const monthlyOperations = allOperations.filter(op => 
      op.dateOperation.startsWith(currentMonth)
    ).length;

    return {
      totalPatients: allPatients.length,
      totalOperations: allOperations.length,
      totalImplants: allSurgeryImplants.length,
      totalRadios: allRadios.length,
      monthlyImplants,
      monthlyOperations,
      implantsByStatus,
      recentOperations: allOperations.slice(0, 10),
    };
  }

  async getAdvancedStats(organisationId: string): Promise<AdvancedStats> {
    const allSurgeryImplants = await db.select().from(surgeryImplants)
      .where(eq(surgeryImplants.organisationId, organisationId));
    const total = allSurgeryImplants.length;

    const statusCounts = {
      SUCCES: 0,
      COMPLICATION: 0,
      ECHEC: 0,
      EN_SUIVI: 0,
    };

    const brandCounts: Record<string, number> = {};
    const siteCounts: Record<string, number> = {};
    let isqPoseSum = 0, isqPoseCount = 0;
    let isq3mSum = 0, isq3mCount = 0;
    let isq6mSum = 0, isq6mCount = 0;

    for (const si of allSurgeryImplants) {
      const status = si.statut || "EN_SUIVI";
      statusCounts[status as keyof typeof statusCounts]++;

      const [implant] = await db
        .select()
        .from(implants)
        .where(eq(implants.id, si.implantId));
      if (implant) {
        brandCounts[implant.marque] = (brandCounts[implant.marque] || 0) + 1;
      }

      siteCounts[si.siteFdi] = (siteCounts[si.siteFdi] || 0) + 1;

      if (si.isqPose) { isqPoseSum += si.isqPose; isqPoseCount++; }
      if (si.isq3m) { isq3mSum += si.isq3m; isq3mCount++; }
      if (si.isq6m) { isq6mSum += si.isq6m; isq6mCount++; }
    }

    const isqTrends: { month: string; avgIsq: number }[] = [];
    const monthlyIsq: Record<string, { sum: number; count: number }> = {};

    allSurgeryImplants.forEach((si) => {
      const month = si.datePose.substring(0, 7);
      if (si.isqPose) {
        if (!monthlyIsq[month]) monthlyIsq[month] = { sum: 0, count: 0 };
        monthlyIsq[month].sum += si.isqPose;
        monthlyIsq[month].count++;
      }
    });

    Object.entries(monthlyIsq)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .forEach(([month, data]) => {
        isqTrends.push({
          month,
          avgIsq: Math.round(data.sum / data.count),
        });
      });

    return {
      successRate: total > 0 ? Math.round((statusCounts.SUCCES / total) * 100) : 0,
      complicationRate: total > 0 ? Math.round((statusCounts.COMPLICATION / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((statusCounts.ECHEC / total) * 100) : 0,
      avgIsqPose: isqPoseCount > 0 ? Math.round(isqPoseSum / isqPoseCount) : 0,
      avgIsq3m: isq3mCount > 0 ? Math.round(isq3mSum / isq3mCount) : 0,
      avgIsq6m: isq6mCount > 0 ? Math.round(isq6mSum / isq6mCount) : 0,
      implantsByBrand: brandCounts,
      implantsBySite: siteCounts,
      isqTrends,
    };
  }

  async getClinicalStats(organisationId: string, dateFrom?: string, dateTo?: string, implantModelId?: string, patientIds?: string[], operationIds?: string[]): Promise<ClinicalStats> {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    const fromDate = dateFrom || defaultFrom;
    const toDate = dateTo || defaultTo;

    // Build base operation conditions
    const opConditions = [
      eq(operations.organisationId, organisationId),
      gte(operations.dateOperation, fromDate),
      lte(operations.dateOperation, toDate)
    ];
    
    // Add patient filter if provided
    if (patientIds && patientIds.length > 0) {
      opConditions.push(inArray(operations.patientId, patientIds));
    }
    
    // Add operation filter if provided
    if (operationIds && operationIds.length > 0) {
      opConditions.push(inArray(operations.id, operationIds));
    }

    const allOperations = await db.select().from(operations)
      .where(and(...opConditions))
      .orderBy(operations.dateOperation);

    // Build surgery implant conditions
    const siConditions: SQL[] = [
      eq(surgeryImplants.organisationId, organisationId),
      gte(surgeryImplants.datePose, fromDate),
      lte(surgeryImplants.datePose, toDate)
    ];
    
    // Filter by operation IDs if provided
    if (operationIds && operationIds.length > 0) {
      siConditions.push(inArray(surgeryImplants.surgeryId, operationIds));
    }
    
    // Get operation IDs for patient filter
    const operationIdsFromPatients = patientIds && patientIds.length > 0 
      ? allOperations.map(op => op.id) 
      : undefined;
    
    if (operationIdsFromPatients && operationIdsFromPatients.length > 0) {
      siConditions.push(inArray(surgeryImplants.surgeryId, operationIdsFromPatients));
    }

    const allSurgeryImplantsWithDetails = await db.select({
      id: surgeryImplants.id,
      surgeryId: surgeryImplants.surgeryId,
      implantId: surgeryImplants.implantId,
      siteFdi: surgeryImplants.siteFdi,
      isqPose: surgeryImplants.isqPose,
      statut: surgeryImplants.statut,
      datePose: surgeryImplants.datePose,
      boneLossScore: surgeryImplants.boneLossScore,
      marque: implants.marque,
      referenceFabricant: implants.referenceFabricant,
    }).from(surgeryImplants)
      .leftJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .where(and(...siConditions));

    const allSurgeryImplants = allSurgeryImplantsWithDetails;

    const allCompletedAppointments = await db.select().from(appointments)
      .where(and(
        eq(appointments.organisationId, organisationId),
        eq(appointments.status, 'COMPLETED')
      ));

    // Build patients map early (needed for actsByType)
    const patientsMap: Record<string, { nom: string; prenom: string }> = {};
    const patientsList = await db.select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
      .from(patients)
      .where(eq(patients.organisationId, organisationId));
    patientsList.forEach(p => { patientsMap[p.id] = { nom: p.nom, prenom: p.prenom }; });

    const activityByMonth: Record<string, number> = {};
    allOperations.forEach(op => {
      const month = op.dateOperation.substring(0, 7);
      activityByMonth[month] = (activityByMonth[month] || 0) + 1;
    });

    const implantsByMonth: Record<string, number> = {};
    allSurgeryImplants.forEach(si => {
      const month = si.datePose.substring(0, 7);
      implantsByMonth[month] = (implantsByMonth[month] || 0) + 1;
    });

    // Build maps for implants per operation type
    const surgeryImplantsByOp: Record<string, typeof allSurgeryImplants> = {};
    allSurgeryImplants.forEach(si => {
      if (!surgeryImplantsByOp[si.surgeryId]) surgeryImplantsByOp[si.surgeryId] = [];
      surgeryImplantsByOp[si.surgeryId].push(si);
    });

    const actsByTypeMap: Record<string, { count: number; implants: { id: string; siteFdi: string; patientNom: string; patientPrenom: string; marque: string }[] }> = {};
    allOperations.forEach(op => {
      const type = op.typeIntervention || "AUTRE";
      if (!actsByTypeMap[type]) actsByTypeMap[type] = { count: 0, implants: [] };
      actsByTypeMap[type].count++;
      
      const opImplants = surgeryImplantsByOp[op.id] || [];
      const patient = patientsMap[op.patientId];
      opImplants.forEach(si => {
        actsByTypeMap[type].implants.push({
          id: si.id,
          siteFdi: si.siteFdi,
          patientNom: patient?.nom || '',
          patientPrenom: patient?.prenom || '',
          marque: si.marque || '',
        });
      });
    });

    const statusCounts = { SUCCES: 0, COMPLICATION: 0, ECHEC: 0, EN_SUIVI: 0 };
    const isqValues: number[] = [];
    allSurgeryImplants.forEach(si => {
      const status = si.statut || "EN_SUIVI";
      statusCounts[status as keyof typeof statusCounts]++;
      if (si.isqPose) isqValues.push(si.isqPose);
    });

    // Helper: convert bone loss score (0-5) to success rate (100-0%)
    const boneLossToSuccessRate = (score: number | null): number | null => {
      if (score === null || score === undefined) return null;
      const rates = [100, 80, 60, 40, 20, 0];
      return rates[score] ?? null;
    };

    // Calculate success rate from boneLossScore (like individual implant stats)
    const implantsWithBoneLoss = allSurgeryImplants.filter(si => 
      si.boneLossScore !== null && si.boneLossScore !== undefined
    );
    
    let successRate = 0;
    if (implantsWithBoneLoss.length > 0) {
      const totalSuccessRate = implantsWithBoneLoss.reduce((sum, si) => {
        const rate = boneLossToSuccessRate(si.boneLossScore);
        return sum + (rate ?? 0);
      }, 0);
      successRate = Math.round(totalSuccessRate / implantsWithBoneLoss.length);
    }

    const total = allSurgeryImplants.length;
    const complicationRate = total > 0 ? Math.round((statusCounts.COMPLICATION / total) * 100) : 0;
    const failureRate = total > 0 ? Math.round((statusCounts.ECHEC / total) * 100) : 0;

    // Filter surgery implants for ISQ data if implantModelId is provided
    const isqFilteredImplants = implantModelId 
      ? allSurgeryImplants.filter(si => si.implantId === implantModelId)
      : allSurgeryImplants;

    const filteredIsqValues: number[] = [];
    isqFilteredImplants.forEach(si => {
      if (si.isqPose) filteredIsqValues.push(si.isqPose);
    });

    const isqDistribution = [
      { category: "Faible (<55)", count: filteredIsqValues.filter(v => v < 55).length },
      { category: "Modéré (55-70)", count: filteredIsqValues.filter(v => v >= 55 && v <= 70).length },
      { category: "Élevé (>70)", count: filteredIsqValues.filter(v => v > 70).length },
    ];

    const isqByMonth: Record<string, { sum: number; count: number }> = {};
    isqFilteredImplants.forEach(si => {
      const month = si.datePose.substring(0, 7);
      if (si.isqPose) {
        if (!isqByMonth[month]) isqByMonth[month] = { sum: 0, count: 0 };
        isqByMonth[month].sum += si.isqPose;
        isqByMonth[month].count++;
      }
    });

    const visitesPerSurgeryImplant: Record<string, Date[]> = {};
    allCompletedAppointments.forEach(apt => {
      if (apt.surgeryImplantId) {
        if (!visitesPerSurgeryImplant[apt.surgeryImplantId]) visitesPerSurgeryImplant[apt.surgeryImplantId] = [];
        visitesPerSurgeryImplant[apt.surgeryImplantId].push(apt.dateStart);
      }
    });

    let totalDelayDays = 0;
    let delayCount = 0;
    allSurgeryImplants.forEach(si => {
      const siVisites = visitesPerSurgeryImplant[si.id] || [];
      if (siVisites.length > 0) {
        const poseDate = new Date(si.datePose);
        const firstVisit = siVisites.sort((a, b) => a.getTime() - b.getTime())[0];
        const delay = Math.floor((firstVisit.getTime() - poseDate.getTime()) / (1000 * 60 * 60 * 24));
        if (delay >= 0) {
          totalDelayDays += delay;
          delayCount++;
        }
      }
    });

    const avgDelayToFirstVisit = delayCount > 0 ? Math.round(totalDelayDays / delayCount) : null;

    const operationsMap: Record<string, string> = {};
    allOperations.forEach(op => { operationsMap[op.id] = op.patientId; });

    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const implantsWithoutFollowup: ClinicalStats["implantsWithoutFollowup"] = [];
    
    const allOrgSurgeryImplantsWithDetails = await db.select({
      id: surgeryImplants.id,
      surgeryId: surgeryImplants.surgeryId,
      siteFdi: surgeryImplants.siteFdi,
      datePose: surgeryImplants.datePose,
      marque: implants.marque,
      referenceFabricant: implants.referenceFabricant,
    }).from(surgeryImplants)
      .leftJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .where(eq(surgeryImplants.organisationId, organisationId));

    for (const si of allOrgSurgeryImplantsWithDetails) {
      const siVisites = visitesPerSurgeryImplant[si.id] || [];
      const lastVisit = siVisites.length > 0 
        ? siVisites.sort((a, b) => b.getTime() - a.getTime())[0] 
        : null;
      
      const daysSince = lastVisit 
        ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (!lastVisit || lastVisit < threeMonthsAgo) {
        const patientId = operationsMap[si.surgeryId];
        const patient = patientId ? patientsMap[patientId] : null;
        if (patient) {
          implantsWithoutFollowup.push({
            patientId,
            patientNom: patient.nom,
            patientPrenom: patient.prenom,
            implantId: si.id,
            siteFdi: si.siteFdi,
            datePose: si.datePose,
            lastVisitDate: lastVisit ? lastVisit.toISOString().split('T')[0] : null,
            daysSinceVisit: daysSince,
            marque: si.marque || '',
            referenceFabricant: si.referenceFabricant || null,
          });
        }
      }
    }

    // Get available implant models for filter
    const availableModels = await db.selectDistinct({
      id: implants.id,
      marque: implants.marque,
      referenceFabricant: implants.referenceFabricant,
    }).from(implants)
      .where(eq(implants.organisationId, organisationId))
      .orderBy(implants.marque);

    return {
      activityByPeriod: Object.entries(activityByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, count]) => ({ period, count })),
      implantsByPeriod: Object.entries(implantsByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, count]) => ({ period, count })),
      totalImplantsInPeriod: allSurgeryImplants.length,
      actsByType: Object.entries(actsByTypeMap)
        .map(([type, data]) => ({ type, count: data.count, implants: data.implants })),
      successRate,
      complicationRate,
      failureRate,
      isqDistribution,
      isqEvolution: Object.entries(isqByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({ period, avgIsq: Math.round(data.sum / data.count) })),
      avgDelayToFirstVisit,
      implantsWithoutFollowup: implantsWithoutFollowup.slice(0, 20),
      availableImplantModels: availableModels,
    };
  }

  async getPatientStats(organisationId: string): Promise<import("@shared/types").PatientStats[]> {
    const allPatients = await db.select().from(patients)
      .where(eq(patients.organisationId, organisationId));

    const allOperations = await db.select().from(operations)
      .where(eq(operations.organisationId, organisationId));

    const allSurgeryImplants = await db.select({
      id: surgeryImplants.id,
      surgeryId: surgeryImplants.surgeryId,
      siteFdi: surgeryImplants.siteFdi,
      statut: surgeryImplants.statut,
      isqPose: surgeryImplants.isqPose,
      marque: implants.marque,
    }).from(surgeryImplants)
      .leftJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .where(eq(surgeryImplants.organisationId, organisationId));

    const allFlags = await db.select().from(flags)
      .where(and(
        eq(flags.organisationId, organisationId),
        isNull(flags.resolvedAt)
      ));

    const operationsByPatient: Record<string, string[]> = {};
    allOperations.forEach(op => {
      if (!operationsByPatient[op.patientId]) operationsByPatient[op.patientId] = [];
      operationsByPatient[op.patientId].push(op.id);
    });

    const implantsBySurgery: Record<string, typeof allSurgeryImplants> = {};
    allSurgeryImplants.forEach(si => {
      if (!implantsBySurgery[si.surgeryId]) implantsBySurgery[si.surgeryId] = [];
      implantsBySurgery[si.surgeryId].push(si);
    });

    const flagsByPatient: Record<string, number> = {};
    allFlags.forEach(f => {
      if (f.patientId) {
        flagsByPatient[f.patientId] = (flagsByPatient[f.patientId] || 0) + 1;
      }
    });

    const now = new Date();
    const results: import("@shared/types").PatientStats[] = [];

    for (const patient of allPatients) {
      const patientOpIds = operationsByPatient[patient.id] || [];
      const patientImplants: typeof allSurgeryImplants = [];
      patientOpIds.forEach(opId => {
        const opImplants = implantsBySurgery[opId] || [];
        patientImplants.push(...opImplants);
      });

      const total = patientImplants.length;
      let successCount = 0;
      let complicationCount = 0;
      let failureCount = 0;

      patientImplants.forEach(si => {
        const status = si.statut || "EN_SUIVI";
        // Count SUCCES and EN_SUIVI as successful outcomes
        // EN_SUIVI = implant in post-operative surveillance (default healthy state)
        if (status === "SUCCES" || status === "EN_SUIVI") successCount++;
        if (status === "COMPLICATION") complicationCount++;
        if (status === "ECHEC") failureCount++;
      });

      const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

      let age = 0;
      if (patient.dateNaissance) {
        const birthDate = new Date(patient.dateNaissance);
        if (!isNaN(birthDate.getTime())) {
          age = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
          if (age < 0) age = 0;
        }
      }

      results.push({
        patientId: patient.id,
        nom: patient.nom,
        prenom: patient.prenom,
        dateNaissance: patient.dateNaissance,
        age,
        totalImplants: total,
        successRate,
        complicationCount,
        failureCount,
        activeAlerts: flagsByPatient[patient.id] || 0,
        implants: patientImplants.map(si => ({
          id: si.id,
          siteFdi: si.siteFdi,
          marque: si.marque || '',
          statut: si.statut || 'EN_SUIVI',
          isqPose: si.isqPose,
        })),
      });
    }

    return results.sort((a, b) => b.activeAlerts - a.activeAlerts || b.totalImplants - a.totalImplants);
  }

  // ========== USERS (not tenant-filtered) ==========
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const [user] = await db.insert(users).values({
      username: data.username,
      password: data.password,
      role: (data.role as any) || "ASSISTANT",
      nom: data.nom || null,
      prenom: data.prenom || null,
      organisationId: data.organisationId || null,
    }).returning();
    return user;
  }
  
  async updateUser(id: string, data: Partial<{ password: string; role: "ADMIN" | "CHIRURGIEN" | "ASSISTANT"; nom: string | null; prenom: string | null }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data as any).where(eq(users.id, id)).returning();
    return user;
  }
  
  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  async getUsersByOrganisation(organisationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organisationId, organisationId));
  }

  // ========== ORGANISATIONS ==========
  async createOrganisation(data: InsertOrganisation): Promise<Organisation> {
    const [org] = await db.insert(organisations).values({
      nom: data.nom,
    }).returning();
    return org;
  }
  
  async getOrganisationById(id: string): Promise<Organisation | undefined> {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
    return org;
  }
  
  async updateOrganisation(id: string, data: Partial<{ nom: string; adresse: string; timezone: string }>): Promise<Organisation | undefined> {
    const [org] = await db.update(organisations).set(data as any).where(eq(organisations.id, id)).returning();
    return org;
  }

  // ========== NOTES ==========
  async getPatientNotes(organisationId: string, patientId: string): Promise<(Note & { user: { nom: string | null; prenom: string | null } })[]> {
    const patientNotes = await db
      .select({
        id: notes.id,
        organisationId: notes.organisationId,
        patientId: notes.patientId,
        userId: notes.userId,
        tag: notes.tag,
        contenu: notes.contenu,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        userNom: users.nom,
        userPrenom: users.prenom,
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(and(
        eq(notes.patientId, patientId),
        eq(notes.organisationId, organisationId)
      ))
      .orderBy(desc(notes.createdAt));

    return patientNotes.map(n => ({
      id: n.id,
      organisationId: n.organisationId,
      patientId: n.patientId,
      userId: n.userId,
      tag: n.tag,
      contenu: n.contenu,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      user: {
        nom: n.userNom,
        prenom: n.userPrenom,
      },
    }));
  }

  async createNote(organisationId: string, userId: string, note: InsertNote): Promise<Note> {
    const [created] = await db.insert(notes).values({
      ...note,
      organisationId,
      userId,
    }).returning();
    return created;
  }

  async updateNote(organisationId: string, id: string, note: Partial<InsertNote>): Promise<Note | undefined> {
    const [updated] = await db.update(notes)
      .set({ ...note, updatedAt: new Date() })
      .where(and(
        eq(notes.id, id),
        eq(notes.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteNote(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.organisationId, organisationId)
      ))
      .returning();
    return result.length > 0;
  }

  // ========== RENDEZ-VOUS ==========
  async getPatientRendezVous(organisationId: string, patientId: string): Promise<RendezVous[]> {
    return db.select().from(rendezVous)
      .where(and(
        eq(rendezVous.patientId, patientId),
        eq(rendezVous.organisationId, organisationId)
      ))
      .orderBy(desc(rendezVous.date));
  }

  async getPatientUpcomingRendezVous(organisationId: string, patientId: string): Promise<RendezVous[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(rendezVous)
      .where(and(
        eq(rendezVous.patientId, patientId),
        eq(rendezVous.organisationId, organisationId),
        gte(rendezVous.date, today)
      ))
      .orderBy(rendezVous.date);
  }

  async createRendezVous(organisationId: string, rdv: InsertRendezVous): Promise<RendezVous> {
    const [created] = await db.insert(rendezVous).values({
      ...rdv,
      organisationId,
    }).returning();
    return created;
  }

  async updateRendezVous(organisationId: string, id: string, rdv: Partial<InsertRendezVous>): Promise<RendezVous | undefined> {
    const [updated] = await db.update(rendezVous)
      .set(rdv)
      .where(and(
        eq(rendezVous.id, id),
        eq(rendezVous.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteRendezVous(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(rendezVous)
      .where(and(
        eq(rendezVous.id, id),
        eq(rendezVous.organisationId, organisationId)
      ))
      .returning();
    return result.length > 0;
  }

  // ========== APPOINTMENTS (Unified RDV) ==========
  async getAppointment(organisationId: string, id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.organisationId, organisationId)
      ));
    return appointment || undefined;
  }

  async getAppointmentWithDetails(organisationId: string, id: string): Promise<AppointmentWithDetails | undefined> {
    const appointment = await this.getAppointment(organisationId, id);
    if (!appointment) return undefined;

    const [patientData, operationData, radioData] = await Promise.all([
      appointment.patientId ? this.getPatient(organisationId, appointment.patientId) : Promise.resolve(undefined),
      appointment.operationId ? this.getOperation(organisationId, appointment.operationId) : Promise.resolve(undefined),
      appointment.radioId ? this.getRadio(organisationId, appointment.radioId) : Promise.resolve(undefined),
    ]);

    let surgeryImplantData: (SurgeryImplant & { implant: Implant }) | undefined;
    if (appointment.surgeryImplantId) {
      const detail = await this.getSurgeryImplantWithDetails(organisationId, appointment.surgeryImplantId);
      if (detail) {
        surgeryImplantData = {
          ...detail,
          implant: detail.implant,
        };
      }
    }

    return {
      ...appointment,
      patient: patientData,
      operation: operationData,
      surgeryImplant: surgeryImplantData,
      radio: radioData,
    };
  }

  async getAllAppointments(organisationId: string, status?: string): Promise<Appointment[]> {
    const conditions = [eq(appointments.organisationId, organisationId)];
    if (status === 'UPCOMING') {
      conditions.push(eq(appointments.status, 'UPCOMING'));
    } else if (status === 'COMPLETED') {
      conditions.push(eq(appointments.status, 'COMPLETED'));
    } else if (status === 'CANCELLED') {
      conditions.push(eq(appointments.status, 'CANCELLED'));
    }
    return db.select().from(appointments)
      .where(and(...conditions))
      .orderBy(desc(appointments.dateStart));
  }

  async getAllAppointmentsWithPatient(organisationId: string, status?: string): Promise<AppointmentWithPatient[]> {
    const conditions = [eq(appointments.organisationId, organisationId)];
    if (status === 'UPCOMING') {
      conditions.push(eq(appointments.status, 'UPCOMING'));
    } else if (status === 'COMPLETED') {
      conditions.push(eq(appointments.status, 'COMPLETED'));
    } else if (status === 'CANCELLED') {
      conditions.push(eq(appointments.status, 'CANCELLED'));
    }
    
    const result = await db
      .select({
        appointment: appointments,
        patientNom: patients.nom,
        patientPrenom: patients.prenom,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(appointments.dateStart);
    
    return result.map(r => ({
      ...r.appointment,
      patientNom: r.patientNom,
      patientPrenom: r.patientPrenom,
    }));
  }

  async getCalendarAppointments(organisationId: string, filters: import('../shared/types').CalendarFilters): Promise<import('../shared/types').CalendarAppointment[]> {
    const conditions = [eq(appointments.organisationId, organisationId)];
    
    // Date range filtering
    if (filters.start) {
      conditions.push(gte(appointments.dateStart, new Date(filters.start)));
    }
    if (filters.end) {
      conditions.push(lte(appointments.dateStart, new Date(filters.end)));
    }
    
    // Type filtering
    if (filters.types && filters.types.length > 0) {
      conditions.push(inArray(appointments.type, filters.types as any));
    }
    
    // Status filtering
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(appointments.status, filters.statuses as any));
    }
    
    // Patient filtering
    if (filters.patientId) {
      conditions.push(eq(appointments.patientId, filters.patientId));
    }
    
    // Operation filtering
    if (filters.operationId) {
      conditions.push(eq(appointments.operationId, filters.operationId));
    }
    
    const result = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        operationId: appointments.operationId,
        surgeryImplantId: appointments.surgeryImplantId,
        type: appointments.type,
        status: appointments.status,
        title: appointments.title,
        description: appointments.description,
        dateStart: appointments.dateStart,
        dateEnd: appointments.dateEnd,
        isq: appointments.isq,
        color: appointments.color,
        patientNom: patients.nom,
        patientPrenom: patients.prenom,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(appointments.dateStart);
    
    if (result.length === 0) {
      return [];
    }
    
    // Batch fetch critical flags for all patients in the result
    const patientIds = [...new Set(result.map(r => r.patientId))];
    const implantIds = result.map(r => r.surgeryImplantId).filter(Boolean) as string[];
    
    // Get critical flags for patients and implants
    const criticalFlagsResult = await db
      .select({
        entityId: flags.entityId,
        entityType: flags.entityType,
      })
      .from(flags)
      .where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.level, "CRITICAL"),
        isNull(flags.resolvedAt),
        or(
          and(eq(flags.entityType, "PATIENT"), inArray(flags.entityId, patientIds)),
          ...(implantIds.length > 0 ? [and(eq(flags.entityType, "IMPLANT"), inArray(flags.entityId, implantIds))] : [])
        )
      ));
    
    // Build sets for quick lookup
    const patientsWithCriticalFlags = new Set<string>();
    const implantsWithCriticalFlags = new Set<string>();
    
    for (const flag of criticalFlagsResult) {
      if (flag.entityType === "PATIENT") {
        patientsWithCriticalFlags.add(flag.entityId);
      } else if (flag.entityType === "IMPLANT") {
        implantsWithCriticalFlags.add(flag.entityId);
      }
    }
    
    // Return appointments with hasCriticalFlag
    return result.map(apt => ({
      ...apt,
      hasCriticalFlag: patientsWithCriticalFlags.has(apt.patientId) || 
        (apt.surgeryImplantId ? implantsWithCriticalFlags.has(apt.surgeryImplantId) : false),
    }));
  }

  async getPatientAppointments(organisationId: string, patientId: string): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(and(
        eq(appointments.patientId, patientId),
        eq(appointments.organisationId, organisationId)
      ))
      .orderBy(desc(appointments.dateStart));
  }

  async getPatientUpcomingAppointments(organisationId: string, patientId: string): Promise<Appointment[]> {
    const now = new Date();
    return db.select().from(appointments)
      .where(and(
        eq(appointments.patientId, patientId),
        eq(appointments.organisationId, organisationId),
        eq(appointments.status, "UPCOMING"),
        gte(appointments.dateStart, now)
      ))
      .orderBy(appointments.dateStart);
  }

  async getPatientCompletedAppointments(organisationId: string, patientId: string): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(and(
        eq(appointments.patientId, patientId),
        eq(appointments.organisationId, organisationId),
        eq(appointments.status, "COMPLETED")
      ))
      .orderBy(desc(appointments.dateStart));
  }

  async createAppointment(organisationId: string, appointment: InsertAppointment): Promise<Appointment> {
    const [created] = await db.insert(appointments).values({
      ...appointment,
      organisationId,
    }).returning();
    return created;
  }

  async updateAppointment(organisationId: string, id: string, data: Partial<InsertAppointment> & { status?: string; cancelReason?: string | null }): Promise<Appointment | undefined> {
    const now = new Date();
    
    // Build the update object with auto-managed timestamps for status changes
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: now,
    };
    
    // Auto-set completedAt when status changes to COMPLETED
    if (data.status === "COMPLETED") {
      updateData.completedAt = now;
      updateData.cancelledAt = null;
      updateData.cancelReason = null;
    }
    
    // Auto-set cancelledAt when status changes to CANCELLED
    if (data.status === "CANCELLED") {
      updateData.cancelledAt = now;
      updateData.completedAt = null;
    }
    
    // Reset timestamps when status goes back to UPCOMING
    if (data.status === "UPCOMING") {
      updateData.completedAt = null;
      updateData.cancelledAt = null;
      updateData.cancelReason = null;
    }
    
    const [updated] = await db.update(appointments)
      .set(updateData)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteAppointment(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.organisationId, organisationId)
      ))
      .returning();
    return result.length > 0;
  }

  async getAppointmentById(organisationId: string, id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.organisationId, organisationId)
      ));
    return appointment || undefined;
  }

  async getAppointmentConflicts(
    organisationId: string,
    start: Date,
    end: Date,
    excludeId?: string
  ): Promise<Appointment[]> {
    // Find overlapping appointments (UPCOMING only)
    // Overlap: A.start < B.end AND A.end > B.start
    const conditions = [
      eq(appointments.organisationId, organisationId),
      eq(appointments.status, "UPCOMING"),
      lt(appointments.dateStart, end),
      or(
        isNull(appointments.dateEnd),
        gt(appointments.dateEnd, start)
      ),
    ];
    
    if (excludeId) {
      conditions.push(not(eq(appointments.id, excludeId)));
    }
    
    return db.select().from(appointments)
      .where(and(...conditions))
      .orderBy(appointments.dateStart);
  }

  // ========== DOCUMENTS ==========
  async getDocument(organisationId: string, id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents)
      .where(and(
        eq(documents.id, id),
        eq(documents.organisationId, organisationId)
      ));
    return doc || undefined;
  }

  async getPatientDocuments(organisationId: string, patientId: string): Promise<Document[]> {
    return db.select().from(documents)
      .where(and(
        eq(documents.patientId, patientId),
        eq(documents.organisationId, organisationId)
      ))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentTree(organisationId: string): Promise<DocumentTree> {
    // Combine documents and radios for unified file tree
    const result = await pool.query(`
      WITH all_files AS (
        -- Documents
        SELECT patient_id, operation_id FROM documents WHERE organisation_id = $1
        UNION ALL
        -- Radios
        SELECT patient_id, operation_id FROM radios WHERE organisation_id = $1
      ),
      patient_counts AS (
        SELECT f.patient_id, p.nom, p.prenom, COUNT(*) as count
        FROM all_files f
        JOIN patients p ON f.patient_id = p.id
        WHERE f.patient_id IS NOT NULL
        GROUP BY f.patient_id, p.nom, p.prenom
      ),
      operation_counts AS (
        SELECT f.operation_id, o.type_intervention, o.date_operation, p.nom as patient_nom, p.prenom as patient_prenom, p.id as patient_id, COUNT(*) as count
        FROM all_files f
        JOIN operations o ON f.operation_id = o.id
        JOIN patients p ON o.patient_id = p.id
        WHERE f.operation_id IS NOT NULL
        GROUP BY f.operation_id, o.type_intervention, o.date_operation, p.nom, p.prenom, p.id
      ),
      unclassified_count AS (
        SELECT COUNT(*) as count FROM (
          SELECT id FROM documents WHERE organisation_id = $1 AND patient_id IS NULL
          UNION ALL
          SELECT id FROM radios WHERE organisation_id = $1 AND patient_id IS NULL
        ) unclassified
      ),
      total_count AS (
        SELECT (
          (SELECT COUNT(*) FROM documents WHERE organisation_id = $1) +
          (SELECT COUNT(*) FROM radios WHERE organisation_id = $1)
        ) as count
      )
      SELECT 
        (SELECT json_agg(json_build_object('id', patient_id, 'name', nom || ' ' || prenom, 'type', 'patient', 'count', count, 'patientId', patient_id)) FROM patient_counts) as patients,
        (SELECT json_agg(json_build_object('id', operation_id, 'name', patient_nom || ' ' || patient_prenom || ' - ' || TO_CHAR(date_operation, 'DD/MM/YYYY') || ' - ' || CASE type_intervention WHEN 'POSE_IMPLANT' THEN 'Pose' WHEN 'GREFFE_OSSEUSE' THEN 'Greffe' WHEN 'SINUS_LIFT' THEN 'Sinus Lift' WHEN 'EXTRACTION_IMPLANT_IMMEDIATE' THEN 'Extraction' WHEN 'REPRISE_IMPLANT' THEN 'Reprise' WHEN 'CHIRURGIE_GUIDEE' THEN 'Guidée' ELSE type_intervention END, 'type', 'operation', 'count', count, 'operationId', operation_id, 'patientId', patient_id)) FROM operation_counts) as operations,
        (SELECT count FROM unclassified_count) as unclassified_count,
        (SELECT count FROM total_count) as total_count
    `, [organisationId]);
    
    const row = result.rows[0];
    return {
      patients: row.patients || [],
      operations: row.operations || [],
      unclassifiedCount: parseInt(row.unclassified_count) || 0,
      totalCount: parseInt(row.total_count) || 0,
    };
  }

  async getDocumentsFiltered(organisationId: string, filters: DocumentFilters): Promise<{ documents: DocumentWithDetails[]; totalCount: number }> {
    const { scope, patientId, operationId, q, tags, from, to, sort = 'date', sortDir = 'desc', page = 1, pageSize = 25 } = filters;
    
    const conditions: SQL[] = [eq(documents.organisationId, organisationId)];
    
    if (scope === 'patients' && !patientId) {
      conditions.push(sql`${documents.patientId} IS NOT NULL`);
    } else if (scope === 'operations' && !operationId) {
      conditions.push(sql`${documents.operationId} IS NOT NULL`);
    } else if (scope === 'unclassified') {
      conditions.push(sql`${documents.patientId} IS NULL`);
    }
    
    if (patientId) {
      conditions.push(eq(documents.patientId, patientId));
    }
    if (operationId) {
      conditions.push(eq(documents.operationId, operationId));
    }
    if (q) {
      conditions.push(or(
        ilike(documents.title, `%${q}%`),
        ilike(documents.fileName, `%${q}%`)
      )!);
    }
    if (tags && tags.length > 0) {
      conditions.push(sql`${documents.tags} && ARRAY[${sql.join(tags.map(t => sql`${t}`), sql`, `)}]::text[]`);
    }
    if (from) {
      conditions.push(gte(documents.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(documents.createdAt, new Date(to)));
    }
    
    const whereClause = and(...conditions);
    
    const orderByColumn = sort === 'name' ? documents.title 
      : sort === 'type' ? documents.mimeType 
      : sort === 'size' ? documents.sizeBytes 
      : documents.createdAt;
    const orderBy = sortDir === 'asc' ? orderByColumn : desc(orderByColumn);
    
    const offset = (page - 1) * pageSize;
    
    const [docsResult, countResult] = await Promise.all([
      db.select({
        document: documents,
        patient: patients,
        operation: operations,
      })
        .from(documents)
        .leftJoin(patients, eq(documents.patientId, patients.id))
        .leftJoin(operations, eq(documents.operationId, operations.id))
        .where(whereClause)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(whereClause),
    ]);
    
    const documentsWithDetails: DocumentWithDetails[] = docsResult.map(row => ({
      ...row.document,
      patient: row.patient || undefined,
      operation: row.operation || undefined,
    }));
    
    return {
      documents: documentsWithDetails,
      totalCount: Number(countResult[0]?.count || 0),
    };
  }

  async createDocument(organisationId: string, doc: InsertDocument & { createdBy?: string | null }): Promise<Document> {
    const [created] = await db.insert(documents).values({
      ...doc,
      organisationId,
    }).returning();
    return created;
  }

  async updateDocument(organisationId: string, id: string, updates: { title?: string; tags?: string[]; patientId?: string | null; operationId?: string | null }): Promise<Document | undefined> {
    const [updated] = await db.update(documents)
      .set(updates)
      .where(and(
        eq(documents.id, id),
        eq(documents.organisationId, organisationId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteDocument(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(documents)
      .where(and(
        eq(documents.id, id),
        eq(documents.organisationId, organisationId)
      ))
      .returning();
    return result.length > 0;
  }

  async getUnifiedFiles(organisationId: string, filters: DocumentFilters): Promise<{ files: UnifiedFile[]; totalCount: number }> {
    const { scope, patientId, operationId, q, from, to, sort = 'date', sortDir = 'desc', page = 1, pageSize = 25 } = filters;
    const offset = (page - 1) * pageSize;
    
    // Build WHERE conditions for documents
    let docWhere = `d.organisation_id = $1`;
    let radioWhere = `r.organisation_id = $1`;
    const params: (string | Date)[] = [organisationId];
    let paramIndex = 2;

    if (scope === 'patients' && !patientId) {
      docWhere += ` AND d.patient_id IS NOT NULL`;
      radioWhere += ` AND r.patient_id IS NOT NULL`;
    } else if (scope === 'operations' && !operationId) {
      docWhere += ` AND d.operation_id IS NOT NULL`;
      radioWhere += ` AND r.operation_id IS NOT NULL`;
    } else if (scope === 'unclassified') {
      docWhere += ` AND d.patient_id IS NULL`;
      radioWhere += ` AND r.patient_id IS NULL`;
    }

    if (patientId) {
      docWhere += ` AND d.patient_id = $${paramIndex}`;
      radioWhere += ` AND r.patient_id = $${paramIndex}`;
      params.push(patientId);
      paramIndex++;
    }
    if (operationId) {
      docWhere += ` AND d.operation_id = $${paramIndex}`;
      radioWhere += ` AND r.operation_id = $${paramIndex}`;
      params.push(operationId);
      paramIndex++;
    }
    if (q) {
      docWhere += ` AND (d.title ILIKE $${paramIndex} OR d.file_name ILIKE $${paramIndex})`;
      radioWhere += ` AND (r.title ILIKE $${paramIndex} OR r.file_name ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (from) {
      docWhere += ` AND d.created_at >= $${paramIndex}`;
      radioWhere += ` AND r.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      docWhere += ` AND d.created_at <= $${paramIndex}`;
      radioWhere += ` AND r.created_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    // Determine sort column
    const sortColumn = sort === 'name' ? 'title' 
      : sort === 'size' ? 'size_bytes' 
      : sort === 'type' ? 'mime_type'
      : 'created_at';
    const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC';

    // Query combining documents and radios
    const query = `
      WITH unified AS (
        SELECT 
          d.id,
          'document' as source_type,
          d.title,
          d.file_name,
          d.file_path,
          d.mime_type,
          d.size_bytes,
          d.tags,
          d.patient_id,
          d.operation_id,
          d.created_at,
          d.created_by,
          NULL as radio_type,
          NULL as radio_date,
          NULL as implant_id
        FROM documents d
        WHERE ${docWhere}
        
        UNION ALL
        
        SELECT 
          r.id,
          'radio' as source_type,
          r.title,
          r.file_name,
          r.file_path,
          r.mime_type,
          r.size_bytes,
          NULL as tags,
          r.patient_id,
          r.operation_id,
          r.created_at,
          r.created_by,
          r.type as radio_type,
          r.date as radio_date,
          r.implant_id
        FROM radios r
        WHERE ${radioWhere}
      )
      SELECT 
        u.*,
        p.id as p_id, p.nom as p_nom, p.prenom as p_prenom, p.date_naissance as p_date_naissance, p.sexe as p_sexe,
        o.id as o_id, o.date_operation as o_date_operation, o.type_intervention as o_type_intervention, o.patient_id as o_patient_id,
        (SELECT rn.body FROM radio_notes rn WHERE rn.radio_id = u.id AND u.source_type = 'radio' ORDER BY rn.created_at DESC LIMIT 1) as last_note
      FROM unified u
      LEFT JOIN patients p ON u.patient_id = p.id
      LEFT JOIN operations o ON u.operation_id = o.id
      ORDER BY u.${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(pageSize.toString(), offset.toString());

    // Count query
    const countQuery = `
      SELECT (
        (SELECT COUNT(*) FROM documents d WHERE ${docWhere}) +
        (SELECT COUNT(*) FROM radios r WHERE ${radioWhere})
      ) as total
    `;

    const [filesResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, paramIndex - 1))
    ]);

    const files: UnifiedFile[] = filesResult.rows.map(row => ({
      id: row.id,
      sourceType: row.source_type as 'document' | 'radio',
      title: row.title,
      fileName: row.file_name,
      filePath: row.file_path,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
      tags: row.tags,
      patientId: row.patient_id,
      operationId: row.operation_id,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      radioType: row.radio_type,
      radioDate: row.radio_date,
      implantId: row.implant_id,
      lastNote: row.last_note || null,
      patient: row.p_id ? {
        id: row.p_id,
        organisationId,
        nom: row.p_nom,
        prenom: row.p_prenom,
        dateNaissance: row.p_date_naissance,
        sexe: row.p_sexe,
        telephone: null,
        email: null,
        adresse: null,
        codePostal: null,
        ville: null,
        pays: null,
        allergies: null,
        traitement: null,
        conditions: null,
        contexteMedical: null,
        statut: null,
        createdAt: new Date(),
      } : undefined,
      operation: row.o_id ? {
        id: row.o_id,
        patientId: row.o_patient_id,
        dateOperation: row.o_date_operation,
        typeIntervention: row.o_type_intervention,
        typeChirurgieTemps: null,
        typeChirurgieApproche: null,
        greffeOsseuse: null,
        typeGreffe: null,
        greffeQuantite: null,
        greffeLocalisation: null,
        typeMiseEnCharge: null,
        conditionsMedicalesPreop: null,
        notesPerop: null,
        observationsPostop: null,
      } : undefined,
    }));

    return {
      files,
      totalCount: Number(countResult.rows[0]?.total || 0),
    };
  }

  // ========== SAVED FILTERS ==========
  async getSavedFilters(organisationId: string, pageType: SavedFilterPageType): Promise<SavedFilter[]> {
    return db.select().from(savedFilters)
      .where(and(
        eq(savedFilters.organisationId, organisationId),
        eq(savedFilters.pageType, pageType)
      ))
      .orderBy(desc(savedFilters.createdAt));
  }

  async createSavedFilter(organisationId: string, filter: InsertSavedFilter): Promise<SavedFilter> {
    const [created] = await db.insert(savedFilters).values({
      ...filter,
      organisationId,
    }).returning();
    return created;
  }

  async deleteSavedFilter(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(savedFilters)
      .where(and(
        eq(savedFilters.id, id),
        eq(savedFilters.organisationId, organisationId)
      ))
      .returning();
    return result.length > 0;
  }

  // ========== TIMELINE ==========
  async getOperationTimeline(organisationId: string, operationId: string): Promise<OperationTimeline | null> {
    // Get operation with patient info
    const [operationWithPatient] = await db
      .select({
        operation: operations,
        patientNom: patients.nom,
        patientPrenom: patients.prenom,
      })
      .from(operations)
      .innerJoin(patients, eq(operations.patientId, patients.id))
      .where(and(
        eq(operations.id, operationId),
        eq(operations.organisationId, organisationId)
      ));

    if (!operationWithPatient) {
      return null;
    }

    const { operation, patientNom, patientPrenom } = operationWithPatient;
    const events: TimelineEvent[] = [];
    const todayDate = new Date();
    todayDate.setHours(23, 59, 59, 999);

    const isInPast = (dateStr: string) => new Date(dateStr) <= todayDate;

    // 1. Add the surgery itself as an event
    events.push({
      type: "SURGERY",
      at: operation.dateOperation,
      title: this.getInterventionLabel(operation.typeIntervention),
      description: operation.notesPerop || undefined,
      status: isInPast(operation.dateOperation) ? "done" : "upcoming",
      actId: operation.id,
    });

    // 2. Get surgery implants for this operation with their ISQ values
    const surgeryImplantsData = await db
      .select({
        surgeryImplant: surgeryImplants,
        implant: implants,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .where(and(
        eq(surgeryImplants.surgeryId, operationId),
        eq(surgeryImplants.organisationId, organisationId)
      ));

    // Collect surgery implant IDs for visit queries
    const surgeryImplantIds = surgeryImplantsData.map(s => s.surgeryImplant.id);

    // Build maps for implant lookup - use arrays to handle multiple surgery implants with same catalog implant
    const surgeryImplantMap = new Map<string, { surgeryImplant: typeof surgeryImplantsData[0]["surgeryImplant"], implant: typeof surgeryImplantsData[0]["implant"] }>();
    const catalogImplantMap = new Map<string, { surgeryImplant: typeof surgeryImplantsData[0]["surgeryImplant"], implant: typeof surgeryImplantsData[0]["implant"] }[]>();
    
    for (const { surgeryImplant, implant } of surgeryImplantsData) {
      surgeryImplantMap.set(surgeryImplant.id, { surgeryImplant, implant });
      if (!catalogImplantMap.has(implant.id)) {
        catalogImplantMap.set(implant.id, []);
      }
      catalogImplantMap.get(implant.id)!.push({ surgeryImplant, implant });
    }

    // Track ISQ history per catalog implant for delta calculation
    const isqHistory = new Map<string, { date: string; value: number }[]>();

    // Add ISQ events from pose (initial measurement)
    for (const { surgeryImplant, implant } of surgeryImplantsData) {
      if (surgeryImplant.isqPose !== null) {
        const stability = this.getIsqStability(surgeryImplant.isqPose);
        events.push({
          type: "ISQ",
          at: surgeryImplant.datePose,
          title: `Mesure ISQ initiale`,
          description: `Site ${surgeryImplant.siteFdi} - ${implant.marque}`,
          status: "done",
          surgeryImplantId: surgeryImplant.id,
          implantLabel: `${surgeryImplant.siteFdi} - ${implant.marque} ${implant.diametre}x${implant.longueur}`,
          siteFdi: surgeryImplant.siteFdi,
          value: surgeryImplant.isqPose,
          stability,
        });
        
        // Track initial ISQ for delta calculation
        if (!isqHistory.has(implant.id)) {
          isqHistory.set(implant.id, []);
        }
        isqHistory.get(implant.id)!.push({ date: surgeryImplant.datePose, value: surgeryImplant.isqPose });
      }
    }

    // 3. Get appointments for this operation (either directly linked or via surgeryImplant)
    // First, try appointments linked to surgeryImplants used in this operation
    if (surgeryImplantIds.length > 0) {
      const appointmentsData = await db
        .select({
          appointment: appointments,
          dateStr: sql<string>`TO_CHAR(${appointments.dateStart}, 'YYYY-MM-DD')`,
        })
        .from(appointments)
        .where(and(
          eq(appointments.organisationId, organisationId),
          or(
            eq(appointments.operationId, operationId),
            inArray(appointments.surgeryImplantId, surgeryImplantIds)
          )
        ))
        .orderBy(appointments.dateStart);

      // Add appointment events as visits
      for (const { appointment, dateStr: appointmentDate } of appointmentsData) {
        
        // Try to find the associated surgery implant for context
        let surgeryImplant = appointment.surgeryImplantId 
          ? surgeryImplantMap.get(appointment.surgeryImplantId)?.surgeryImplant 
          : null;
        let implant = appointment.surgeryImplantId 
          ? surgeryImplantMap.get(appointment.surgeryImplantId)?.implant 
          : null;
        
        let stability: "low" | "moderate" | "high" | undefined;
        let delta: number | undefined;
        let previousValue: number | undefined;
        
        if (appointment.isq !== null) {
          stability = this.getIsqStability(appointment.isq);
          
          // Try to calculate ISQ delta if we have a linked implant
          if (implant) {
            const history = isqHistory.get(implant.id) || [];
            const previousMeasurements = history.filter(h => h.date < appointmentDate);
            previousValue = previousMeasurements.length > 0 
              ? previousMeasurements[previousMeasurements.length - 1].value 
              : undefined;
            delta = previousValue !== undefined ? appointment.isq - previousValue : undefined;
            
            // Track this measurement for future delta calculations
            if (!isqHistory.has(implant.id)) {
              isqHistory.set(implant.id, []);
            }
            isqHistory.get(implant.id)!.push({ date: appointmentDate, value: appointment.isq });
          }
        }
        
        events.push({
          type: "VISIT",
          at: appointmentDate,
          title: appointment.title,
          description: appointment.description || undefined,
          status: appointment.status === "COMPLETED" ? "done" : (appointment.status === "CANCELLED" ? "cancelled" : "upcoming"),
          visitId: appointment.id,
          visitType: appointment.type.toLowerCase(),
          surgeryImplantId: surgeryImplant?.id,
          implantLabel: surgeryImplant && implant ? `${surgeryImplant.siteFdi} - ${implant.marque}` : undefined,
          siteFdi: surgeryImplant?.siteFdi,
          value: appointment.isq ?? undefined,
          stability,
          delta,
          previousValue,
        });
      }
    } else {
      // No surgery implants, just get appointments directly linked to this operation
      const appointmentsData = await db
        .select({
          appointment: appointments,
          dateStr: sql<string>`TO_CHAR(${appointments.dateStart}, 'YYYY-MM-DD')`,
        })
        .from(appointments)
        .where(and(
          eq(appointments.organisationId, organisationId),
          eq(appointments.operationId, operationId)
        ))
        .orderBy(appointments.dateStart);

      for (const { appointment, dateStr: appointmentDate } of appointmentsData) {
        
        let stability: "low" | "moderate" | "high" | undefined;
        if (appointment.isq !== null) {
          stability = this.getIsqStability(appointment.isq);
        }
        
        events.push({
          type: "VISIT",
          at: appointmentDate,
          title: appointment.title,
          description: appointment.description || undefined,
          status: appointment.status === "COMPLETED" ? "done" : (appointment.status === "CANCELLED" ? "cancelled" : "upcoming"),
          visitId: appointment.id,
          visitType: appointment.type.toLowerCase(),
          value: appointment.isq ?? undefined,
          stability,
        });
      }
    }

    // 4. Get radios linked to this operation
    const radiosData = await db
      .select()
      .from(radios)
      .where(and(
        eq(radios.organisationId, organisationId),
        eq(radios.operationId, operationId)
      ));

    for (const radio of radiosData) {
      events.push({
        type: "RADIO",
        at: radio.date,
        title: radio.title || this.getRadioTypeLabel(radio.type),
        status: isInPast(radio.date) ? "done" : "upcoming",
        radioId: radio.id,
        radioType: radio.type,
      });
    }

    // Sort events by date descending (most recent first)
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // Limit to 50 events as per spec
    const limitedEvents = events.slice(0, 50);

    return {
      operation: {
        id: operation.id,
        dateOperation: operation.dateOperation,
        typeIntervention: operation.typeIntervention,
        patientId: operation.patientId,
        patientNom,
        patientPrenom,
      },
      events: limitedEvents,
    };
  }

  private getIsqStability(isq: number): "low" | "moderate" | "high" {
    if (isq < 55) return "low";
    if (isq < 70) return "moderate";
    return "high";
  }

  private getInterventionLabel(type: string): string {
    const labels: Record<string, string> = {
      POSE_IMPLANT: "Pose d'implant",
      GREFFE_OSSEUSE: "Greffe osseuse",
      SINUS_LIFT: "Sinus lift",
      EXTRACTION_IMPLANT_IMMEDIATE: "Extraction + Implant immédiat",
      REPRISE_IMPLANT: "Reprise d'implant",
      CHIRURGIE_GUIDEE: "Chirurgie guidée",
    };
    return labels[type] || type;
  }

  private getRadioTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      PANORAMIQUE: "Panoramique",
      CBCT: "CBCT",
      RETROALVEOLAIRE: "Rétro-alvéolaire",
    };
    return labels[type] || type;
  }

  // ========== FLAGS ==========
  async getFlags(organisationId: string, includeResolved = false): Promise<Flag[]> {
    let query = db
      .select()
      .from(flags)
      .where(eq(flags.organisationId, organisationId));
    
    if (!includeResolved) {
      query = db
        .select()
        .from(flags)
        .where(and(
          eq(flags.organisationId, organisationId),
          sql`${flags.resolvedAt} IS NULL`
        ));
    }
    
    return query.orderBy(desc(flags.createdAt));
  }

  async getFlagsWithEntity(organisationId: string, includeResolved = false): Promise<FlagWithEntity[]> {
    const allFlags = await this.getFlags(organisationId, includeResolved);
    
    const result: FlagWithEntity[] = [];
    
    for (const flag of allFlags) {
      let entityName: string | undefined;
      let patientId: string | undefined;
      let patientNom: string | undefined;
      let patientPrenom: string | undefined;
      
      if (flag.entityType === "PATIENT") {
        const [patient] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, flag.entityId))
          .limit(1);
        if (patient) {
          entityName = `${patient.prenom} ${patient.nom}`;
          patientId = patient.id;
          patientNom = patient.nom;
          patientPrenom = patient.prenom;
        }
      } else if (flag.entityType === "OPERATION") {
        const [op] = await db
          .select({
            id: operations.id,
            typeIntervention: operations.typeIntervention,
            patientId: patients.id,
            patientNom: patients.nom,
            patientPrenom: patients.prenom,
          })
          .from(operations)
          .innerJoin(patients, eq(operations.patientId, patients.id))
          .where(eq(operations.id, flag.entityId))
          .limit(1);
        if (op) {
          entityName = this.getInterventionLabel(op.typeIntervention || "");
          patientId = op.patientId;
          patientNom = op.patientNom;
          patientPrenom = op.patientPrenom;
        }
      } else if (flag.entityType === "IMPLANT") {
        const [si] = await db
          .select({
            id: surgeryImplants.id,
            siteFdi: surgeryImplants.siteFdi,
            marque: implants.marque,
            patientId: patients.id,
            patientNom: patients.nom,
            patientPrenom: patients.prenom,
          })
          .from(surgeryImplants)
          .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
          .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
          .innerJoin(patients, eq(operations.patientId, patients.id))
          .where(eq(surgeryImplants.id, flag.entityId))
          .limit(1);
        if (si) {
          entityName = `${si.marque} - Site ${si.siteFdi}`;
          patientId = si.patientId;
          patientNom = si.patientNom;
          patientPrenom = si.patientPrenom;
        }
      }
      
      result.push({
        ...flag,
        entityName,
        patientId,
        patientNom,
        patientPrenom,
      });
    }
    
    return result;
  }

  async getEntityFlags(organisationId: string, entityType: string, entityId: string): Promise<Flag[]> {
    return db
      .select()
      .from(flags)
      .where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.entityType, entityType as "PATIENT" | "OPERATION" | "IMPLANT"),
        eq(flags.entityId, entityId),
        sql`${flags.resolvedAt} IS NULL`
      ))
      .orderBy(desc(flags.createdAt));
  }

  async createFlag(organisationId: string, flag: InsertFlag): Promise<Flag> {
    const [created] = await db
      .insert(flags)
      .values({
        ...flag,
        organisationId,
      })
      .returning();
    return created;
  }

  async resolveFlag(organisationId: string, id: string, userId: string): Promise<Flag | undefined> {
    const [updated] = await db
      .update(flags)
      .set({
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(and(
        eq(flags.id, id),
        eq(flags.organisationId, organisationId)
      ))
      .returning();
    return updated;
  }

  async resolveFlagByTypeAndPatient(organisationId: string, type: FlagType, patientId: string, userId: string): Promise<number> {
    const result = await db
      .update(flags)
      .set({
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.type, type),
        eq(flags.entityType, "PATIENT"),
        eq(flags.entityId, patientId),
        sql`${flags.resolvedAt} IS NULL`
      ))
      .returning({ id: flags.id });
    return result.length;
  }

  async deleteFlag(organisationId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(flags)
      .where(and(
        eq(flags.id, id),
        eq(flags.organisationId, organisationId)
      ));
    return true;
  }

  async upsertFlag(organisationId: string, flag: InsertFlag): Promise<Flag> {
    const existing = await db
      .select()
      .from(flags)
      .where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.type, flag.type),
        eq(flags.entityType, flag.entityType),
        eq(flags.entityId, flag.entityId),
        sql`${flags.resolvedAt} IS NULL`
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    return this.createFlag(organisationId, flag);
  }

  // ========== FLAG AGGREGATION ==========
  
  async getPatientFlagSummary(organisationId: string, patientId: string): Promise<{ topFlag?: TopFlag; activeFlagCount: number }> {
    // Gracefully handle missing flags table
    try {
      // Get all unresolved flags for this patient:
      // 1. Direct patient flags
      // 2. Flags on patient's operations
      // 3. Flags on patient's surgery implants
      
      const patientFlags = await db.select().from(flags).where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.entityType, "PATIENT"),
        eq(flags.entityId, patientId),
        sql`${flags.resolvedAt} IS NULL`
      ));
      
      // Get patient's operation IDs
      const patientOps = await db.select({ id: operations.id }).from(operations)
        .where(and(eq(operations.organisationId, organisationId), eq(operations.patientId, patientId)));
      const opIds = patientOps.map(o => o.id);
      
      let operationFlags: Flag[] = [];
      if (opIds.length > 0) {
        operationFlags = await db.select().from(flags).where(and(
          eq(flags.organisationId, organisationId),
          eq(flags.entityType, "OPERATION"),
          inArray(flags.entityId, opIds),
          sql`${flags.resolvedAt} IS NULL`
        ));
      }
      
      // Get patient's surgery implant IDs (via operations)
      let implantFlags: Flag[] = [];
      if (opIds.length > 0) {
        const patientSurgeryImplants = await db.select({ id: surgeryImplants.id }).from(surgeryImplants)
          .where(and(eq(surgeryImplants.organisationId, organisationId), inArray(surgeryImplants.surgeryId, opIds)));
        const siIds = patientSurgeryImplants.map(si => si.id);
        
        if (siIds.length > 0) {
          implantFlags = await db.select().from(flags).where(and(
            eq(flags.organisationId, organisationId),
            eq(flags.entityType, "IMPLANT"),
            inArray(flags.entityId, siIds),
            sql`${flags.resolvedAt} IS NULL`
          ));
        }
      }
      
      const allFlags = [...patientFlags, ...operationFlags, ...implantFlags];
      const activeFlagCount = allFlags.length;
      
      if (activeFlagCount === 0) {
        return { activeFlagCount: 0 };
      }
      
      // Sort by level priority (CRITICAL > WARNING > INFO), then by createdAt desc
      const levelPriority: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      allFlags.sort((a, b) => {
        const levelDiff = (levelPriority[a.level] ?? 3) - (levelPriority[b.level] ?? 3);
        if (levelDiff !== 0) return levelDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      const top = allFlags[0];
      return {
        topFlag: {
          type: top.type,
          level: top.level as "CRITICAL" | "WARNING" | "INFO",
          label: top.label,
          createdAt: top.createdAt.toISOString(),
        },
        activeFlagCount,
      };
    } catch (err: any) {
      // If flags table doesn't exist, return empty result
      if (err?.code === "42P01") {
        return { activeFlagCount: 0 };
      }
      throw err;
    }
  }

  async getPatientAllFlags(organisationId: string, patientId: string): Promise<{ patientFlags: Flag[]; implantFlagsById: Record<string, Flag[]> }> {
    try {
      // Get direct patient flags
      const patientFlagsResult = await db.select().from(flags).where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.entityType, "PATIENT"),
        eq(flags.entityId, patientId),
        sql`${flags.resolvedAt} IS NULL`
      )).orderBy(desc(flags.createdAt));
      
      // Get patient's operation IDs
      const patientOps = await db.select({ id: operations.id }).from(operations)
        .where(and(eq(operations.organisationId, organisationId), eq(operations.patientId, patientId)));
      const opIds = patientOps.map(o => o.id);
      
      // Get patient's surgery implant IDs (via operations) and their flags
      const implantFlagsById: Record<string, Flag[]> = {};
      
      if (opIds.length > 0) {
        const patientSurgeryImplants = await db.select({ id: surgeryImplants.id }).from(surgeryImplants)
          .where(and(eq(surgeryImplants.organisationId, organisationId), inArray(surgeryImplants.surgeryId, opIds)));
        const siIds = patientSurgeryImplants.map(si => si.id);
        
        if (siIds.length > 0) {
          const allImplantFlags = await db.select().from(flags).where(and(
            eq(flags.organisationId, organisationId),
            eq(flags.entityType, "IMPLANT"),
            inArray(flags.entityId, siIds),
            sql`${flags.resolvedAt} IS NULL`
          )).orderBy(desc(flags.createdAt));
          
          // Group by implant ID
          for (const flag of allImplantFlags) {
            if (!implantFlagsById[flag.entityId]) {
              implantFlagsById[flag.entityId] = [];
            }
            implantFlagsById[flag.entityId].push(flag);
          }
        }
      }
      
      return {
        patientFlags: patientFlagsResult,
        implantFlagsById,
      };
    } catch (err: any) {
      if (err?.code === "42P01") {
        return { patientFlags: [], implantFlagsById: {} };
      }
      throw err;
    }
  }
  
  async getAllPatientFlagSummaries(organisationId: string): Promise<Map<string, { topFlag?: TopFlag; activeFlagCount: number }>> {
    // Optimized: Batch query for all patients instead of N+1
    const result = new Map<string, { topFlag?: TopFlag; activeFlagCount: number }>();
    
    try {
      // Get all unresolved flags
      const allFlags = await db.select().from(flags).where(and(
        eq(flags.organisationId, organisationId),
        sql`${flags.resolvedAt} IS NULL`
      ));
      
      // Build lookup maps: surgeryImplantId -> patientId, operationId -> patientId
      const opToPatient = new Map<string, string>();
      const siToOp = new Map<string, string>();
      
      const allOps = await db.select({ id: operations.id, patientId: operations.patientId })
        .from(operations).where(eq(operations.organisationId, organisationId));
      for (const op of allOps) {
        opToPatient.set(op.id, op.patientId);
      }
      
      const allSi = await db.select({ id: surgeryImplants.id, surgeryId: surgeryImplants.surgeryId })
        .from(surgeryImplants).where(eq(surgeryImplants.organisationId, organisationId));
      for (const si of allSi) {
        siToOp.set(si.id, si.surgeryId);
      }
      
      // Group flags by patient
      const patientFlagsMap = new Map<string, Flag[]>();
      
      for (const flag of allFlags) {
        let patientId: string | undefined;
        
        if (flag.entityType === "PATIENT") {
          patientId = flag.entityId;
        } else if (flag.entityType === "OPERATION") {
          patientId = opToPatient.get(flag.entityId);
        } else if (flag.entityType === "IMPLANT") {
          const opId = siToOp.get(flag.entityId);
          if (opId) patientId = opToPatient.get(opId);
        }
        
        if (patientId) {
          if (!patientFlagsMap.has(patientId)) {
            patientFlagsMap.set(patientId, []);
          }
          patientFlagsMap.get(patientId)!.push(flag);
        }
      }
      
      // Build summary for each patient
      const levelPriority: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      
      for (const [patientId, patientFlags] of patientFlagsMap) {
        patientFlags.sort((a, b) => {
          const levelDiff = (levelPriority[a.level] ?? 3) - (levelPriority[b.level] ?? 3);
          if (levelDiff !== 0) return levelDiff;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        const top = patientFlags[0];
        result.set(patientId, {
          topFlag: {
            type: top.type,
            level: top.level as "CRITICAL" | "WARNING" | "INFO",
            label: top.label,
            createdAt: top.createdAt.toISOString(),
          },
          activeFlagCount: patientFlags.length,
        });
      }
      
      return result;
    } catch (err: any) {
      // If flags table doesn't exist, return empty map
      if (err?.code === "42P01") {
        return result;
      }
      throw err;
    }
  }
  
  async getSurgeryImplantFlagSummary(organisationId: string, surgeryImplantId: string): Promise<{ topFlag?: TopFlag; activeFlagCount: number }> {
    try {
      const implantFlags = await db.select().from(flags).where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.entityType, "IMPLANT"),
        eq(flags.entityId, surgeryImplantId),
        sql`${flags.resolvedAt} IS NULL`
      ));
      
      const activeFlagCount = implantFlags.length;
      
      if (activeFlagCount === 0) {
        return { activeFlagCount: 0 };
      }
      
      const levelPriority: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      implantFlags.sort((a, b) => {
        const levelDiff = (levelPriority[a.level] ?? 3) - (levelPriority[b.level] ?? 3);
        if (levelDiff !== 0) return levelDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      const top = implantFlags[0];
      return {
        topFlag: {
          type: top.type,
          level: top.level as "CRITICAL" | "WARNING" | "INFO",
          label: top.label,
          createdAt: top.createdAt.toISOString(),
        },
        activeFlagCount,
      };
    } catch (err: any) {
      // If flags table doesn't exist, return empty result
      if (err?.code === "42P01") {
        return { activeFlagCount: 0 };
      }
      throw err;
    }
  }
  
  // Batch method to get flag summaries for multiple surgery implants at once
  async getSurgeryImplantFlagSummaries(organisationId: string, surgeryImplantIds: string[]): Promise<Map<string, { topFlag?: TopFlag; activeFlagCount: number }>> {
    const result = new Map<string, { topFlag?: TopFlag; activeFlagCount: number }>();
    
    if (surgeryImplantIds.length === 0) {
      return result;
    }
    
    try {
      // Single query for all implant flags
      const allImplantFlags = await db.select().from(flags).where(and(
        eq(flags.organisationId, organisationId),
        eq(flags.entityType, "IMPLANT"),
        inArray(flags.entityId, surgeryImplantIds),
        sql`${flags.resolvedAt} IS NULL`
      ));
      
      // Group flags by surgeryImplantId
      const flagsByImplant = new Map<string, Flag[]>();
      for (const flag of allImplantFlags) {
        if (!flagsByImplant.has(flag.entityId)) {
          flagsByImplant.set(flag.entityId, []);
        }
        flagsByImplant.get(flag.entityId)!.push(flag);
      }
      
      // Build summaries
      const levelPriority: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      
      for (const [implantId, implantFlags] of flagsByImplant) {
        implantFlags.sort((a: Flag, b: Flag) => {
          const levelDiff = (levelPriority[a.level] ?? 3) - (levelPriority[b.level] ?? 3);
          if (levelDiff !== 0) return levelDiff;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        const top = implantFlags[0];
        result.set(implantId, {
          topFlag: {
            type: top.type,
            level: top.level as "CRITICAL" | "WARNING" | "INFO",
            label: top.label,
            createdAt: top.createdAt.toISOString(),
          },
          activeFlagCount: implantFlags.length,
        });
      }
      
      return result;
    } catch (err: any) {
      // If flags table doesn't exist, return empty map
      if (err?.code === "42P01") {
        return result;
      }
      throw err;
    }
  }

  // ========== CALENDAR INTEGRATION (multi-tenant) ==========
  
  // Get integration for org (if userId is null) or specific user
  async getCalendarIntegration(organisationId: string, userId?: string): Promise<CalendarIntegration | undefined> {
    const conditions = [
      eq(calendarIntegrations.organisationId, organisationId),
      eq(calendarIntegrations.provider, "google")
    ];
    
    if (userId) {
      conditions.push(eq(calendarIntegrations.userId, userId));
    } else {
      conditions.push(sql`${calendarIntegrations.userId} IS NULL`);
    }
    
    const [integration] = await db.select().from(calendarIntegrations)
      .where(and(...conditions))
      .limit(1);
    return integration;
  }
  
  // Priority: user-level > org-level integration
  async getActiveIntegrationForAppointment(organisationId: string, assignedUserId?: string | null): Promise<CalendarIntegration | undefined> {
    // First, try user-level integration if assignedUserId is provided
    if (assignedUserId) {
      const userIntegration = await this.getCalendarIntegration(organisationId, assignedUserId);
      if (userIntegration && userIntegration.isEnabled && userIntegration.targetCalendarId) {
        return userIntegration;
      }
    }
    
    // Fallback to org-level integration
    const orgIntegration = await this.getCalendarIntegration(organisationId);
    if (orgIntegration && orgIntegration.isEnabled && orgIntegration.targetCalendarId) {
      return orgIntegration;
    }
    
    return undefined;
  }

  async createCalendarIntegration(organisationId: string, data: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const [integration] = await db.insert(calendarIntegrations)
      .values({ ...data, organisationId })
      .returning();
    return integration;
  }

  async updateCalendarIntegration(organisationId: string, id: string, data: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined> {
    const [integration] = await db.update(calendarIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.organisationId, organisationId)
      ))
      .returning();
    return integration;
  }
  
  async deleteCalendarIntegration(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(calendarIntegrations)
      .where(and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.organisationId, organisationId)
      ))
      .returning({ id: calendarIntegrations.id });
    return result.length > 0;
  }

  async getAppointmentsForSync(organisationId: string, lastSyncAt?: Date): Promise<(Appointment & { patient?: { nom: string; prenom: string } })[]> {
    const conditions = [
      eq(appointments.organisationId, organisationId),
    ];
    
    // Get appointments that need sync:
    // 1. UPCOMING status (new/modified)
    // 2. OR sync_status is PENDING or ERROR
    // 3. OR updated since lastSyncAt
    if (lastSyncAt) {
      conditions.push(
        or(
          eq(appointments.status, "UPCOMING"),
          inArray(appointments.syncStatus, ["PENDING", "ERROR"]),
          gte(appointments.updatedAt, lastSyncAt)
        )!
      );
    } else {
      conditions.push(eq(appointments.status, "UPCOMING"));
    }
    
    const result = await db.select({
      appointment: appointments,
      patient: {
        nom: patients.nom,
        prenom: patients.prenom,
      },
    }).from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(and(...conditions));
    
    return result.map(r => ({
      ...r.appointment,
      patient: r.patient ? { nom: r.patient.nom, prenom: r.patient.prenom } : undefined,
    }));
  }

  async updateAppointmentSync(organisationId: string, id: string, data: { 
    externalProvider?: string; 
    externalCalendarId?: string; 
    externalEventId?: string; 
    externalEtag?: string; 
    syncStatus?: string; 
    lastSyncedAt?: Date; 
    syncError?: string | null;
  }): Promise<void> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.externalProvider !== undefined) updateData.externalProvider = data.externalProvider;
    if (data.externalCalendarId !== undefined) updateData.externalCalendarId = data.externalCalendarId;
    if (data.externalEventId !== undefined) updateData.externalEventId = data.externalEventId;
    if (data.externalEtag !== undefined) updateData.externalEtag = data.externalEtag;
    if (data.syncStatus !== undefined) updateData.syncStatus = data.syncStatus;
    if (data.lastSyncedAt !== undefined) updateData.lastSyncedAt = data.lastSyncedAt;
    if (data.syncError !== undefined) updateData.syncError = data.syncError;
    
    await db.update(appointments)
      .set(updateData)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.organisationId, organisationId)
      ));
  }
  
  async updateIntegrationSyncStatus(organisationId: string, id: string, data: { 
    lastSyncAt?: Date; 
    syncErrorCount?: number; 
    lastSyncError?: string | null;
  }): Promise<void> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.lastSyncAt !== undefined) updateData.lastSyncAt = data.lastSyncAt;
    if (data.syncErrorCount !== undefined) updateData.syncErrorCount = data.syncErrorCount;
    if (data.lastSyncError !== undefined) updateData.lastSyncError = data.lastSyncError;
    
    await db.update(calendarIntegrations)
      .set(updateData)
      .where(and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.organisationId, organisationId)
      ));
  }
  
  // ========== V2: GOOGLE CALENDAR IMPORT ==========
  
  async upsertGoogleCalendarEvent(organisationId: string, data: {
    integrationId: string;
    googleCalendarId: string;
    googleEventId: string;
    etag?: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
    summary?: string | null;
    description?: string | null;
    location?: string | null;
    startAt?: Date | null;
    endAt?: Date | null;
    allDay?: boolean;
    attendees?: string | null;
    htmlLink?: string | null;
    updatedAtGoogle?: Date | null;
  }): Promise<{ isNew: boolean; event: GoogleCalendarEvent }> {
    // Check if event already exists
    const existing = await db.select().from(googleCalendarEvents)
      .where(and(
        eq(googleCalendarEvents.organisationId, organisationId),
        eq(googleCalendarEvents.googleCalendarId, data.googleCalendarId),
        eq(googleCalendarEvents.googleEventId, data.googleEventId)
      ))
      .limit(1);
    
    const now = new Date();
    
    if (existing.length > 0) {
      // Update existing event
      const [updated] = await db.update(googleCalendarEvents)
        .set({
          etag: data.etag,
          status: data.status,
          summary: data.summary,
          description: data.description,
          location: data.location,
          startAt: data.startAt,
          endAt: data.endAt,
          allDay: data.allDay,
          attendees: data.attendees,
          htmlLink: data.htmlLink,
          updatedAtGoogle: data.updatedAtGoogle,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(googleCalendarEvents.id, existing[0].id))
        .returning();
      
      return { isNew: false, event: updated };
    } else {
      // Insert new event
      const [inserted] = await db.insert(googleCalendarEvents)
        .values({
          organisationId,
          integrationId: data.integrationId,
          googleCalendarId: data.googleCalendarId,
          googleEventId: data.googleEventId,
          etag: data.etag,
          status: data.status,
          summary: data.summary,
          description: data.description,
          location: data.location,
          startAt: data.startAt,
          endAt: data.endAt,
          allDay: data.allDay,
          attendees: data.attendees,
          htmlLink: data.htmlLink,
          updatedAtGoogle: data.updatedAtGoogle,
          lastSyncedAt: now,
        })
        .returning();
      
      return { isNew: true, event: inserted };
    }
  }
  
  async getGoogleCalendarEvents(organisationId: string, startDate: Date, endDate: Date): Promise<GoogleCalendarEvent[]> {
    return await db.select().from(googleCalendarEvents)
      .where(and(
        eq(googleCalendarEvents.organisationId, organisationId),
        gte(googleCalendarEvents.startAt, startDate),
        lte(googleCalendarEvents.startAt, endDate)
      ))
      .orderBy(googleCalendarEvents.startAt);
  }
  
  async getGoogleCalendarEventsCount(organisationId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(googleCalendarEvents)
      .where(eq(googleCalendarEvents.organisationId, organisationId));
    return Number(result[0]?.count || 0);
  }
  
  async getSyncConflicts(organisationId: string, status: 'open' | 'resolved' | 'ignored'): Promise<SyncConflict[]> {
    return await db.select().from(syncConflicts)
      .where(and(
        eq(syncConflicts.organisationId, organisationId),
        eq(syncConflicts.status, status)
      ))
      .orderBy(desc(syncConflicts.createdAt));
  }
  
  async resolveConflict(organisationId: string, id: string, status: 'resolved' | 'ignored', userId: string | null): Promise<void> {
    await db.update(syncConflicts)
      .set({
        status,
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(and(
        eq(syncConflicts.id, id),
        eq(syncConflicts.organisationId, organisationId)
      ));
  }

  // ========== EMAIL TOKENS ==========
  async createEmailToken(data: { userId?: string | null; email: string; type: 'PASSWORD_RESET' | 'EMAIL_VERIFY'; tokenHash: string; expiresAt: Date }): Promise<EmailToken> {
    const [token] = await db.insert(emailTokens)
      .values({
        userId: data.userId || null,
        email: data.email,
        type: data.type,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      })
      .returning();
    return token;
  }

  async getEmailTokenByHash(tokenHash: string): Promise<EmailToken | undefined> {
    const [token] = await db.select().from(emailTokens)
      .where(eq(emailTokens.tokenHash, tokenHash));
    return token || undefined;
  }

  async markEmailTokenUsed(id: string): Promise<void> {
    await db.update(emailTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailTokens.id, id));
  }

  async invalidateEmailTokens(email: string, type: 'PASSWORD_RESET' | 'EMAIL_VERIFY'): Promise<void> {
    await db.update(emailTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(emailTokens.email, email),
        eq(emailTokens.type, type),
        isNull(emailTokens.usedAt)
      ));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(eq(users.username, email));
    return user || undefined;
  }

  async updateUserEmailVerified(userId: string): Promise<void> {
    await db.update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // ========== INVITATIONS ==========
  async createInvitation(organisationId: string, data: { email: string; role: 'ADMIN' | 'CHIRURGIEN' | 'ASSISTANT'; tokenHash: string; expiresAt: Date; invitedByUserId: string; nom?: string | null; prenom?: string | null }): Promise<Invitation> {
    const [invitation] = await db.insert(invitations)
      .values({
        organisationId,
        email: data.email,
        role: data.role,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        invitedByUserId: data.invitedByUserId,
        nom: data.nom || null,
        prenom: data.prenom || null,
      })
      .returning();
    return invitation;
  }

  async getInvitationByToken(tokenHash: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations)
      .where(eq(invitations.tokenHash, tokenHash));
    return invitation || undefined;
  }

  async getInvitationsByOrganisation(organisationId: string): Promise<Invitation[]> {
    return await db.select().from(invitations)
      .where(eq(invitations.organisationId, organisationId))
      .orderBy(desc(invitations.createdAt));
  }

  async acceptInvitation(id: string): Promise<void> {
    await db.update(invitations)
      .set({
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      })
      .where(eq(invitations.id, id));
  }

  async cancelInvitation(organisationId: string, id: string): Promise<void> {
    await db.update(invitations)
      .set({ status: 'CANCELLED' })
      .where(and(
        eq(invitations.id, id),
        eq(invitations.organisationId, organisationId)
      ));
  }

  async getInvitationByEmail(organisationId: string, email: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations)
      .where(and(
        eq(invitations.organisationId, organisationId),
        eq(invitations.email, email),
        eq(invitations.status, 'PENDING')
      ));
    return invitation || undefined;
  }

  async getInvitationById(id: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations)
      .where(eq(invitations.id, id));
    return invitation || undefined;
  }

  async deleteInvitation(id: string): Promise<void> {
    await db.delete(invitations)
      .where(eq(invitations.id, id));
  }

  // ========== EMAIL OUTBOX ==========
  async logEmail(data: { organisationId?: string | null; toEmail: string; template: string; subject: string; payload?: string | null; status: 'PENDING' | 'SENT' | 'FAILED'; sentAt?: Date | null; errorMessage?: string | null }): Promise<EmailOutbox> {
    const [email] = await db.insert(emailOutbox)
      .values({
        organisationId: data.organisationId || null,
        toEmail: data.toEmail,
        template: data.template,
        subject: data.subject,
        payload: data.payload || null,
        status: data.status,
        sentAt: data.sentAt || null,
        errorMessage: data.errorMessage || null,
      })
      .returning();
    return email;
  }

  async updateEmailStatus(id: string, status: 'PENDING' | 'SENT' | 'FAILED', errorMessage?: string | null): Promise<void> {
    await db.update(emailOutbox)
      .set({
        status,
        sentAt: status === 'SENT' ? new Date() : undefined,
        errorMessage: errorMessage || null,
      })
      .where(eq(emailOutbox.id, id));
  }

  // ========== RADIO NOTES ==========
  async getRadioNotes(organisationId: string, radioId: string): Promise<RadioNoteWithAuthor[]> {
    const notes = await db.select({
      id: radioNotes.id,
      organisationId: radioNotes.organisationId,
      radioId: radioNotes.radioId,
      authorId: radioNotes.authorId,
      body: radioNotes.body,
      createdAt: radioNotes.createdAt,
      updatedAt: radioNotes.updatedAt,
      authorNom: users.nom,
      authorPrenom: users.prenom,
    })
      .from(radioNotes)
      .leftJoin(users, eq(radioNotes.authorId, users.id))
      .where(and(
        eq(radioNotes.organisationId, organisationId),
        eq(radioNotes.radioId, radioId)
      ))
      .orderBy(desc(radioNotes.createdAt));
    return notes;
  }

  async createRadioNote(organisationId: string, authorId: string, radioId: string, body: string): Promise<RadioNote> {
    const [note] = await db.insert(radioNotes)
      .values({
        organisationId,
        radioId,
        authorId,
        body,
      })
      .returning();
    return note;
  }

  async updateRadioNote(organisationId: string, id: string, body: string): Promise<RadioNote | undefined> {
    const [note] = await db.update(radioNotes)
      .set({ body, updatedAt: new Date() })
      .where(and(
        eq(radioNotes.id, id),
        eq(radioNotes.organisationId, organisationId)
      ))
      .returning();
    return note || undefined;
  }

  async deleteRadioNote(organisationId: string, id: string): Promise<boolean> {
    const result = await db.delete(radioNotes)
      .where(and(
        eq(radioNotes.id, id),
        eq(radioNotes.organisationId, organisationId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== IMPLANT STATUS REASONS ==========
  async getStatusReasons(organisationId: string, status?: 'SUCCES' | 'COMPLICATION' | 'ECHEC'): Promise<ImplantStatusReason[]> {
    const conditions = [
      or(
        isNull(implantStatusReasons.organisationId), // System reasons
        eq(implantStatusReasons.organisationId, organisationId) // Org-specific
      ),
      eq(implantStatusReasons.isActive, true),
    ];
    if (status) {
      conditions.push(eq(implantStatusReasons.status, status));
    }
    return db.select().from(implantStatusReasons)
      .where(and(...conditions))
      .orderBy(desc(implantStatusReasons.isSystem), implantStatusReasons.label);
  }

  async createStatusReason(organisationId: string, data: { status: 'SUCCES' | 'COMPLICATION' | 'ECHEC'; code: string; label: string }): Promise<ImplantStatusReason> {
    const [reason] = await db.insert(implantStatusReasons)
      .values({
        organisationId,
        status: data.status,
        code: data.code,
        label: data.label,
        isSystem: false,
        isActive: true,
      })
      .returning();
    return reason;
  }

  async seedSystemStatusReasons(): Promise<void> {
    // Check if system reasons already exist
    const existingReasons = await db.select({ id: implantStatusReasons.id })
      .from(implantStatusReasons)
      .where(eq(implantStatusReasons.isSystem, true))
      .limit(1);
    
    if (existingReasons.length > 0) {
      return; // Already seeded
    }

    // Seed all system reasons
    const allReasons: { status: 'SUCCES' | 'COMPLICATION' | 'ECHEC'; code: string; label: string }[] = [];
    
    for (const reason of SYSTEM_STATUS_REASONS.SUCCES) {
      allReasons.push({ status: 'SUCCES', code: reason.code, label: reason.label });
    }
    for (const reason of SYSTEM_STATUS_REASONS.COMPLICATION) {
      allReasons.push({ status: 'COMPLICATION', code: reason.code, label: reason.label });
    }
    for (const reason of SYSTEM_STATUS_REASONS.ECHEC) {
      allReasons.push({ status: 'ECHEC', code: reason.code, label: reason.label });
    }

    await db.insert(implantStatusReasons)
      .values(allReasons.map(r => ({
        organisationId: null,
        status: r.status,
        code: r.code,
        label: r.label,
        isSystem: true,
        isActive: true,
      })));
  }

  // ========== IMPLANT STATUS HISTORY ==========
  async getImplantStatusHistory(organisationId: string, implantId: string): Promise<ImplantStatusHistoryWithDetails[]> {
    const history = await db.select({
      id: implantStatusHistory.id,
      organisationId: implantStatusHistory.organisationId,
      implantId: implantStatusHistory.implantId,
      fromStatus: implantStatusHistory.fromStatus,
      toStatus: implantStatusHistory.toStatus,
      reasonId: implantStatusHistory.reasonId,
      reasonFreeText: implantStatusHistory.reasonFreeText,
      evidence: implantStatusHistory.evidence,
      changedByUserId: implantStatusHistory.changedByUserId,
      changedAt: implantStatusHistory.changedAt,
      reasonLabel: implantStatusReasons.label,
      reasonCode: implantStatusReasons.code,
      changedByNom: users.nom,
      changedByPrenom: users.prenom,
    })
      .from(implantStatusHistory)
      .leftJoin(implantStatusReasons, eq(implantStatusHistory.reasonId, implantStatusReasons.id))
      .leftJoin(users, eq(implantStatusHistory.changedByUserId, users.id))
      .where(and(
        eq(implantStatusHistory.organisationId, organisationId),
        eq(implantStatusHistory.implantId, implantId)
      ))
      .orderBy(desc(implantStatusHistory.changedAt));
    return history;
  }

  async changeImplantStatus(organisationId: string, data: { 
    implantId: string; 
    fromStatus?: 'EN_SUIVI' | 'SUCCES' | 'COMPLICATION' | 'ECHEC' | null; 
    toStatus: 'EN_SUIVI' | 'SUCCES' | 'COMPLICATION' | 'ECHEC'; 
    reasonId?: string | null; 
    reasonFreeText?: string | null; 
    evidence?: string | null; 
    changedByUserId: string 
  }): Promise<ImplantStatusHistory> {
    // Update the surgery implant status
    await db.update(surgeryImplants)
      .set({ statut: data.toStatus })
      .where(and(
        eq(surgeryImplants.id, data.implantId),
        eq(surgeryImplants.organisationId, organisationId)
      ));

    // Record in history
    const [historyEntry] = await db.insert(implantStatusHistory)
      .values({
        organisationId,
        implantId: data.implantId,
        fromStatus: data.fromStatus || null,
        toStatus: data.toStatus,
        reasonId: data.reasonId || null,
        reasonFreeText: data.reasonFreeText || null,
        evidence: data.evidence || null,
        changedByUserId: data.changedByUserId,
      })
      .returning();
    return historyEntry;
  }

  // ========== IMPLANT MEASUREMENTS ==========
  async upsertImplantMeasurement(organisationId: string, data: {
    surgeryImplantId: string;
    appointmentId: string;
    type: 'POSE' | 'FOLLOW_UP' | 'CONTROL' | 'EMERGENCY';
    isqValue: number | null;
    notes?: string | null;
    measuredByUserId: string;
    measuredAt: Date;
  }): Promise<ImplantMeasurement> {
    // Check if measurement already exists for this appointment + implant
    const existing = await db.select()
      .from(implantMeasurements)
      .where(and(
        eq(implantMeasurements.organisationId, organisationId),
        eq(implantMeasurements.appointmentId, data.appointmentId),
        eq(implantMeasurements.surgeryImplantId, data.surgeryImplantId)
      ))
      .limit(1);

    // Determine ISQ stability
    let isqStability: string | null = null;
    if (data.isqValue !== null) {
      if (data.isqValue < 60) isqStability = 'low';
      else if (data.isqValue < 70) isqStability = 'moderate';
      else isqStability = 'high';
    }

    if (existing.length > 0) {
      // Update existing measurement
      const [updated] = await db.update(implantMeasurements)
        .set({
          isqValue: data.isqValue,
          isqStability,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(implantMeasurements.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // Create new measurement
      const [created] = await db.insert(implantMeasurements)
        .values({
          organisationId,
          surgeryImplantId: data.surgeryImplantId,
          appointmentId: data.appointmentId,
          type: data.type,
          isqValue: data.isqValue,
          isqStability,
          notes: data.notes || null,
          measuredAt: data.measuredAt,
          measuredByUserId: data.measuredByUserId,
        })
        .returning();
      return created;
    }
  }

  async getImplantMeasurements(organisationId: string, surgeryImplantId: string): Promise<ImplantMeasurement[]> {
    return db.select()
      .from(implantMeasurements)
      .where(and(
        eq(implantMeasurements.organisationId, organisationId),
        eq(implantMeasurements.surgeryImplantId, surgeryImplantId)
      ))
      .orderBy(desc(implantMeasurements.measuredAt));
  }

  async getAppointmentMeasurement(organisationId: string, appointmentId: string): Promise<ImplantMeasurement | undefined> {
    const [measurement] = await db.select()
      .from(implantMeasurements)
      .where(and(
        eq(implantMeasurements.organisationId, organisationId),
        eq(implantMeasurements.appointmentId, appointmentId)
      ))
      .limit(1);
    return measurement || undefined;
  }

  async getAppointmentClinicalData(organisationId: string, appointmentId: string): Promise<AppointmentClinicalData | undefined> {
    // Get the appointment
    const [appointment] = await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.organisationId, organisationId)
      ))
      .limit(1);

    if (!appointment) return undefined;

    let implant: SurgeryImplantWithDetails | null = null;
    let lastMeasurement: ImplantMeasurement | null = null;
    let measurementHistory: ImplantMeasurement[] = [];
    let statusHistory: ImplantStatusHistoryWithDetails[] = [];
    let clinicalFlags: ClinicalFlag[] = [];
    let suggestions: StatusSuggestion[] = [];
    let linkedRadios: Radio[] = [];

    // Get the linked implant if any
    if (appointment.surgeryImplantId) {
      const implantData = await this.getSurgeryImplantWithDetails(organisationId, appointment.surgeryImplantId);
      if (implantData) {
        implant = {
          ...implantData,
          implant: implantData.implant,
        };
      }

      // Get measurement history for this implant
      measurementHistory = await this.getImplantMeasurements(organisationId, appointment.surgeryImplantId);
      lastMeasurement = measurementHistory.length > 0 ? measurementHistory[0] : null;

      // Calculate flags for this implant
      clinicalFlags = await this.calculateIsqFlags(organisationId, appointment.surgeryImplantId);

      // Generate suggestions based on flags
      suggestions = await this.generateStatusSuggestions(organisationId, appointment.surgeryImplantId, clinicalFlags);

      // Get status history for this implant
      statusHistory = await this.getImplantStatusHistory(organisationId, appointment.surgeryImplantId);
    }

    // Get linked radios (via operationId or appointmentId)
    if (appointment.operationId) {
      linkedRadios = await db.select()
        .from(radios)
        .where(and(
          eq(radios.organisationId, organisationId),
          eq(radios.operationId, appointment.operationId)
        ))
        .orderBy(desc(radios.createdAt));
    }

    return {
      appointment: {
        id: appointment.id,
        type: appointment.type,
        status: appointment.status,
        title: appointment.title,
        dateStart: appointment.dateStart,
        patientId: appointment.patientId,
        surgeryImplantId: appointment.surgeryImplantId,
        operationId: appointment.operationId,
      },
      implant,
      lastMeasurement,
      measurementHistory,
      statusHistory,
      flags: clinicalFlags,
      suggestions,
      linkedRadios,
    };
  }

  async calculateIsqFlags(organisationId: string, surgeryImplantId: string): Promise<ClinicalFlag[]> {
    const flags: ClinicalFlag[] = [];
    const now = new Date();

    // Get all measurements for this implant
    const measurements = await this.getImplantMeasurements(organisationId, surgeryImplantId);

    if (measurements.length === 0) {
      // No measurements yet
      return flags;
    }

    const latestMeasurement = measurements[0];
    const latestIsq = latestMeasurement.isqValue;

    // ISQ_LOW: Latest ISQ < 60
    if (latestIsq !== null && latestIsq < 60) {
      const isCritical = latestIsq < 50;
      flags.push({
        id: `flag_isq_low_${surgeryImplantId}`,
        type: 'ISQ_LOW',
        level: isCritical ? 'CRITICAL' : 'WARNING',
        label: isCritical ? 'ISQ critique' : 'ISQ faible',
        value: latestIsq,
        createdAt: now,
        recommendedActions: [
          { type: 'add_or_link_radio', label: 'Lier une radio', priority: 'PRIMARY' },
          { type: 'plan_control_14d', label: 'Planifier controle (14j)', priority: 'PRIMARY' },
          { type: 'open_status_modal', label: 'Changer le statut', priority: 'SECONDARY' },
        ],
      });
    }

    // ISQ_DECLINING: ISQ dropped by 10+ points from previous
    if (measurements.length >= 2 && latestIsq !== null) {
      const previousMeasurement = measurements[1];
      const previousIsq = previousMeasurement.isqValue;
      if (previousIsq !== null) {
        const delta = latestIsq - previousIsq;
        if (delta <= -10) {
          const isCritical = delta <= -15;
          flags.push({
            id: `flag_isq_declining_${surgeryImplantId}`,
            type: 'ISQ_DECLINING',
            level: isCritical ? 'CRITICAL' : 'WARNING',
            label: 'ISQ en déclin',
            value: latestIsq,
            delta: delta,
            createdAt: now,
            recommendedActions: [
              { type: 'add_or_link_radio', label: 'Lier une radio', priority: 'PRIMARY' },
              { type: 'plan_control_14d', label: 'Planifier controle (14j)', priority: 'PRIMARY' },
              { type: 'review_isq_history', label: 'Voir historique ISQ', priority: 'SECONDARY' },
            ],
          });
        }
      }
    }

    // UNSTABLE_ISQ_HISTORY: 3+ consecutive low ISQs (most recent consecutive run)
    let consecutiveLowCount = 0;
    // Walk from most recent to oldest, count consecutive lows
    for (const m of measurements) {
      if (m.isqValue !== null && m.isqValue < 60) {
        consecutiveLowCount++;
      } else {
        break; // Stop at first non-low reading
      }
    }
    if (consecutiveLowCount >= 3) {
      flags.push({
        id: `flag_unstable_${surgeryImplantId}`,
        type: 'UNSTABLE_ISQ_HISTORY',
        level: 'WARNING',
        label: 'Historique ISQ instable',
        createdAt: now,
        recommendedActions: [
          { type: 'open_status_modal', label: 'Evaluer statut', priority: 'PRIMARY' },
          { type: 'add_or_link_radio', label: 'Lier une radio', priority: 'SECONDARY' },
        ],
      });
    }

    // NO_RECENT_ISQ: No measurement in last 3 months (for implants older than 2 months)
    const lastMeasurementDate = new Date(latestMeasurement.measuredAt);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (lastMeasurementDate < threeMonthsAgo) {
      flags.push({
        id: `flag_no_recent_${surgeryImplantId}`,
        type: 'NO_RECENT_ISQ',
        level: 'INFO',
        label: 'Pas de mesure ISQ récente',
        createdAt: now,
        recommendedActions: [
          { type: 'plan_control_14d', label: 'Planifier un controle', priority: 'PRIMARY' },
          { type: 'schedule_followup', label: 'Planifier suivi', priority: 'SECONDARY' },
        ],
      });
    }

    return flags;
  }

  async generateStatusSuggestions(organisationId: string, surgeryImplantId: string, flags: ClinicalFlag[]): Promise<StatusSuggestion[]> {
    const suggestions: StatusSuggestion[] = [];

    // Get the implant's current status
    const implant = await this.getSurgeryImplant(organisationId, surgeryImplantId);
    if (!implant || implant.statut !== 'EN_SUIVI') {
      // Only generate suggestions for implants in EN_SUIVI status
      return suggestions;
    }

    // Find the latest measurement for evidence
    const measurements = await this.getImplantMeasurements(organisationId, surgeryImplantId);
    const latestMeasurement = measurements.length > 0 ? measurements[0] : null;

    // ISQ_LOW or DECLINING suggests COMPLICATION
    const lowFlag = flags.find(f => f.type === 'ISQ_LOW');
    const decliningFlag = flags.find(f => f.type === 'ISQ_DECLINING');

    if (lowFlag && lowFlag.level === 'CRITICAL') {
      suggestions.push({
        id: `suggestion_complication_critical_${surgeryImplantId}`,
        suggestedStatus: 'COMPLICATION',
        reasonCode: 'ISQ_CRITICAL',
        reasonLabel: 'ISQ critique (< 50)',
        evidence: {
          measurementId: latestMeasurement?.id,
          isqValue: lowFlag.value,
        },
        priority: 'HIGH',
        recommendedActions: [
          { type: 'open_status_modal', label: 'Appliquer ce statut', priority: 'PRIMARY' },
          { type: 'add_or_link_radio', label: 'Lier une radio', priority: 'SECONDARY' },
        ],
      });
    } else if (lowFlag) {
      suggestions.push({
        id: `suggestion_complication_low_${surgeryImplantId}`,
        suggestedStatus: 'COMPLICATION',
        reasonCode: 'ISQ_LOW',
        reasonLabel: 'ISQ faible (< 60)',
        evidence: {
          measurementId: latestMeasurement?.id,
          isqValue: lowFlag.value,
        },
        priority: 'MEDIUM',
        recommendedActions: [
          { type: 'open_status_modal', label: 'Appliquer ce statut', priority: 'PRIMARY' },
          { type: 'add_or_link_radio', label: 'Lier une radio', priority: 'SECONDARY' },
        ],
      });
    }

    if (decliningFlag && decliningFlag.level === 'CRITICAL') {
      suggestions.push({
        id: `suggestion_complication_declining_${surgeryImplantId}`,
        suggestedStatus: 'COMPLICATION',
        reasonCode: 'ISQ_DECLINING',
        reasonLabel: 'Chute ISQ importante',
        evidence: {
          measurementId: latestMeasurement?.id,
          isqValue: decliningFlag.value,
          isqDelta: decliningFlag.delta,
        },
        priority: 'HIGH',
        recommendedActions: [
          { type: 'open_status_modal', label: 'Appliquer ce statut', priority: 'PRIMARY' },
          { type: 'add_or_link_radio', label: 'Lier une radio', priority: 'SECONDARY' },
          { type: 'review_isq_history', label: 'Voir historique', priority: 'SECONDARY' },
        ],
      });
    }

    // If no issues and good ISQ history, suggest SUCCES
    const hasIssues = flags.some(f => f.type === 'ISQ_LOW' || f.type === 'ISQ_DECLINING' || f.type === 'UNSTABLE_ISQ_HISTORY');
    if (!hasIssues && measurements.length >= 3) {
      const allGood = measurements.slice(0, 3).every(m => m.isqValue !== null && m.isqValue >= 70);
      if (allGood && latestMeasurement) {
        suggestions.push({
          id: `suggestion_success_${surgeryImplantId}`,
          suggestedStatus: 'SUCCES',
          reasonCode: 'STABLE_HIGH_ISQ',
          reasonLabel: 'ISQ stable et eleve (3+ mesures > 70)',
          evidence: {
            measurementId: latestMeasurement.id,
            isqValue: latestMeasurement.isqValue ?? undefined,
          },
          priority: 'LOW',
          recommendedActions: [
            { type: 'open_status_modal', label: 'Valider le succes', priority: 'PRIMARY' },
          ],
        });
      }
    }

    return suggestions;
  }

  // ========== APPOINTMENT RADIOS ==========
  async getAppointmentRadios(organisationId: string, appointmentId: string): Promise<AppointmentRadio[]> {
    return db.select().from(appointmentRadios)
      .where(and(
        eq(appointmentRadios.organisationId, organisationId),
        eq(appointmentRadios.appointmentId, appointmentId)
      ))
      .orderBy(desc(appointmentRadios.createdAt));
  }

  async linkRadioToAppointment(
    organisationId: string, 
    appointmentId: string, 
    radioId: string, 
    linkedBy: string, 
    notes?: string
  ): Promise<AppointmentRadio> {
    const [link] = await db.insert(appointmentRadios)
      .values({
        organisationId,
        appointmentId,
        radioId,
        linkedBy,
        notes: notes || null,
      })
      .returning();
    return link;
  }

  async unlinkRadioFromAppointment(organisationId: string, appointmentId: string, radioId: string): Promise<boolean> {
    const result = await db.delete(appointmentRadios)
      .where(and(
        eq(appointmentRadios.organisationId, organisationId),
        eq(appointmentRadios.appointmentId, appointmentId),
        eq(appointmentRadios.radioId, radioId)
      ));
    return (result.rowCount ?? 0) > 0;
  }
}

// Helper function to compute latest ISQ from surgery implant fields
export function computeLatestIsq(surgeryImplant: SurgeryImplant): LatestIsq | undefined {
  // Check in order: 6m > 3m > 2m > pose
  if (surgeryImplant.isq6m !== null && surgeryImplant.isq6m !== undefined) {
    return { value: surgeryImplant.isq6m, label: "6m" };
  }
  if (surgeryImplant.isq3m !== null && surgeryImplant.isq3m !== undefined) {
    return { value: surgeryImplant.isq3m, label: "3m" };
  }
  if (surgeryImplant.isq2m !== null && surgeryImplant.isq2m !== undefined) {
    return { value: surgeryImplant.isq2m, label: "2m" };
  }
  if (surgeryImplant.isqPose !== null && surgeryImplant.isqPose !== undefined) {
    return { value: surgeryImplant.isqPose, label: "pose" };
  }
  return undefined;
}

export const storage = new DatabaseStorage();
