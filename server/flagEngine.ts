import { db } from "./db";
import { storage } from "./storage";
import {
  patients,
  operations,
  surgeryImplants,
  implants,
  appointments,
  flags,
  type InsertFlag,
} from "@shared/schema";
import { eq, and, sql, lt, isNull, desc } from "drizzle-orm";

const ISQ_LOW_THRESHOLD = 56; // ISQ <= 55 triggers alert (uses < 56)
const ISQ_DECLINE_THRESHOLD = 10;
const DAYS_NO_RECENT_ISQ = 90;
const DAYS_NO_POSTOP_FOLLOWUP = 30;
const DAYS_NO_RECENT_APPOINTMENT = 180;

interface FlagCandidate {
  level: "CRITICAL" | "WARNING" | "INFO";
  type: string;
  label: string;
  description?: string;
  entityType: "PATIENT" | "OPERATION" | "IMPLANT";
  entityId: string;
}

export async function detectFlags(organisationId: string): Promise<FlagCandidate[]> {
  const candidates: FlagCandidate[] = [];

  await Promise.all([
    detectLowIsq(organisationId, candidates),
    detectDecliningIsq(organisationId, candidates),
    detectNoRecentIsq(organisationId, candidates),
    detectNoPostopFollowup(organisationId, candidates),
    detectNoRecentAppointment(organisationId, candidates),
  ]);

  return candidates;
}

async function detectLowIsq(organisationId: string, candidates: FlagCandidate[]): Promise<void> {
  // Check ALL ISQ fields (pose, 2m, 3m, 6m) for low values
  const allImplantsWithIsq = await db
    .select({
      id: surgeryImplants.id,
      siteFdi: surgeryImplants.siteFdi,
      isqPose: surgeryImplants.isqPose,
      isq2m: surgeryImplants.isq2m,
      isq3m: surgeryImplants.isq3m,
      isq6m: surgeryImplants.isq6m,
      marque: implants.marque,
    })
    .from(surgeryImplants)
    .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
    .where(and(
      eq(surgeryImplants.organisationId, organisationId),
      sql`(
        (${surgeryImplants.isqPose} IS NOT NULL AND ${surgeryImplants.isqPose} < ${ISQ_LOW_THRESHOLD}) OR
        (${surgeryImplants.isq2m} IS NOT NULL AND ${surgeryImplants.isq2m} < ${ISQ_LOW_THRESHOLD}) OR
        (${surgeryImplants.isq3m} IS NOT NULL AND ${surgeryImplants.isq3m} < ${ISQ_LOW_THRESHOLD}) OR
        (${surgeryImplants.isq6m} IS NOT NULL AND ${surgeryImplants.isq6m} < ${ISQ_LOW_THRESHOLD})
      )`
    ));

  for (const si of allImplantsWithIsq) {
    // Find the most recent (last) ISQ value that is low
    const lastIsq = si.isq6m ?? si.isq3m ?? si.isq2m ?? si.isqPose;
    const isqLabel = si.isq6m ? "6m" : si.isq3m ? "3m" : si.isq2m ? "2m" : "pose";
    
    if (lastIsq !== null && lastIsq < ISQ_LOW_THRESHOLD) {
      candidates.push({
        level: "CRITICAL",
        type: "ISQ_LOW",
        label: "ISQ faible",
        description: `Implant ${si.marque} site ${si.siteFdi}: ISQ ${isqLabel} = ${lastIsq} (seuil: 55)`,
        entityType: "IMPLANT",
        entityId: si.id,
      });
    }
  }
}

async function detectDecliningIsq(organisationId: string, candidates: FlagCandidate[]): Promise<void> {
  const implantsWithAppointments = await db
    .select({
      surgeryImplantId: surgeryImplants.id,
      siteFdi: surgeryImplants.siteFdi,
      isqPose: surgeryImplants.isqPose,
      marque: implants.marque,
    })
    .from(surgeryImplants)
    .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
    .where(and(
      eq(surgeryImplants.organisationId, organisationId),
      sql`${surgeryImplants.isqPose} IS NOT NULL`
    ));

  for (const si of implantsWithAppointments) {
    const isqHistory = await db
      .select({ isq: appointments.isq, dateStart: appointments.dateStart })
      .from(appointments)
      .where(and(
        eq(appointments.organisationId, organisationId),
        eq(appointments.surgeryImplantId, si.surgeryImplantId),
        sql`${appointments.isq} IS NOT NULL`,
        eq(appointments.status, "COMPLETED")
      ))
      .orderBy(desc(appointments.dateStart))
      .limit(2);

    if (isqHistory.length >= 2) {
      const latestIsq = isqHistory[0].isq!;
      const previousIsq = isqHistory[1].isq!;
      const decline = previousIsq - latestIsq;

      if (decline >= ISQ_DECLINE_THRESHOLD) {
        candidates.push({
          level: "CRITICAL",
          type: "ISQ_DECLINING",
          label: "ISQ en déclin",
          description: `Implant ${si.marque} site ${si.siteFdi}: ISQ ${previousIsq} → ${latestIsq} (déclin de ${decline})`,
          entityType: "IMPLANT",
          entityId: si.surgeryImplantId,
        });
      }
    }
  }
}

