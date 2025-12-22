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
} from "@shared/schema";
import type {
  PatientDetail,
  ImplantDetail,
  ImplantWithPatient,
  SurgeryImplantWithDetails,
  DashboardStats,
  AdvancedStats,
  ImplantFilters,
  CreateUserInput,
} from "@shared/types";
import { db } from "./db";
import { eq, desc, ilike, or, and, lte, inArray } from "drizzle-orm";

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
  searchPatients(organisationId: string, query: string): Promise<Patient[]>;
  getPatientImplantCounts(organisationId: string): Promise<Record<string, number>>;
  getPatientsWithSummary(organisationId: string): Promise<PatientSummary>;

  // Operation methods
  getOperation(organisationId: string, id: string): Promise<Operation | undefined>;
  getAllOperations(organisationId: string): Promise<(Operation & { patientNom: string; patientPrenom: string; implantCount: number })[]>;
  createOperation(organisationId: string, operation: InsertOperation): Promise<Operation>;
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
  createRendezVous(organisationId: string, rdv: InsertRendezVous): Promise<RendezVous>;
  updateRendezVous(organisationId: string, id: string, rdv: Partial<InsertRendezVous>): Promise<RendezVous | undefined>;
  deleteRendezVous(organisationId: string, id: string): Promise<boolean>;

  // Document methods
  getDocument(organisationId: string, id: string): Promise<Document | undefined>;
  getPatientDocuments(organisationId: string, patientId: string): Promise<Document[]>;
  createDocument(organisationId: string, doc: InsertDocument & { createdBy?: string | null }): Promise<Document>;
  updateDocument(organisationId: string, id: string, updates: { title?: string; tags?: string[] }): Promise<Document | undefined>;
  deleteDocument(organisationId: string, id: string): Promise<boolean>;
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

  // ========== OPERATIONS ==========
  async getOperation(organisationId: string, id: string): Promise<Operation | undefined> {
    const [operation] = await db.select().from(operations)
      .where(and(
        eq(operations.id, id),
        eq(operations.organisationId, organisationId)
      ));
    return operation || undefined;
  }

  async getAllOperations(organisationId: string): Promise<(Operation & { patientNom: string; patientPrenom: string; implantCount: number })[]> {
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
    
    // Get implant counts per operation
    const implantCounts = await db
      .select({
        surgeryId: surgeryImplants.surgeryId,
      })
      .from(surgeryImplants)
      .where(eq(surgeryImplants.organisationId, organisationId));
    
    const countMap: Record<string, number> = {};
    for (const row of implantCounts) {
      countMap[row.surgeryId] = (countMap[row.surgeryId] || 0) + 1;
    }
    
    return operationsWithPatients.map(({ operation, patientNom, patientPrenom }) => ({
      ...operation,
      patientNom,
      patientPrenom,
      implantCount: countMap[operation.id] || 0,
    }));
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
}

export const storage = new DatabaseStorage();
