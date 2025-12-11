import {
  patients,
  operations,
  implants,
  radios,
  visites,
  users,
  type Patient,
  type InsertPatient,
  type Operation,
  type InsertOperation,
  type Implant,
  type InsertImplant,
  type Radio,
  type InsertRadio,
  type Visite,
  type InsertVisite,
  type User,
} from "@shared/schema";
import type {
  PatientDetail,
  ImplantDetail,
  ImplantWithPatient,
  DashboardStats,
  AdvancedStats,
  ImplantFilters,
  CreateUserInput,
} from "@shared/types";
import { db } from "./db";
import { eq, desc, ilike, or, and } from "drizzle-orm";

export interface IStorage {
  // Patient methods - all require organisationId for multi-tenant isolation
  getPatients(organisationId: string): Promise<Patient[]>;
  getPatient(organisationId: string, id: string): Promise<Patient | undefined>;
  getPatientWithDetails(organisationId: string, id: string): Promise<PatientDetail | undefined>;
  createPatient(organisationId: string, patient: InsertPatient): Promise<Patient>;
  searchPatients(organisationId: string, query: string): Promise<Patient[]>;

  // Operation methods
  getOperation(organisationId: string, id: string): Promise<Operation | undefined>;
  createOperation(organisationId: string, operation: InsertOperation): Promise<Operation>;

  // Implant methods
  getImplant(organisationId: string, id: string): Promise<Implant | undefined>;
  getImplantWithDetails(organisationId: string, id: string): Promise<ImplantDetail | undefined>;
  getPatientImplants(organisationId: string, patientId: string): Promise<Implant[]>;
  createImplant(organisationId: string, implant: InsertImplant): Promise<Implant>;
  getAllImplants(organisationId: string): Promise<Implant[]>;
  filterImplants(organisationId: string, filters: ImplantFilters): Promise<ImplantWithPatient[]>;
  getImplantBrands(organisationId: string): Promise<string[]>;

  // Radio methods
  getRadio(organisationId: string, id: string): Promise<Radio | undefined>;
  createRadio(organisationId: string, radio: InsertRadio): Promise<Radio>;

  // Visite methods
  getVisite(organisationId: string, id: string): Promise<Visite | undefined>;
  getImplantVisites(organisationId: string, implantId: string): Promise<Visite[]>;
  createVisite(organisationId: string, visite: InsertVisite): Promise<Visite>;

  // Stats methods
  getStats(organisationId: string): Promise<DashboardStats>;
  getAdvancedStats(organisationId: string): Promise<AdvancedStats>;