async function detectNoRecentIsq(organisationId: string, candidates: FlagCandidate[]): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_NO_RECENT_ISQ);

  const implantsMissingIsq = await db
    .select({
      id: surgeryImplants.id,
      siteFdi: surgeryImplants.siteFdi,
      datePose: surgeryImplants.datePose,
      statut: surgeryImplants.statut,
      marque: implants.marque,
    })
    .from(surgeryImplants)
    .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
    .where(and(
      eq(surgeryImplants.organisationId, organisationId),
      eq(surgeryImplants.statut, "EN_SUIVI"),
      sql`${surgeryImplants.datePose} IS NOT NULL`,
      sql`${surgeryImplants.datePose} < ${cutoffDate.toISOString()}::date`
    ));

  for (const si of implantsMissingIsq) {
    const recentIsqAppointment = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(
        eq(appointments.organisationId, organisationId),
        eq(appointments.surgeryImplantId, si.id),
        sql`${appointments.isq} IS NOT NULL`,
        sql`${appointments.dateStart} > ${cutoffDate.toISOString()}::timestamp`
      ))
      .limit(1);

    if (recentIsqAppointment.length === 0) {
      candidates.push({
        level: "WARNING",
        type: "NO_RECENT_ISQ",
        label: "Pas d'ISQ récent",
        description: `Implant ${si.marque} site ${si.siteFdi}: aucune mesure ISQ depuis ${DAYS_NO_RECENT_ISQ} jours`,
        entityType: "IMPLANT",
        entityId: si.id,
      });
    }
  }
}

async function detectNoPostopFollowup(organisationId: string, candidates: FlagCandidate[]): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_NO_POSTOP_FOLLOWUP);

  const recentOperations = await db
    .select({
      id: operations.id,
      dateOperation: operations.dateOperation,
      typeIntervention: operations.typeIntervention,
      patientId: operations.patientId,
    })
    .from(operations)
    .where(and(
      eq(operations.organisationId, organisationId),
      sql`${operations.dateOperation} < ${cutoffDate.toISOString()}::date`,
      sql`${operations.dateOperation} > ${new Date(cutoffDate.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()}::date`
    ));

  for (const op of recentOperations) {
    const followupAppointment = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(
        eq(appointments.organisationId, organisationId),
        eq(appointments.operationId, op.id),
        eq(appointments.status, "COMPLETED")
      ))
      .limit(1);

    if (followupAppointment.length === 0) {
      candidates.push({
        level: "WARNING",
        type: "NO_POSTOP_FOLLOWUP",
        label: "Pas de suivi post-op",
        description: `Chirurgie du ${op.dateOperation}: aucun rendez-vous de suivi complété`,
        entityType: "OPERATION",
        entityId: op.id,
      });
    }
  }
}

async function detectNoRecentAppointment(organisationId: string, candidates: FlagCandidate[]): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_NO_RECENT_APPOINTMENT);

  const activePatients = await db
    .select({
      id: patients.id,
      nom: patients.nom,
      prenom: patients.prenom,
    })
    .from(patients)
    .where(and(
      eq(patients.organisationId, organisationId),
      eq(patients.statut, "ACTIF")
    ));

  for (const patient of activePatients) {
    const hasImplants = await db
      .select({ id: surgeryImplants.id })
      .from(surgeryImplants)
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .where(and(
        eq(surgeryImplants.organisationId, organisationId),
        eq(operations.patientId, patient.id)
      ))
      .limit(1);

    if (hasImplants.length === 0) continue;

    const recentAppointment = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(
        eq(appointments.organisationId, organisationId),
        eq(appointments.patientId, patient.id),
        eq(appointments.status, "COMPLETED"),
        sql`${appointments.dateStart} > ${cutoffDate.toISOString()}::timestamp`
      ))
      .limit(1);

    if (recentAppointment.length === 0) {
      candidates.push({
        level: "WARNING",
        type: "NO_RECENT_APPOINTMENT",
        label: "Patient sans visite récente",
        description: `${patient.prenom} ${patient.nom}: aucune visite depuis ${DAYS_NO_RECENT_APPOINTMENT} jours`,
        entityType: "PATIENT",
        entityId: patient.id,
      });
    }
  }
}

export async function runFlagDetection(organisationId: string): Promise<{ created: number; existing: number; resolved: number }> {
  const candidates = await detectFlags(organisationId);
  let created = 0;
  let existing = 0;
  let resolved = 0;

  // Build set of current flag keys for comparison
  const currentFlagKeys = new Set(
    candidates.map(c => `${c.type}:${c.entityType}:${c.entityId}`)
  );

  // Get all existing unresolved flags for this org
  const existingFlags = await db
    .select()
    .from(flags)
    .where(and(
      eq(flags.organisationId, organisationId),
      isNull(flags.resolvedAt)
    ));

  // Auto-resolve flags whose conditions no longer apply
  for (const existingFlag of existingFlags) {
    const key = `${existingFlag.type}:${existingFlag.entityType}:${existingFlag.entityId}`;
    if (!currentFlagKeys.has(key)) {
      // This flag's condition no longer applies - auto-resolve it
      await db
        .update(flags)
        .set({
          resolvedAt: new Date(),
          resolvedBy: null, // Auto-resolved by system
        })
        .where(eq(flags.id, existingFlag.id));
      resolved++;
    }
  }

  // Create new flags or track existing ones
  for (const candidate of candidates) {
    try {
      const matchingFlag = existingFlags.find(
        f => f.type === candidate.type && 
             f.entityType === candidate.entityType && 
             f.entityId === candidate.entityId
      );

      if (!matchingFlag) {
        await storage.createFlag(organisationId, candidate as InsertFlag);
        created++;
      } else {
        existing++;
      }
    } catch (error) {
      console.error(`Error creating flag for ${candidate.entityType}/${candidate.entityId}:`, error);
    }
  }

  return { created, existing, resolved };
}
