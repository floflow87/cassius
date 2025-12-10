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
import { db } from "./db";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";

export interface IStorage {
  getPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  getPatientWithDetails(id: string): Promise<any>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  searchPatients(query: string): Promise<Patient[]>;

  getOperation(id: string): Promise<Operation | undefined>;
  createOperation(operation: InsertOperation): Promise<Operation>;

  getImplant(id: string): Promise<Implant | undefined>;
  getImplantWithDetails(id: string): Promise<any>;
  getPatientImplants(patientId: string): Promise<Implant[]>;
  createImplant(implant: InsertImplant): Promise<Implant>;

  getRadio(id: string): Promise<Radio | undefined>;
  createRadio(radio: InsertRadio): Promise<Radio>;

  getVisite(id: string): Promise<Visite | undefined>;
  getImplantVisites(implantId: string): Promise<Visite[]>;
  createVisite(visite: InsertVisite): Promise<Visite>;

  getStats(): Promise<{
    totalPatients: number;
    totalOperations: number;
    totalImplants: number;
    totalRadios: number;
    implantsByStatus: Record<string, number>;
    recentOperations: Operation[];
  }>;

  getAllImplants(): Promise<Implant[]>;
  filterImplants(filters: {
    marque?: string;
    siteFdi?: string;
    typeOs?: string;
    statut?: string;
  }): Promise<(Implant & { patient?: Patient })[]>;
  getImplantBrands(): Promise<string[]>;
  getAdvancedStats(): Promise<{
    successRate: number;
    complicationRate: number;
    failureRate: number;
    avgIsqPose: number;
    avgIsq3m: number;
    avgIsq6m: number;
    implantsByBrand: Record<string, number>;
    implantsBySite: Record<string, number>;
    isqTrends: { month: string; avgIsq: number }[];
  }>;

  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; password: string; role?: string; nom?: string | null; prenom?: string | null }): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getPatients(): Promise<Patient[]> {
    return db.select().from(patients).orderBy(desc(patients.createdAt));
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient || undefined;
  }

  async getPatientWithDetails(id: string): Promise<any> {
    const patient = await this.getPatient(id);
    if (!patient) return undefined;

    const patientOperations = await db
      .select()
      .from(operations)
      .where(eq(operations.patientId, id))
      .orderBy(desc(operations.dateOperation));

    const operationsWithImplants = await Promise.all(
      patientOperations.map(async (op) => {
        const opImplants = await db
          .select()
          .from(implants)
          .where(eq(implants.operationId, op.id));
        return { ...op, implants: opImplants };
      })
    );

    const patientImplants = await db
      .select()
      .from(implants)
      .where(eq(implants.patientId, id))
      .orderBy(desc(implants.datePose));

    const implantsWithVisites = await Promise.all(
      patientImplants.map(async (imp) => {
        const impVisites = await db
          .select()
          .from(visites)
          .where(eq(visites.implantId, imp.id))
          .orderBy(desc(visites.date));
        return { ...imp, visites: impVisites };
      })
    );

    const patientRadios = await db
      .select()
      .from(radios)
      .where(eq(radios.patientId, id))
      .orderBy(desc(radios.date));

    return {
      ...patient,
      operations: operationsWithImplants,
      implants: implantsWithVisites,
      radios: patientRadios,
    };
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [newPatient] = await db.insert(patients).values(patient).returning();
    return newPatient;
  }

  async searchPatients(query: string): Promise<Patient[]> {
    const searchTerm = `%${query}%`;
    return db
      .select()
      .from(patients)
      .where(
        or(
          ilike(patients.nom, searchTerm),
          ilike(patients.prenom, searchTerm),
          ilike(patients.email, searchTerm)
        )
      )
      .orderBy(desc(patients.createdAt));
  }

  async getOperation(id: string): Promise<Operation | undefined> {
    const [operation] = await db.select().from(operations).where(eq(operations.id, id));
    return operation || undefined;
  }

  async createOperation(operation: InsertOperation): Promise<Operation> {
    const [newOperation] = await db.insert(operations).values(operation).returning();
    return newOperation;
  }

  async getImplant(id: string): Promise<Implant | undefined> {
    const [implant] = await db.select().from(implants).where(eq(implants.id, id));
    return implant || undefined;
  }

  async getImplantWithDetails(id: string): Promise<any> {
    const implant = await this.getImplant(id);
    if (!implant) return undefined;

    const implantVisites = await db
      .select()
      .from(visites)
      .where(eq(visites.implantId, id))
      .orderBy(desc(visites.date));

    const implantRadios = await db
      .select()
      .from(radios)
      .where(eq(radios.implantId, id))
      .orderBy(desc(radios.date));

    return {
      ...implant,
      visites: implantVisites,
      radios: implantRadios,
    };
  }

  async getPatientImplants(patientId: string): Promise<Implant[]> {
    return db
      .select()
      .from(implants)
      .where(eq(implants.patientId, patientId))
      .orderBy(desc(implants.datePose));
  }

  async createImplant(implant: InsertImplant): Promise<Implant> {
    const [newImplant] = await db.insert(implants).values(implant).returning();
    return newImplant;
  }

  async getRadio(id: string): Promise<Radio | undefined> {
    const [radio] = await db.select().from(radios).where(eq(radios.id, id));
    return radio || undefined;
  }

  async createRadio(radio: InsertRadio): Promise<Radio> {
    const [newRadio] = await db.insert(radios).values(radio).returning();
    return newRadio;
  }

  async getVisite(id: string): Promise<Visite | undefined> {
    const [visite] = await db.select().from(visites).where(eq(visites.id, id));
    return visite || undefined;
  }

  async getImplantVisites(implantId: string): Promise<Visite[]> {
    return db
      .select()
      .from(visites)
      .where(eq(visites.implantId, implantId))
      .orderBy(desc(visites.date));
  }

  async createVisite(visite: InsertVisite): Promise<Visite> {
    const [newVisite] = await db.insert(visites).values(visite).returning();
    return newVisite;
  }

  async getStats(): Promise<{
    totalPatients: number;
    totalOperations: number;
    totalImplants: number;
    totalRadios: number;
    implantsByStatus: Record<string, number>;
    recentOperations: Operation[];
  }> {
    const allPatients = await db.select().from(patients);
    const allOperations = await db.select().from(operations).orderBy(desc(operations.dateOperation));
    const allImplants = await db.select().from(implants);
    const allRadios = await db.select().from(radios);

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

  async getAllImplants(): Promise<Implant[]> {
    return db.select().from(implants).orderBy(desc(implants.datePose));
  }

  async filterImplants(filters: {
    marque?: string;
    siteFdi?: string;
    typeOs?: string;
    statut?: string;
  }): Promise<(Implant & { patient?: Patient })[]> {
    const conditions = [];

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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(implants.datePose));

    const implantsWithPatients = await Promise.all(
      results.map(async (implant) => {
        const patient = await this.getPatient(implant.patientId);
        return { ...implant, patient };
      })
    );

    return implantsWithPatients;
  }

  async getImplantBrands(): Promise<string[]> {
    const results = await db
      .selectDistinct({ marque: implants.marque })
      .from(implants)
      .orderBy(implants.marque);
    return results.map((r) => r.marque);
  }

  async getAdvancedStats(): Promise<{
    successRate: number;
    complicationRate: number;
    failureRate: number;
    avgIsqPose: number;
    avgIsq3m: number;
    avgIsq6m: number;
    implantsByBrand: Record<string, number>;
    implantsBySite: Record<string, number>;
    isqTrends: { month: string; avgIsq: number }[];
  }> {
    const allImplants = await db.select().from(implants);
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

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(data: { username: string; password: string; role?: string; nom?: string | null; prenom?: string | null }): Promise<User> {
    const [user] = await db.insert(users).values({
      username: data.username,
      password: data.password,
      role: (data.role as any) || "ASSISTANT",
      nom: data.nom || null,
      prenom: data.prenom || null,
    }).returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