  // User methods (not tenant-filtered, users are global)
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: CreateUserInput): Promise<User>;
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
    const patient = await this.getPatient(organisationId, id);
    if (!patient) return undefined;

    const patientOperations = await db
      .select()
      .from(operations)
      .where(and(
        eq(operations.patientId, id),
        eq(operations.organisationId, organisationId)
      ))
      .orderBy(desc(operations.dateOperation));

    const operationsWithImplants = await Promise.all(
      patientOperations.map(async (op) => {
        const opImplants = await db
          .select()
          .from(implants)
          .where(and(
            eq(implants.operationId, op.id),
            eq(implants.organisationId, organisationId)
          ));
        return { ...op, implants: opImplants };
      })
    );

    const patientImplants = await db
      .select()
      .from(implants)
      .where(and(
        eq(implants.patientId, id),
        eq(implants.organisationId, organisationId)
      ))
      .orderBy(desc(implants.datePose));

    const implantsWithVisites = await Promise.all(
      patientImplants.map(async (imp) => {
        const impVisites = await db
          .select()
          .from(visites)
          .where(and(
            eq(visites.implantId, imp.id),
            eq(visites.organisationId, organisationId)
          ))
          .orderBy(desc(visites.date));
        return { ...imp, visites: impVisites };
      })
    );

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
      operations: operationsWithImplants,
      implants: implantsWithVisites,
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

  // ========== OPERATIONS ==========
  async getOperation(organisationId: string, id: string): Promise<Operation | undefined> {
    const [operation] = await db.select().from(operations)
      .where(and(
        eq(operations.id, id),
        eq(operations.organisationId, organisationId)
      ));
    return operation || undefined;
  }

  async createOperation(organisationId: string, operation: InsertOperation): Promise<Operation> {
    const [newOperation] = await db.insert(operations).values({
      ...operation,
      organisationId,
    }).returning();
    return newOperation;
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

  async getImplantWithDetails(organisationId: string, id: string): Promise<ImplantDetail | undefined> {
    const implant = await this.getImplant(organisationId, id);
    if (!implant) return undefined;

    const implantVisites = await db
      .select()
      .from(visites)
      .where(and(
        eq(visites.implantId, id),
        eq(visites.organisationId, organisationId)
      ))
      .orderBy(desc(visites.date));

    const implantRadios = await db
      .select()
      .from(radios)
      .where(and(
        eq(radios.implantId, id),
        eq(radios.organisationId, organisationId)
      ))
      .orderBy(desc(radios.date));

    return {
      ...implant,
      visites: implantVisites,
      radios: implantRadios,
    } as ImplantDetail;
  }

  async getPatientImplants(organisationId: string, patientId: string): Promise<Implant[]> {
    return db
      .select()
      .from(implants)
      .where(and(
        eq(implants.patientId, patientId),
        eq(implants.organisationId, organisationId)
      ))
      .orderBy(desc(implants.datePose));
  }

  async createImplant(organisationId: string, implant: InsertImplant): Promise<Implant> {
    const [newImplant] = await db.insert(implants).values({
      ...implant,
      organisationId,
    }).returning();
    return newImplant;
  }

  async getAllImplants(organisationId: string): Promise<Implant[]> {
    return db.select().from(implants)
      .where(eq(implants.organisationId, organisationId))
      .orderBy(desc(implants.datePose));
  }

  async filterImplants(organisationId: string, filters: ImplantFilters): Promise<ImplantWithPatient[]> {
    const conditions = [eq(implants.organisationId, organisationId)];

    if (filters.marque) {
      conditions.push(ilike(implants.marque, `%${filters.marque}%`));
    }
    if (filters.siteFdi) {
      conditions.push(eq(implants.siteFdi, filters.siteFdi));
    }
    if (filters.typeOs) {
      conditions.push(eq(implants.typeOs, filters.typeOs as any));
    }
    if (filters.statut) {
      conditions.push(eq(implants.statut, filters.statut as any));
    }

    const results = await db
      .select()
      .from(implants)
      .where(and(...conditions))
      .orderBy(desc(implants.datePose));

    const implantsWithPatients = await Promise.all(
      results.map(async (implant) => {
        const patient = await this.getPatient(organisationId, implant.patientId);
        return { ...implant, patient };
      })
    );

    return implantsWithPatients;
  }

  async getImplantBrands(organisationId: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ marque: implants.marque })
      .from(implants)
      .where(eq(implants.organisationId, organisationId))
      .orderBy(implants.marque);
    return results.map((r) => r.marque);
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

  async createRadio(organisationId: string, radio: InsertRadio): Promise<Radio> {
    const [newRadio] = await db.insert(radios).values({
      ...radio,
      organisationId,
    }).returning();
    return newRadio;
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

  // ========== STATS ==========
  async getStats(organisationId: string): Promise<DashboardStats> {
    const allPatients = await db.select().from(patients)
      .where(eq(patients.organisationId, organisationId));
    const allOperations = await db.select().from(operations)
      .where(eq(operations.organisationId, organisationId))
      .orderBy(desc(operations.dateOperation));
    const allImplants = await db.select().from(implants)
      .where(eq(implants.organisationId, organisationId));
    const allRadios = await db.select().from(radios)
      .where(eq(radios.organisationId, organisationId));

    const implantsByStatus: Record<string, number> = {};
    allImplants.forEach((implant) => {
      const status = implant.statut || "EN_SUIVI";
      implantsByStatus[status] = (implantsByStatus[status] || 0) + 1;
    });

    return {
      totalPatients: allPatients.length,
      totalOperations: allOperations.length,
      totalImplants: allImplants.length,
      totalRadios: allRadios.length,
      implantsByStatus,
      recentOperations: allOperations.slice(0, 10),
    };
  }

  async getAdvancedStats(organisationId: string): Promise<AdvancedStats> {
    const allImplants = await db.select().from(implants)
      .where(eq(implants.organisationId, organisationId));
    const total = allImplants.length;

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

    allImplants.forEach((imp) => {
      const status = imp.statut || "EN_SUIVI";
      statusCounts[status as keyof typeof statusCounts]++;

      brandCounts[imp.marque] = (brandCounts[imp.marque] || 0) + 1;
      siteCounts[imp.siteFdi] = (siteCounts[imp.siteFdi] || 0) + 1;

      if (imp.isqPose) { isqPoseSum += imp.isqPose; isqPoseCount++; }
      if (imp.isq3m) { isq3mSum += imp.isq3m; isq3mCount++; }
      if (imp.isq6m) { isq6mSum += imp.isq6m; isq6mCount++; }
    });

    const isqTrends: { month: string; avgIsq: number }[] = [];
    const monthlyIsq: Record<string, { sum: number; count: number }> = {};

    allImplants.forEach((imp) => {
      const month = imp.datePose.substring(0, 7);
      if (imp.isqPose) {
        if (!monthlyIsq[month]) monthlyIsq[month] = { sum: 0, count: 0 };
        monthlyIsq[month].sum += imp.isqPose;
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
}

export const storage = new DatabaseStorage();
