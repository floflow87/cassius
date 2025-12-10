import {
  patients,
  operations,
  implants,
  radios,
  visites,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, or } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
