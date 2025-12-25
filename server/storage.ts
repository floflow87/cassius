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
} from "@shared/types";
import { db, pool } from "./db";
import { eq, desc, ilike, or, and, lte, inArray, sql, gte, lt, gt, like, ne, SQL } from "drizzle-orm";

export type PatientSummary = {
  patients: Patient[];
  implantCounts: Record<string, number>;
  lastVisits: Record<string, { date: string; titre: string | null }>;
};

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

  // Prothese methods
  createProthese(organisationId: string, prothese: InsertProthese): Promise<Prothese>;
  getImplantProtheses(organisationId: string, implantId: string): Promise<Prothese[]>;

  // Stats methods
  getStats(organisationId: string): Promise<DashboardStats>;
  getAdvancedStats(organisationId: string): Promise<AdvancedStats>;
  getClinicalStats(organisationId: string, dateFrom?: string, dateTo?: string): Promise<ClinicalStats>;

  // User methods (not tenant-filtered, users are global)
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: CreateUserInput): Promise<User>;

  // Organisation methods
  createOrganisation(data: InsertOrganisation): Promise<Organisation>;

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
  createDocument(organisationId: string, doc: InsertDocument & { createdBy?: string | null }): Promise<Document>;
  updateDocument(organisationId: string, id: string, updates: { title?: string; tags?: string[] }): Promise<Document | undefined>;
  deleteDocument(organisationId: string, id: string): Promise<boolean>;

  // SavedFilter methods
  getSavedFilters(organisationId: string, pageType: SavedFilterPageType): Promise<SavedFilter[]>;
  createSavedFilter(organisationId: string, filter: InsertSavedFilter): Promise<SavedFilter>;
  deleteSavedFilter(organisationId: string, id: string): Promise<boolean>;

  // Timeline methods
  getOperationTimeline(organisationId: string, operationId: string): Promise<OperationTimeline | null>;
  
  // Global search
  globalSearch(organisationId: string, query: string, limit?: number): Promise<GlobalSearchResults>;
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
        SELECT date FROM rendez_vous WHERE patient_id = p.id AND organisation_id = p.organisation_id 
        ORDER BY date DESC LIMIT 1
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
    const today = new Date().toISOString().split('T')[0];
    const allRendezVous = await db
      .select()
      .from(rendezVous)
      .where(and(
        eq(rendezVous.organisationId, organisationId),
        lte(rendezVous.date, today)
      ))
      .orderBy(desc(rendezVous.date));

    const lastVisitByPatient: Record<string, { date: string; titre: string | null }> = {};
    for (const rdv of allRendezVous) {
      if (!lastVisitByPatient[rdv.patientId]) {
        lastVisitByPatient[rdv.patientId] = {
          date: rdv.date,
          titre: rdv.titre,
        };
      }
    }
    return lastVisitByPatient;
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

  async getClinicalStats(organisationId: string, dateFrom?: string, dateTo?: string): Promise<ClinicalStats> {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    const fromDate = dateFrom || defaultFrom;
    const toDate = dateTo || defaultTo;

    const allOperations = await db.select().from(operations)
      .where(and(
        eq(operations.organisationId, organisationId),
        gte(operations.dateOperation, fromDate),
        lte(operations.dateOperation, toDate)
      ))
      .orderBy(operations.dateOperation);

    const allSurgeryImplants = await db.select().from(surgeryImplants)
      .where(and(
        eq(surgeryImplants.organisationId, organisationId),
        gte(surgeryImplants.datePose, fromDate),
        lte(surgeryImplants.datePose, toDate)
      ));

    const allVisites = await db.select().from(visites)
      .where(eq(visites.organisationId, organisationId));

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

    const actsByType: Record<string, number> = {};
    allOperations.forEach(op => {
      const type = op.typeIntervention || "AUTRE";
      actsByType[type] = (actsByType[type] || 0) + 1;
    });

    const statusCounts = { SUCCES: 0, COMPLICATION: 0, ECHEC: 0, EN_SUIVI: 0 };
    const isqValues: number[] = [];
    allSurgeryImplants.forEach(si => {
      const status = si.statut || "EN_SUIVI";
      statusCounts[status as keyof typeof statusCounts]++;
      if (si.isqPose) isqValues.push(si.isqPose);
    });

    const total = allSurgeryImplants.length;
    const successRate = total > 0 ? Math.round((statusCounts.SUCCES / total) * 100) : 0;
    const complicationRate = total > 0 ? Math.round((statusCounts.COMPLICATION / total) * 100) : 0;
    const failureRate = total > 0 ? Math.round((statusCounts.ECHEC / total) * 100) : 0;

    const isqDistribution = [
      { category: "Faible (<55)", count: isqValues.filter(v => v < 55).length },
      { category: "Modéré (55-70)", count: isqValues.filter(v => v >= 55 && v <= 70).length },
      { category: "Élevé (>70)", count: isqValues.filter(v => v > 70).length },
    ];

    const isqByMonth: Record<string, { sum: number; count: number }> = {};
    allSurgeryImplants.forEach(si => {
      const month = si.datePose.substring(0, 7);
      if (si.isqPose) {
        if (!isqByMonth[month]) isqByMonth[month] = { sum: 0, count: 0 };
        isqByMonth[month].sum += si.isqPose;
        isqByMonth[month].count++;
      }
    });

    const visitesPerImplant: Record<string, Date[]> = {};
    allVisites.forEach(v => {
      if (v.implantId) {
        if (!visitesPerImplant[v.implantId]) visitesPerImplant[v.implantId] = [];
        visitesPerImplant[v.implantId].push(new Date(v.date));
      }
    });

    let totalDelayDays = 0;
    let delayCount = 0;
    allSurgeryImplants.forEach(si => {
      const implantVisites = visitesPerImplant[si.implantId] || [];
      if (implantVisites.length > 0) {
        const poseDate = new Date(si.datePose);
        const firstVisit = implantVisites.sort((a, b) => a.getTime() - b.getTime())[0];
        const delay = Math.floor((firstVisit.getTime() - poseDate.getTime()) / (1000 * 60 * 60 * 24));
        if (delay >= 0) {
          totalDelayDays += delay;
          delayCount++;
        }
      }
    });

    const avgDelayToFirstVisit = delayCount > 0 ? Math.round(totalDelayDays / delayCount) : null;

    const patientsMap: Record<string, { nom: string; prenom: string }> = {};
    const patientsList = await db.select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
      .from(patients)
      .where(eq(patients.organisationId, organisationId));
    patientsList.forEach(p => { patientsMap[p.id] = { nom: p.nom, prenom: p.prenom }; });

    const operationsMap: Record<string, string> = {};
    allOperations.forEach(op => { operationsMap[op.id] = op.patientId; });

    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const implantsWithoutFollowup: ClinicalStats["implantsWithoutFollowup"] = [];
    
    const allOrgSurgeryImplants = await db.select().from(surgeryImplants)
      .where(eq(surgeryImplants.organisationId, organisationId));

    for (const si of allOrgSurgeryImplants) {
      const implantVisites = visitesPerImplant[si.implantId] || [];
      const lastVisit = implantVisites.length > 0 
        ? implantVisites.sort((a, b) => b.getTime() - a.getTime())[0] 
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
          });
        }
      }
    }

    return {
      activityByPeriod: Object.entries(activityByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, count]) => ({ period, count })),
      implantsByPeriod: Object.entries(implantsByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, count]) => ({ period, count })),
      totalImplantsInPeriod: allSurgeryImplants.length,
      actsByType: Object.entries(actsByType)
        .map(([type, count]) => ({ type, count })),
      successRate,
      complicationRate,
      failureRate,
      isqDistribution,
      isqEvolution: Object.entries(isqByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({ period, avgIsq: Math.round(data.sum / data.count) })),
      avgDelayToFirstVisit,
      implantsWithoutFollowup: implantsWithoutFollowup.slice(0, 20),
    };
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

  // ========== ORGANISATIONS ==========
  async createOrganisation(data: InsertOrganisation): Promise<Organisation> {
    const [org] = await db.insert(organisations).values({
      nom: data.nom,
    }).returning();
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

  async updateAppointment(organisationId: string, id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [updated] = await db.update(appointments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
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

  async createDocument(organisationId: string, doc: InsertDocument & { createdBy?: string | null }): Promise<Document> {
    const [created] = await db.insert(documents).values({
      ...doc,
      organisationId,
    }).returning();
    return created;
  }

  async updateDocument(organisationId: string, id: string, updates: { title?: string; tags?: string[] }): Promise<Document | undefined> {
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
}

export const storage = new DatabaseStorage();
