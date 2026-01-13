import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, computeLatestIsq } from "./storage";
import { requireJwtOrSession } from "./jwtMiddleware";
import * as supabaseStorage from "./supabaseStorage";
import { createDocumentsRouter } from "./modules/documents/routes";
import { setStorageProvider as setDocumentsStorageProvider } from "./modules/documents/service";
import { getTopSlowestEndpoints, getTopDbHeavyEndpoints, getAllStats, clearStats } from "./instrumentation";
import { runFlagDetection } from "./flagEngine";
import * as googleCalendar from "./googleCalendar";
import * as emailService from "./emailService";
import { sendEmail, getPreviewHtml, getBaseUrl, TemplateName } from "./emails";
import { randomBytes, scryptSync } from "crypto";
import notificationService from "./notifications/notificationService";
import {
  insertPatientSchema,
  insertOperationSchema,
  insertImplantSchema,
  insertSurgeryImplantSchema,
  insertRadioSchema,
  insertVisiteSchema,
  insertProtheseSchema,
  insertNoteSchema,
  insertRendezVousSchema,
  insertDocumentSchema,
  updateDocumentSchema,
  insertSavedFilterSchema,
  savedFilterPageTypeEnum,
  insertAppointmentSchema,
  updateAppointmentSchema,
  insertFlagSchema,
  patients,
  importJobs,
  users,
  notifications,
  flags,
  patientShareLinks,
  surgeryImplants,
  implants,
  operations,
} from "@shared/schema";
import type { PublicPatientShareData, PatientShareLinkWithDetails, OnboardingData, OnboardingState } from "@shared/schema";
import { onboardingState, appointments, documents, notificationPreferences, calendarIntegrations, visites } from "@shared/schema";
import type {
  Patient,
  PatientDetail,
  Operation,
  Implant,
  Radio,
  Visite,
  Prothese,
  ImplantDetail,
  DashboardStats,
  AdvancedStats,
  ImplantWithPatient,
  DbTestResponse,
  ApiError,
  UploadUrlRequest,
  UploadUrlResponse,
} from "@shared/types";
import { z } from "zod";
import { db, pool, testConnection, getDbEnv, getDbConnectionInfo } from "./db";
import { eq, sql, and, inArray, notInArray, desc } from "drizzle-orm";

function getOrganisationId(req: Request, res: Response): string | null {
  const organisationId = req.jwtUser?.organisationId;
  if (!organisationId) {
    res.status(400).json({ error: "Organisation manquante dans le token" });
    return null;
  }
  return organisationId;
}

type ImplantWithStats = {
  id: string;
  marque: string;
  referenceFabricant: string | null;
  diametre: number;
  longueur: number;
  lot: string | null;
  poseCount: number;
  successRate: number | null;
};

function evaluateImplantFilterRule(implant: ImplantWithStats, rule: {
  field: string;
  operator: string;
  value: string | number | null;
  value2?: string | number | null;
}): boolean {
  const { field, operator, value, value2 } = rule;
  
  // Get the implant value for the field
  let implantValue: string | number | null;
  switch (field) {
    case "marque":
      implantValue = implant.marque;
      break;
    case "referenceFabricant":
      implantValue = implant.referenceFabricant;
      break;
    case "diametre":
      implantValue = implant.diametre;
      break;
    case "longueur":
      implantValue = implant.longueur;
      break;
    case "lot":
      implantValue = implant.lot;
      break;
    case "poseCount":
      implantValue = implant.poseCount;
      break;
    case "successRate":
      implantValue = implant.successRate;
      break;
    default:
      return false;
  }
  
  // Handle null implant values
  if (implantValue === null || implantValue === undefined) {
    return false;
  }
  
  // Text operators
  if (typeof implantValue === "string") {
    const strValue = String(value || "").toLowerCase();
    const strImplantValue = implantValue.toLowerCase();
    
    switch (operator) {
      case "contains":
        return strImplantValue.includes(strValue);
      case "not_contains":
        return !strImplantValue.includes(strValue);
      case "equals":
        return strImplantValue === strValue;
      case "not_equals":
        return strImplantValue !== strValue;
      default:
        return false;
    }
  }
  
  // Number operators
  if (typeof implantValue === "number") {
    const numValue = Number(value);
    if (isNaN(numValue)) return false;
    const numValue2 = value2 !== undefined && value2 !== null ? Number(value2) : null;
    if (numValue2 !== null && isNaN(numValue2)) return false;
    
    switch (operator) {
      case "equals":
        return implantValue === numValue;
      case "not_equals":
        return implantValue !== numValue;
      case "greater_than":
        return implantValue > numValue;
      case "greater_than_or_equal":
        return implantValue >= numValue;
      case "less_than":
        return implantValue < numValue;
      case "less_than_or_equal":
        return implantValue <= numValue;
      case "between":
        if (numValue2 === null) return implantValue >= numValue;
        return implantValue >= numValue && implantValue <= numValue2;
      default:
        return false;
    }
  }
  
  return false;
}

// Type for operation with stats (from getAllOperations)
type OperationWithDetails = {
  id: string;
  organisationId: string;
  patientId: string;
  dateOperation: string;
  typeIntervention: string | null;
  typeChirurgieTemps: string | null;
  typeChirurgieApproche: string | null;
  greffeOsseuse: boolean | null;
  typeGreffe: string | null;
  greffeQuantite: string | null;
  greffeLocalisation: string | null;
  typeMiseEnCharge: string | null;
  conditionsMedicalesPreop: string | null;
  notesPerop: string | null;
  observationsPostop: string | null;
  patientNom: string;
  patientPrenom: string;
  implantCount: number;
  successRate: number | null;
};

function evaluateActeFilterRule(operation: OperationWithDetails, rule: {
  field: string;
  operator: string;
  value: string | number | boolean | null;
  value2?: string | number | null;
}): boolean {
  const { field, operator, value, value2 } = rule;
  
  // Get the operation value for the field
  let opValue: string | number | boolean | null;
  switch (field) {
    case "dateOperation":
      opValue = operation.dateOperation;
      break;
    case "typeIntervention":
      opValue = operation.typeIntervention;
      break;
    case "typeChirurgieTemps":
      opValue = operation.typeChirurgieTemps;
      break;
    case "typeChirurgieApproche":
      opValue = operation.typeChirurgieApproche;
      break;
    case "greffeOsseuse":
      opValue = operation.greffeOsseuse;
      break;
    case "implantCount":
      opValue = operation.implantCount;
      break;
    case "successRate":
      opValue = operation.successRate;
      break;
    default:
      return false;
  }
  
  // Boolean operators
  if (operator === "is_true") {
    return opValue === true;
  }
  if (operator === "is_false") {
    return opValue === false || opValue === null;
  }
  
  // Handle null operation values
  if (opValue === null || opValue === undefined) {
    return false;
  }
  
  // Date operators
  if (field === "dateOperation" && typeof opValue === "string") {
    const opDate = new Date(opValue).getTime();
    const filterDate = new Date(String(value)).getTime();
    
    if (isNaN(opDate) || isNaN(filterDate)) return false;
    
    switch (operator) {
      case "equals":
        return opDate === filterDate;
      case "greater_than":
        return opDate > filterDate;
      case "greater_than_or_equal":
        return opDate >= filterDate;
      case "less_than":
        return opDate < filterDate;
      case "less_than_or_equal":
        return opDate <= filterDate;
      case "between":
        if (!value2) return false;
        const filterDate2 = new Date(String(value2)).getTime();
        if (isNaN(filterDate2)) return false;
        return opDate >= filterDate && opDate <= filterDate2;
      default:
        return false;
    }
  }
  
  // Enum/text operators (typeIntervention, typeChirurgieTemps, typeChirurgieApproche)
  if (typeof opValue === "string") {
    const strValue = String(value || "").toUpperCase();
    const strOpValue = opValue.toUpperCase();
    
    switch (operator) {
      case "equals":
        return strOpValue === strValue;
      case "not_equals":
        return strOpValue !== strValue;
      default:
        return false;
    }
  }
  
  // Number operators (implantCount, successRate)
  if (typeof opValue === "number") {
    const numValue = Number(value);
    if (isNaN(numValue)) return false;
    const numValue2 = value2 !== undefined && value2 !== null ? Number(value2) : null;
    if (numValue2 !== null && isNaN(numValue2)) return false;
    
    switch (operator) {
      case "equals":
        return opValue === numValue;
      case "not_equals":
        return opValue !== numValue;
      case "greater_than":
        return opValue > numValue;
      case "greater_than_or_equal":
        return opValue >= numValue;
      case "less_than":
        return opValue < numValue;
      case "less_than_or_equal":
        return opValue <= numValue;
      case "between":
        if (numValue2 === null) return false;
        return opValue >= numValue && opValue <= numValue2;
      default:
        return false;
    }
  }
  
  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Initialize and mount modular Documents router
  setDocumentsStorageProvider({
    isStorageConfigured: supabaseStorage.isStorageConfigured,
    createSignedUploadUrl: supabaseStorage.createSignedUploadUrl,
    getSignedDownloadUrl: supabaseStorage.getSignedUrl,
    deleteFile: supabaseStorage.deleteFile,
  });
  
  const documentsRouter = createDocumentsRouter(
    requireJwtOrSession,
    (req, res) => getOrganisationId(req, res) ?? undefined,
    (req) => req.jwtUser?.userId
  );
  app.use("/api/documents", documentsRouter);

  app.get("/api/health/db", requireJwtOrSession, async (_req, res) => {
    const result = await testConnection();
    const env = getDbEnv();
    const { dbHost, dbName } = getDbConnectionInfo();
    const status = result.ok ? "connected" : "unreachable";
    
    console.log(`[DB-HEALTH] env=${env} host=${dbHost} db=${dbName} latency=${result.latencyMs}ms status=${status}`);
    
    if (result.ok) {
      res.json({
        ok: true,
        db: "connected",
        latencyMs: result.latencyMs,
        env,
        dbHost,
        dbName,
      });
    } else {
      const errorCode = result.error?.includes("ETIMEDOUT") ? "ETIMEDOUT" 
        : result.error?.includes("ECONNREFUSED") ? "ECONNREFUSED"
        : "CONNECTION_ERROR";
      
      res.status(500).json({
        ok: false,
        db: "unreachable",
        env,
        dbHost,
        dbName,
        error: errorCode,
      });
    }
  });

  app.get("/api/perf/stats", requireJwtOrSession, async (_req, res) => {
    try {
      const slowest = getTopSlowestEndpoints(10);
      const dbHeavy = getTopDbHeavyEndpoints(10);
      
      res.json({
        timestamp: new Date().toISOString(),
        topSlowestEndpoints: slowest,
        topDbHeavyEndpoints: dbHeavy,
      });
    } catch (error) {
      console.error("Error getting perf stats:", error);
      res.status(500).json({ error: "Failed to get performance stats" });
    }
  });

  app.get("/api/perf/all", requireJwtOrSession, async (_req, res) => {
    try {
      res.json({
        timestamp: new Date().toISOString(),
        stats: getAllStats(),
      });
    } catch (error) {
      console.error("Error getting all stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.post("/api/perf/reset", requireJwtOrSession, async (_req, res) => {
    try {
      clearStats();
      res.json({ ok: true, message: "Stats cleared" });
    } catch (error) {
      console.error("Error resetting stats:", error);
      res.status(500).json({ error: "Failed to reset stats" });
    }
  });

  // ========== GLOBAL SEARCH ==========
  app.get("/api/search", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const query = req.query.q as string || "";
      const results = await storage.globalSearch(organisationId, query);
      res.json(results);
    } catch (error) {
      console.error("Error in global search:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // ========== PATIENTS ==========
  app.get("/api/patients", requireJwtOrSession, async (req, res) => {
    const env = process.env.APP_ENV || process.env.NODE_ENV || "unknown";
    const userId = req.jwtUser?.userId || "none";
    const hasSession = req.isAuthenticated?.() ?? false;
    const hasBearer = !!req.headers.authorization?.startsWith("Bearer ");
    const organisationId = req.jwtUser?.organisationId || "none";
    
    console.log(`[API] GET /api/patients | env=${env} | userId=${userId} | hasSession=${hasSession} | hasBearer=${hasBearer} | orgId=${organisationId}`);

    if (!req.jwtUser?.organisationId) {
      console.log(`[API] GET /api/patients | REJECTED: no organisationId`);
      return res.status(403).json({ error: "Organisation manquante dans le token" });
    }

    try {
      const patients = await storage.getPatients(req.jwtUser.organisationId);
      console.log(`[API] GET /api/patients | SUCCESS: ${patients.length} patients`);
      res.json(patients);
    } catch (error) {
      const err = error as Error;
      console.error(`[API] GET /api/patients | ERROR:`, err.message);
      console.error(err.stack);
      res.status(500).json({ error: "Failed to fetch patients", details: err.message });
    }
  });

  app.get("/api/patients/search", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const query = req.query.q as string || "";
      const patients = await storage.searchPatients(organisationId, query);
      res.json(patients);
    } catch (error) {
      console.error("Error searching patients:", error);
      res.status(500).json({ error: "Failed to search patients" });
    }
  });

  // OPTIMIZATION: Combined summary endpoint - reduces 3 API calls to 1 for patient list view
  // Now includes flag summaries per patient
  app.get("/api/patients/summary", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const [summary, flagSummaries] = await Promise.all([
        storage.getPatientsWithSummary(organisationId),
        storage.getAllPatientFlagSummaries(organisationId),
      ]);
      
      // Convert Map to object for JSON serialization
      const flagsByPatient: Record<string, { topFlag?: any; activeFlagCount: number }> = {};
      for (const [patientId, data] of flagSummaries) {
        flagsByPatient[patientId] = data;
      }
      
      res.json({ ...summary, flagsByPatient });
    } catch (error) {
      console.error("Error fetching patient summary:", error);
      res.status(500).json({ error: "Failed to fetch patient summary" });
    }
  });

  // Advanced patient search with filters, pagination, and sorting
  app.post("/api/patients/search", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const result = await storage.searchPatientsAdvanced(organisationId, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error in advanced patient search:", error);
      res.status(500).json({ error: "Failed to search patients" });
    }
  });

  app.get("/api/patients/implant-counts", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const counts = await storage.getPatientImplantCounts(organisationId);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching implant counts:", error);
      res.status(500).json({ error: "Failed to fetch implant counts" });
    }
  });

  app.get("/api/patients/last-visits", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const lastVisits = await storage.getPatientLastVisits(organisationId);
      res.json(lastVisits);
    } catch (error) {
      console.error("Error fetching last visits:", error);
      res.status(500).json({ error: "Failed to fetch last visits" });
    }
  });

  app.get("/api/patients/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const [patient, upcomingAppointments, flagSummary] = await Promise.all([
        storage.getPatientWithDetails(organisationId, req.params.id),
        storage.getPatientUpcomingRendezVous(organisationId, req.params.id),
        storage.getPatientFlagSummary(organisationId, req.params.id),
      ]);
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // OPTIMIZATION: Don't generate signed URLs upfront
      // Frontend fetches them on-demand via /api/radios/:id/url endpoint
      // This removes expensive batch URL generation from initial page load
      const radiosWithNullUrls = patient.radios?.map(radio => ({
        ...radio,
        signedUrl: null,
      })) || [];
      
      // Add latestIsq and flag info to each surgeryImplant (batch to avoid N+1)
      const surgeryImplantIds = (patient.surgeryImplants || []).map(si => si.id);
      const implantFlagSummaries = await storage.getSurgeryImplantFlagSummaries(organisationId, surgeryImplantIds);
      
      const surgeryImplantsWithExtras = (patient.surgeryImplants || []).map((si) => {
        const siFlagSummary = implantFlagSummaries.get(si.id) || { activeFlagCount: 0 };
        return {
          ...si,
          latestIsq: computeLatestIsq(si),
          topFlag: siFlagSummary.topFlag,
          activeFlagCount: siFlagSummary.activeFlagCount,
        };
      });
      
      res.json({ 
        ...patient, 
        radios: radiosWithNullUrls, 
        upcomingAppointments,
        surgeryImplants: surgeryImplantsWithExtras,
        topFlag: flagSummary.topFlag,
        activeFlagCount: flagSummary.activeFlagCount,
      });
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  app.post("/api/patients", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(organisationId, data);
      res.status(201).json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating patient:", error);
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.userId;

    try {
      const data = insertPatientSchema.partial().parse(req.body);
      const patient = await storage.updatePatient(organisationId, req.params.id, data);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Notify other team members about patient modification
      if (userId) {
        const orgUsers = await storage.getUsersByOrganisation(organisationId);
        const changedFields = Object.keys(data);
        
        for (const user of orgUsers) {
          if (user.id !== userId) {
            notificationService.notificationEvents.onPatientUpdated({
              organisationId,
              recipientUserId: user.id,
              actorUserId: userId,
              patientId: patient.id,
              changes: changedFields,
            }).catch(err => console.error("[Notification] Patient updated notification failed:", err));
          }
        }
      }
      
      res.json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating patient:", error);
      res.status(500).json({ error: "Failed to update patient" });
    }
  });

  app.delete("/api/patients/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const deleted = await storage.deletePatient(organisationId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting patient:", error);
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  // ========== PATIENT SHARE LINKS ==========

  // Create a share link for a patient's implants
  app.post("/api/patients/:patientId/share-links", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.userId;
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    const { patientId } = req.params;
    const { expiresInDays } = req.body as { expiresInDays?: number };

    try {
      // Verify patient exists and belongs to this org
      const patient = await storage.getPatient(organisationId, patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      // Generate a secure random token
      const token = randomBytes(32).toString("hex");
      const tokenHash = scryptSync(token, "salt_share_link", 64).toString("hex");

      // Calculate expiration (default: no expiration)
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) 
        : null;

      // Insert the share link
      const [shareLink] = await db.insert(patientShareLinks).values({
        organisationId,
        patientId,
        sharedByUserId: userId,
        tokenHash,
        expiresAt,
      }).returning();

      // Return the token (only time it's visible - we store only the hash)
      res.json({
        id: shareLink.id,
        token,
        shareUrl: `${getBaseUrl()}/public/share/${token}`,
        expiresAt: shareLink.expiresAt,
        createdAt: shareLink.createdAt,
      });
    } catch (error) {
      console.error("Error creating share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  // Get existing share links for a patient
  app.get("/api/patients/:patientId/share-links", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    const { patientId } = req.params;

    try {
      // Verify patient exists
      const patient = await storage.getPatient(organisationId, patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      // Get all active share links for this patient
      const links = await db.select({
        id: patientShareLinks.id,
        expiresAt: patientShareLinks.expiresAt,
        revokedAt: patientShareLinks.revokedAt,
        lastAccessedAt: patientShareLinks.lastAccessedAt,
        accessCount: patientShareLinks.accessCount,
        createdAt: patientShareLinks.createdAt,
        sharedByUserName: sql<string>`(SELECT COALESCE(prenom || ' ' || nom, username) FROM users WHERE id = ${patientShareLinks.sharedByUserId})`,
      }).from(patientShareLinks).where(
        and(
          eq(patientShareLinks.organisationId, organisationId),
          eq(patientShareLinks.patientId, patientId)
        )
      ).orderBy(desc(patientShareLinks.createdAt));

      res.json(links);
    } catch (error) {
      console.error("Error fetching share links:", error);
      res.status(500).json({ error: "Failed to fetch share links" });
    }
  });

  // Revoke a share link
  app.delete("/api/patients/:patientId/share-links/:linkId", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    const { patientId, linkId } = req.params;

    try {
      // Verify patient exists and belongs to this org
      const patient = await storage.getPatient(organisationId, patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      // Revoke the link by setting revokedAt
      const result = await db.update(patientShareLinks)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(patientShareLinks.id, linkId),
            eq(patientShareLinks.organisationId, organisationId),
            eq(patientShareLinks.patientId, patientId)
          )
        )
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Share link not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking share link:", error);
      res.status(500).json({ error: "Failed to revoke share link" });
    }
  });

  // Public endpoint to view shared patient data (NO AUTH REQUIRED)
  app.get("/api/public/share/:token", async (req, res) => {
    const { token } = req.params;

    try {
      // Hash the provided token to match against stored hash
      const tokenHash = scryptSync(token, "salt_share_link", 64).toString("hex");

      // Find the share link
      const [link] = await db.select().from(patientShareLinks)
        .where(eq(patientShareLinks.tokenHash, tokenHash))
        .limit(1);

      if (!link) {
        return res.status(404).json({ error: "Lien de partage invalide ou expiré" });
      }

      // Check if revoked
      if (link.revokedAt) {
        return res.status(410).json({ error: "Ce lien de partage a été révoqué" });
      }

      // Check if expired
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Ce lien de partage a expiré" });
      }

      // Update access count and last accessed
      await db.update(patientShareLinks)
        .set({ 
          accessCount: sql`${patientShareLinks.accessCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(eq(patientShareLinks.id, link.id));

      // Get patient basic info
      const [patient] = await db.select({
        prenom: patients.prenom,
        nom: patients.nom,
        dateNaissance: patients.dateNaissance,
      }).from(patients).where(eq(patients.id, link.patientId)).limit(1);

      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      // Get implants for this patient (through operations)
      const implantData = await db.select({
        id: surgeryImplants.id,
        siteFdi: surgeryImplants.siteFdi,
        marque: implants.marque,
        reference: implants.referenceFabricant,
        diametre: implants.diametre,
        longueur: implants.longueur,
        position: surgeryImplants.positionImplant,
        statut: surgeryImplants.statut,
        datePose: surgeryImplants.datePose,
        isqPose: surgeryImplants.isqPose,
        isq2m: surgeryImplants.isq2m,
        isq3m: surgeryImplants.isq3m,
        isq6m: surgeryImplants.isq6m,
      })
        .from(surgeryImplants)
        .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
        .leftJoin(implants, eq(surgeryImplants.implantId, implants.id))
        .where(eq(operations.patientId, link.patientId))
        .orderBy(desc(surgeryImplants.datePose));

      // Get sharer name
      const [sharer] = await db.select({
        name: sql<string>`COALESCE(${users.prenom} || ' ' || ${users.nom}, ${users.username})`,
      }).from(users).where(eq(users.id, link.sharedByUserId)).limit(1);

      const responseData: PublicPatientShareData = {
        patient: {
          prenom: patient.prenom,
          nom: patient.nom,
          dateNaissance: patient.dateNaissance,
        },
        implants: implantData,
        sharedByUserName: sharer?.name || "Utilisateur inconnu",
        createdAt: link.createdAt.toISOString(),
      };

      res.json(responseData);
    } catch (error) {
      console.error("Error fetching shared patient data:", error);
      res.status(500).json({ error: "Failed to fetch shared data" });
    }
  });

  // ========== OPERATIONS ==========
  app.get("/api/operations", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const operations = await storage.getAllOperations(organisationId);
      res.json(operations);
    } catch (error) {
      console.error("Error fetching operations:", error);
      res.status(500).json({ error: "Failed to fetch operations" });
    }
  });

  // Operations summary for search autocomplete
  app.get("/api/operations/summary", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const operations = await storage.getAllOperations(organisationId);
      const patients = await storage.getPatients(organisationId);
      const patientsMap: Record<string, { nom: string; prenom: string }> = {};
      patients.forEach((p: { id: string; nom: string; prenom: string }) => { patientsMap[p.id] = { nom: p.nom, prenom: p.prenom }; });
      
      const summary = operations.map(op => ({
        id: op.id,
        patientNom: patientsMap[op.patientId]?.nom || '',
        patientPrenom: patientsMap[op.patientId]?.prenom || '',
        dateOperation: op.dateOperation,
        typeIntervention: op.typeIntervention,
      }));
      res.json(summary);
    } catch (error) {
      console.error("Error fetching operations summary:", error);
      res.status(500).json({ error: "Failed to fetch operations summary" });
    }
  });

  // Zod schema for acte (operation) filter validation
  const acteFilterRuleSchema = z.object({
    id: z.string(),
    field: z.enum(["dateOperation", "typeIntervention", "typeChirurgieTemps", "typeChirurgieApproche", "greffeOsseuse", "implantCount", "successRate"]),
    operator: z.enum(["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between", "is_true", "is_false"]),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    value2: z.union([z.string(), z.number(), z.null()]).optional(),
  });

  const acteFilterGroupSchema = z.object({
    id: z.string(),
    operator: z.enum(["AND", "OR"]),
    rules: z.array(acteFilterRuleSchema),
  });

  const operationSearchSchema = z.object({
    filters: acteFilterGroupSchema.nullable().optional(),
  });

  // Valid operator/field combinations for acte filters
  const validActeFieldOperators: Record<string, string[]> = {
    dateOperation: ["equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between"],
    typeIntervention: ["equals", "not_equals"],
    typeChirurgieTemps: ["equals", "not_equals"],
    typeChirurgieApproche: ["equals", "not_equals"],
    greffeOsseuse: ["is_true", "is_false"],
    implantCount: ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between"],
    successRate: ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between"],
  };

  // Search operations with advanced filters
  app.post("/api/operations/search", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const parseResult = operationSearchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid filter format", details: parseResult.error.errors });
      }
      
      const { filters } = parseResult.data;
      
      // Validate operator/field combinations
      if (filters && filters.rules) {
        for (const rule of filters.rules) {
          const validOps = validActeFieldOperators[rule.field];
          if (!validOps || !validOps.includes(rule.operator)) {
            return res.status(400).json({ 
              error: "Invalid operator for field", 
              details: `Operator '${rule.operator}' is not valid for field '${rule.field}'` 
            });
          }
        }
      }
      
      // Get all operations first
      let allOperations = await storage.getAllOperations(organisationId);
      
      // Apply advanced filters if present
      if (filters && filters.rules && filters.rules.length > 0) {
        const groupOperator = filters.operator || "AND";
        
        allOperations = allOperations.filter(operation => {
          const results = filters.rules.map((rule) => {
            return evaluateActeFilterRule(operation, rule);
          });
          
          if (groupOperator === "AND") {
            return results.every(r => r);
          } else {
            return results.some(r => r);
          }
        });
      }
      
      res.json(allOperations);
    } catch (error) {
      console.error("Error searching operations:", error);
      res.status(500).json({ error: "Failed to search operations" });
    }
  });

  app.get("/api/operations/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const operation = await storage.getOperationWithDetails(organisationId, req.params.id);
      if (!operation) {
        return res.status(404).json({ error: "Operation not found" });
      }
      res.json(operation);
    } catch (error) {
      console.error("Error fetching operation:", error);
      res.status(500).json({ error: "Failed to fetch operation" });
    }
  });

  const operationWithImplantsSchema = insertOperationSchema.extend({
    implants: z.array(
      z.object({
        typeImplant: z.enum(["IMPLANT", "MINI_IMPLANT"]).optional().default("IMPLANT"),
        marque: z.string(),
        referenceFabricant: z.string().optional(),
        diametre: z.number(),
        longueur: z.number(),
        siteFdi: z.string(),
        positionImplant: z.enum(["CRESTAL", "SOUS_CRESTAL", "SUPRA_CRESTAL"]).optional(),
        typeOs: z.enum(["D1", "D2", "D3", "D4"]).optional(),
        miseEnChargePrevue: z.enum(["IMMEDIATE", "PRECOCE", "DIFFEREE"]).optional(),
        isqPose: z.number().optional(),
      })
    ).default([]),
  });

  app.post("/api/operations", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Validation du body avec Zod
      const data = operationWithImplantsSchema.parse(req.body);
      const { implants: implantData, ...operationData } = data;

      // Création transactionnelle : opération + surgery_implants (atomique)
      const { operation, surgeryImplants: createdSurgeryImplants } = await storage.createOperationWithImplants(
        organisationId,
        operationData,
        implantData
      );

      // Auto-complete onboarding step 4 (first case) when operation is created
      try {
        const onboardingStateRow = await db
          .select()
          .from(onboardingState)
          .where(eq(onboardingState.organisationId, organisationId))
          .then(rows => rows[0]);
        
        if (onboardingStateRow && onboardingStateRow.status === "IN_PROGRESS") {
          const completedSteps = JSON.parse(onboardingStateRow.completedSteps || "{}");
          if (!completedSteps["4"]) {
            completedSteps["4"] = true;
            const data = JSON.parse(onboardingStateRow.data || "{}");
            data.firstCaseCreated = true;
            
            await db
              .update(onboardingState)
              .set({
                completedSteps: JSON.stringify(completedSteps),
                data: JSON.stringify(data),
                updatedAt: new Date(),
              })
              .where(eq(onboardingState.organisationId, organisationId));
            
            console.log("[Onboarding] Auto-completed step 4 after operation creation");
          }
        }
      } catch (onboardingError) {
        console.error("[Onboarding] Error auto-completing step 4:", onboardingError);
      }

      res.status(201).json({ ...operation, surgeryImplants: createdSurgeryImplants });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating operation:", error);
      res.status(500).json({ error: "Erreur lors de la création de l'opération" });
    }
  });

  app.delete("/api/operations/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const deleted = await storage.deleteOperation(organisationId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Operation not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting operation:", error);
      res.status(500).json({ error: "Failed to delete operation" });
    }
  });

  app.patch("/api/operations/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const updateSchema = z.object({
        dateOperation: z.string().optional(),
        typeIntervention: z.enum([
          "POSE_IMPLANT",
          "GREFFE_OSSEUSE",
          "SINUS_LIFT",
          "EXTRACTION_IMPLANT_IMMEDIATE",
          "REPRISE_IMPLANT",
          "CHIRURGIE_GUIDEE",
        ]).optional(),
        typeChirurgieTemps: z.enum(["UN_TEMPS", "DEUX_TEMPS"]).nullable().optional(),
        typeChirurgieApproche: z.enum(["LAMBEAU", "FLAPLESS"]).nullable().optional(),
        greffeOsseuse: z.boolean().nullable().optional(),
        typeGreffe: z.string().nullable().optional(),
        greffeQuantite: z.string().nullable().optional(),
        greffeLocalisation: z.string().nullable().optional(),
        typeMiseEnCharge: z.enum(["IMMEDIATE", "PRECOCE", "DIFFEREE"]).nullable().optional(),
        conditionsMedicalesPreop: z.string().nullable().optional(),
        notesPerop: z.string().nullable().optional(),
        observationsPostop: z.string().nullable().optional(),
      });

      const validatedUpdates = updateSchema.parse(req.body);
      const updated = await storage.updateOperation(organisationId, req.params.id, validatedUpdates);

      if (!updated) {
        return res.status(404).json({ error: "Operation not found" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating operation:", error);
      res.status(500).json({ error: "Failed to update operation" });
    }
  });

  // Get timeline for a specific operation
  app.get("/api/operations/:id/timeline", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const timeline = await storage.getOperationTimeline(organisationId, req.params.id);
      if (!timeline) {
        return res.status(404).json({ error: "Operation not found" });
      }
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching operation timeline:", error);
      res.status(500).json({ error: "Failed to fetch operation timeline" });
    }
  });

  // ========== IMPLANTS ==========
  app.get("/api/implants/brands", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const brands = await storage.getImplantBrands(organisationId);
      res.json(brands);
    } catch (error) {
      console.error("Error fetching brands:", error);
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  // Get catalog implant with stats
  app.get("/api/catalog-implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const allImplantsWithStats = await storage.getAllImplantsWithStats(organisationId);
      const implantWithStats = allImplantsWithStats.find(i => i.id === req.params.id);
      
      if (!implantWithStats) {
        return res.status(404).json({ error: "Implant not found" });
      }
      
      res.json(implantWithStats);
    } catch (error) {
      console.error("Error fetching catalog implant:", error);
      res.status(500).json({ error: "Failed to fetch catalog implant" });
    }
  });

  // Update catalog implant
  app.patch("/api/catalog-implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const updateSchema = insertImplantSchema.partial();
      const validatedUpdates = updateSchema.parse(req.body);
      
      const updated = await storage.updateCatalogImplant(organisationId, req.params.id, validatedUpdates);
      
      if (!updated) {
        return res.status(404).json({ error: "Implant not found" });
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating catalog implant:", error);
      res.status(500).json({ error: "Failed to update catalog implant" });
    }
  });

  // Delete catalog implant
  app.delete("/api/catalog-implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const deleted = await storage.deleteImplant(organisationId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Implant not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting implant:", error);
      res.status(500).json({ error: "Failed to delete implant" });
    }
  });

  // Get surgeries using a catalog implant
  app.get("/api/catalog-implants/:id/surgeries", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const surgeries = await storage.getSurgeryImplantsByCatalogImplant(organisationId, req.params.id);
      res.json(surgeries);
    } catch (error) {
      console.error("Error fetching catalog implant surgeries:", error);
      res.status(500).json({ error: "Failed to fetch surgeries" });
    }
  });

  // Zod schema for implant filter validation
  const implantFilterRuleSchema = z.object({
    id: z.string(),
    field: z.enum(["marque", "referenceFabricant", "diametre", "longueur", "lot", "poseCount", "successRate"]),
    operator: z.enum(["equals", "not_equals", "contains", "not_contains", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between"]),
    value: z.union([z.string(), z.number(), z.null()]),
    value2: z.union([z.string(), z.number(), z.null()]).optional(),
  });

  const implantFilterGroupSchema = z.object({
    id: z.string(),
    operator: z.enum(["AND", "OR"]),
    rules: z.array(implantFilterRuleSchema),
  });

  const catalogImplantSearchSchema = z.object({
    filters: implantFilterGroupSchema.nullable().optional(),
    typeImplant: z.enum(["IMPLANT", "MINI_IMPLANT"]).optional(),
  });

  // Search catalog implants with advanced filters
  app.post("/api/catalog-implants/search", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const parseResult = catalogImplantSearchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid filter format", details: parseResult.error.errors });
      }
      
      const { filters, typeImplant } = parseResult.data;
      
      // Get all implants with stats first
      let allImplants = await storage.getAllImplantsWithStats(organisationId);
      
      // Filter by implant type if specified
      if (typeImplant) {
        allImplants = allImplants.filter(i => i.typeImplant === typeImplant);
      }
      
      // Apply advanced filters if present
      if (filters && filters.rules && filters.rules.length > 0) {
        const groupOperator = filters.operator || "AND";
        
        allImplants = allImplants.filter(implant => {
          const results = filters.rules.map((rule) => {
            return evaluateImplantFilterRule(implant, rule);
          });
          
          if (groupOperator === "AND") {
            return results.every(r => r);
          } else {
            return results.some(r => r);
          }
        });
      }
      
      res.json(allImplants);
    } catch (error) {
      console.error("Error searching catalog implants:", error);
      res.status(500).json({ error: "Failed to search catalog implants" });
    }
  });

  // Get surgery implant with details (implant posé avec patient, surgery, visites, radios)
  app.get("/api/surgery-implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const [surgeryImplant, flagSummary] = await Promise.all([
        storage.getSurgeryImplantWithDetails(organisationId, req.params.id),
        storage.getSurgeryImplantFlagSummary(organisationId, req.params.id),
      ]);
      if (!surgeryImplant) {
        return res.status(404).json({ error: "Implant not found" });
      }
      res.json({
        ...surgeryImplant,
        latestIsq: computeLatestIsq(surgeryImplant),
        topFlag: flagSummary.topFlag,
        activeFlagCount: flagSummary.activeFlagCount,
      });
    } catch (error) {
      console.error("Error fetching surgery implant:", error);
      res.status(500).json({ error: "Failed to fetch surgery implant" });
    }
  });

  // Delete multiple surgery implants (bulk delete)
  app.delete("/api/surgery-implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array is required" });
      }
      const deletedCount = await storage.deleteSurgeryImplants(organisationId, ids);
      res.json({ deleted: deletedCount });
    } catch (error) {
      console.error("Error deleting surgery implants:", error);
      res.status(500).json({ error: "Failed to delete surgery implants" });
    }
  });

  // Create a new surgery implant (implant posé)
  app.post("/api/surgery-implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = insertSurgeryImplantSchema.parse(req.body);
      const surgeryImplant = await storage.createSurgeryImplant(organisationId, data);
      res.status(201).json(surgeryImplant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating surgery implant:", error);
      res.status(500).json({ error: "Failed to create surgery implant" });
    }
  });

  // Update surgery implant (informations de pose)
  app.patch("/api/surgery-implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const updated = await storage.updateSurgeryImplant(organisationId, req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Surgery implant not found" });
      }
      
      // Auto-trigger flag detection if ISQ fields were updated
      const isqFields = ['isqPose', 'isq2m', 'isq3m', 'isq6m'];
      const hasIsqUpdate = isqFields.some(field => field in req.body);
      if (hasIsqUpdate) {
        runFlagDetection(organisationId).catch(err => 
          console.error("Flag detection failed:", err)
        );
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating surgery implant:", error);
      res.status(500).json({ error: "Failed to update surgery implant" });
    }
  });

  // Legacy route for backward compatibility - redirects to surgery-implants
  app.get("/api/implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const surgeryImplant = await storage.getSurgeryImplantWithDetails(organisationId, req.params.id);
      if (!surgeryImplant) {
        return res.status(404).json({ error: "Implant not found" });
      }
      res.json(surgeryImplant);
    } catch (error) {
      console.error("Error fetching implant:", error);
      res.status(500).json({ error: "Failed to fetch implant" });
    }
  });

  app.get("/api/patients/:id/implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const surgeryImplants = await storage.getPatientSurgeryImplants(organisationId, req.params.id);
      
      // Add latestIsq and flag info to each implant (batch to avoid N+1)
      const implantIds = surgeryImplants.map(si => si.id);
      const flagSummaries = await storage.getSurgeryImplantFlagSummaries(organisationId, implantIds);
      
      const implantsWithExtras = surgeryImplants.map((si) => {
        const flagSummary = flagSummaries.get(si.id) || { activeFlagCount: 0 };
        return {
          ...si,
          latestIsq: computeLatestIsq(si),
          topFlag: flagSummary.topFlag,
          activeFlagCount: flagSummary.activeFlagCount,
        };
      });
      
      res.json(implantsWithExtras);
    } catch (error) {
      console.error("Error fetching patient implants:", error);
      res.status(500).json({ error: "Failed to fetch implants" });
    }
  });

  app.post("/api/implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = insertImplantSchema.parse(req.body);
      const implant = await storage.createImplant(organisationId, data);
      res.status(201).json(implant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating implant:", error);
      res.status(500).json({ error: "Failed to create implant" });
    }
  });

  // Liste tous les surgery_implants avec filtrage optionnel
  // Now includes latestIsq and flag info
  app.get("/api/surgery-implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { marque, siteFdi, typeOs, statut } = req.query;
      let surgeryImplants;
      if (marque || siteFdi || typeOs || statut) {
        surgeryImplants = await storage.filterSurgeryImplants(organisationId, {
          marque: marque as string,
          siteFdi: siteFdi as string,
          typeOs: typeOs as string,
          statut: statut as string,
        });
      } else {
        surgeryImplants = await storage.getAllSurgeryImplants(organisationId);
      }
      
      // Add latestIsq and flag info to each implant (batch to avoid N+1)
      const implantIds = surgeryImplants.map(si => si.id);
      const flagSummaries = await storage.getSurgeryImplantFlagSummaries(organisationId, implantIds);
      
      const implantsWithExtras = surgeryImplants.map((si) => {
        const flagSummary = flagSummaries.get(si.id) || { activeFlagCount: 0 };
        return {
          ...si,
          latestIsq: computeLatestIsq(si),
          topFlag: flagSummary.topFlag,
          activeFlagCount: flagSummary.activeFlagCount,
        };
      });
      
      res.json(implantsWithExtras);
    } catch (error) {
      console.error("Error fetching surgery implants:", error);
      res.status(500).json({ error: "Failed to fetch surgery implants" });
    }
  });

  // Route catalogue - retourne les implants du catalogue produit
  app.get("/api/implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Retourne le catalogue d'implants avec statistiques de pose
      const catalogueImplants = await storage.getAllImplantsWithStats(organisationId);
      res.json(catalogueImplants);
    } catch (error) {
      console.error("Error fetching implants:", error);
      res.status(500).json({ error: "Failed to fetch implants" });
    }
  });

  // ========== RADIOS (Supabase Storage) ==========
  
  // Get signed upload URL for client-side upload
  app.post("/api/radios/upload-url", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId, fileName, mimeType } = req.body;
      if (!patientId || !fileName) {
        return res.status(400).json({ error: "patientId and fileName are required" });
      }

      // Generate unique document ID
      const documentId = crypto.randomUUID();
      
      // Generate file path: org/{orgId}/patients/{patientId}/radiographies/{docId}/{filename}
      const filePath = supabaseStorage.generateFilePath(
        organisationId,
        patientId,
        documentId,
        fileName
      );

      // Get signed upload URL from Supabase
      const { signedUrl, token, path } = await supabaseStorage.createSignedUploadUrl(filePath);

      res.json({
        documentId,
        signedUrl,
        token,
        filePath: path,
      });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Get single radio with fresh signed URL (use for downloads/viewing)
  app.get("/api/radios/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const radio = await storage.getRadio(organisationId, req.params.id);
      if (!radio) {
        return res.status(404).json({ error: "Radio not found" });
      }
      
      // Generate fresh signed URL for viewing/download
      let signedUrl: string | null = null;
      if (radio.filePath && supabaseStorage.isStorageConfigured()) {
        try {
          signedUrl = await supabaseStorage.getSignedUrl(radio.filePath);
        } catch (err) {
          console.error("Failed to get signed URL:", err);
        }
      }
      
      res.json({ ...radio, signedUrl });
    } catch (error) {
      console.error("Error fetching radio:", error);
      res.status(500).json({ error: "Failed to fetch radio" });
    }
  });

  // Get fresh signed URL for a specific radio (for expired URL refresh)
  app.get("/api/radios/:id/signed-url", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const radio = await storage.getRadio(organisationId, req.params.id);
      if (!radio) {
        return res.status(404).json({ error: "Radio not found" });
      }
      
      // For legacy radios with only url field
      if (!radio.filePath && radio.url) {
        return res.json({ signedUrl: radio.url });
      }
      
      // Generate fresh signed URL for new uploads
      if (radio.filePath && supabaseStorage.isStorageConfigured()) {
        const signedUrl = await supabaseStorage.getSignedUrl(radio.filePath);
        return res.json({ signedUrl });
      }
      
      res.status(400).json({ error: "No file associated with this radio" });
    } catch (error) {
      console.error("Error getting signed URL:", error);
      res.status(500).json({ error: "Failed to get signed URL" });
    }
  });

  // Get all radios for a patient (signed URLs fetched on-demand)
  app.get("/api/patients/:patientId/radios", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const radios = await storage.getPatientRadios(organisationId, req.params.patientId);
      
      // OPTIMIZATION: Don't generate signed URLs upfront
      // Frontend fetches them on-demand via /api/radios/:id/url endpoint
      res.json(radios.map(r => ({ ...r, signedUrl: null })));
    } catch (error) {
      console.error("Error fetching patient radios:", error);
      res.status(500).json({ error: "Failed to fetch radios" });
    }
  });

  app.post("/api/radios", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.userId;

    try {
      const data = insertRadioSchema.parse(req.body);
      const radioData = {
        ...data,
        createdBy: userId || null,
      };
      const radio = await storage.createRadio(organisationId, radioData);
      
      // Send notification about new radio to other team members
      if (userId && data.patientId) {
        const patient = await storage.getPatient(organisationId, data.patientId);
        const patientName = patient ? `${patient.prenom} ${patient.nom}` : "Patient";
        const orgUsers = await storage.getUsersByOrganisation(organisationId);
        
        // Notify all other users in the organization
        for (const user of orgUsers) {
          if (user.id !== userId) {
            notificationService.notificationEvents.onRadioAdded({
              organisationId,
              recipientUserId: user.id,
              actorUserId: userId,
              patientId: data.patientId,
              patientName,
              radioType: data.type,
            }).catch(err => console.error("[Notification] Radio added notification failed:", err));
          }
        }
      }
      
      res.status(201).json(radio);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating radio:", error);
      res.status(500).json({ error: "Failed to create radio" });
    }
  });

  app.patch("/api/radios/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { title } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }
      const radio = await storage.updateRadio(organisationId, req.params.id, { title });
      if (!radio) {
        return res.status(404).json({ error: "Radio not found" });
      }
      res.json(radio);
    } catch (error) {
      console.error("Error updating radio:", error);
      res.status(500).json({ error: "Failed to update radio" });
    }
  });

  app.delete("/api/radios/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Get radio to find file path for deletion
      const radio = await storage.getRadio(organisationId, req.params.id);
      if (!radio) {
        return res.status(404).json({ error: "Radio not found" });
      }

      // Delete from Supabase Storage if configured
      if (radio.filePath && supabaseStorage.isStorageConfigured()) {
        try {
          await supabaseStorage.deleteFile(radio.filePath);
        } catch (err) {
          console.error("Failed to delete file from storage:", err);
          // Continue to delete database record even if storage deletion fails
        }
      }

      // Delete from database
      const deleted = await storage.deleteRadio(organisationId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Radio not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting radio:", error);
      res.status(500).json({ error: "Failed to delete radio" });
    }
  });

  // ========== RADIO NOTES ==========
  app.get("/api/radios/:radioId/notes", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const notes = await storage.getRadioNotes(organisationId, req.params.radioId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching radio notes:", error);
      res.status(500).json({ error: "Failed to fetch radio notes" });
    }
  });

  app.post("/api/radios/:radioId/notes", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User ID required" });
    }

    try {
      const { body } = req.body;
      if (!body || typeof body !== "string" || body.trim().length === 0) {
        return res.status(400).json({ error: "body is required" });
      }
      const note = await storage.createRadioNote(organisationId, userId, req.params.radioId, body.trim());
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating radio note:", error);
      res.status(500).json({ error: "Failed to create radio note" });
    }
  });

  app.patch("/api/radios/:radioId/notes/:noteId", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { body } = req.body;
      if (!body || typeof body !== "string" || body.trim().length === 0) {
        return res.status(400).json({ error: "body is required" });
      }
      const note = await storage.updateRadioNote(organisationId, req.params.noteId, body.trim());
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error updating radio note:", error);
      res.status(500).json({ error: "Failed to update radio note" });
    }
  });

  app.delete("/api/radios/:radioId/notes/:noteId", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const deleted = await storage.deleteRadioNote(organisationId, req.params.noteId);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting radio note:", error);
      res.status(500).json({ error: "Failed to delete radio note" });
    }
  });

  // ========== IMPLANT STATUS REASONS ==========
  app.get("/api/status-reasons", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const status = req.query.status as 'SUCCES' | 'COMPLICATION' | 'ECHEC' | undefined;
      const reasons = await storage.getStatusReasons(organisationId, status);
      res.json(reasons);
    } catch (error) {
      console.error("Error fetching status reasons:", error);
      res.status(500).json({ error: "Failed to fetch status reasons" });
    }
  });

  app.post("/api/status-reasons", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { status, code, label } = req.body;
      if (!status || !code || !label) {
        return res.status(400).json({ error: "status, code, and label are required" });
      }
      if (!['SUCCES', 'COMPLICATION', 'ECHEC'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      const reason = await storage.createStatusReason(organisationId, { status, code, label });
      res.status(201).json(reason);
    } catch (error) {
      console.error("Error creating status reason:", error);
      res.status(500).json({ error: "Failed to create status reason" });
    }
  });

  // ========== IMPLANT STATUS HISTORY ==========
  app.get("/api/surgery-implants/:implantId/status-history", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const history = await storage.getImplantStatusHistory(organisationId, req.params.implantId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching implant status history:", error);
      res.status(500).json({ error: "Failed to fetch status history" });
    }
  });

  app.post("/api/surgery-implants/:implantId/status", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User ID required" });
    }

    try {
      const { toStatus, fromStatus, reasonId, reasonFreeText, evidence } = req.body;
      if (!toStatus || !['EN_SUIVI', 'SUCCES', 'COMPLICATION', 'ECHEC'].includes(toStatus)) {
        return res.status(400).json({ error: "Valid toStatus is required" });
      }
      const history = await storage.changeImplantStatus(organisationId, {
        implantId: req.params.implantId,
        fromStatus,
        toStatus,
        reasonId,
        reasonFreeText,
        evidence,
        changedByUserId: userId,
      });
      res.status(201).json(history);
    } catch (error) {
      console.error("Error changing implant status:", error);
      res.status(500).json({ error: "Failed to change implant status" });
    }
  });

  // ========== IMPLANT STATUS SUGGESTIONS (MVP Rules) ==========
  app.get("/api/surgery-implants/:implantId/status-suggestions", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const implantId = req.params.implantId;
      // Fetch surgery implant with ISQ data
      const implant = await storage.getSurgeryImplant(organisationId, implantId);
      if (!implant) {
        return res.status(404).json({ error: "Implant not found" });
      }

      // Fetch status history and measurements to check for applied suggestions
      const [statusHistory, measurements] = await Promise.all([
        storage.getImplantStatusHistory(organisationId, implantId),
        storage.getImplantMeasurements(organisationId, implantId),
      ]);

      // Get last status change date and last ISQ measurement date
      const lastStatusChange = statusHistory.length > 0 ? new Date(statusHistory[0].changedAt) : null;
      const lastMeasurement = measurements.length > 0 ? new Date(measurements[0].measuredAt) : null;

      // Check if suggestion should be hidden (applied after last ISQ)
      const isSuggestionApplied = (suggestedStatus: string): boolean => {
        if (!lastStatusChange) return false;
        // If current status matches suggestion and status was changed after last ISQ, hide it
        // If no measurement exists, show the suggestion (can't compare without ISQ data)
        if (implant.statut === suggestedStatus && lastMeasurement) {
          return lastStatusChange > lastMeasurement;
        }
        return false;
      };

      const suggestions: Array<{
        status: 'SUCCES' | 'COMPLICATION' | 'ECHEC';
        confidence: 'HIGH' | 'MEDIUM' | 'LOW';
        rule: string;
        reasonCode?: string;
      }> = [];

      // MVP Rules based on ISQ values
      const isqValues: number[] = [];
      if (implant.isqPose !== null && implant.isqPose !== undefined) isqValues.push(implant.isqPose);
      if (implant.isq2m !== null && implant.isq2m !== undefined) isqValues.push(implant.isq2m);
      if (implant.isq3m !== null && implant.isq3m !== undefined) isqValues.push(implant.isq3m);
      if (implant.isq6m !== null && implant.isq6m !== undefined) isqValues.push(implant.isq6m);

      const latestIsq = isqValues.length > 0 ? isqValues[isqValues.length - 1] : null;
      const poseIsq = implant.isqPose;
      const isq6m = implant.isq6m;

      // Rule 1: ISQ 6 mois >= 70 -> SUCCES (HIGH confidence)
      if (isq6m !== null && isq6m !== undefined && isq6m >= 70) {
        suggestions.push({
          status: 'SUCCES',
          confidence: 'HIGH',
          rule: 'ISQ à 6 mois ≥ 70',
          reasonCode: 'OSTEOINTEGRATION_OK',
        });
      }

      // Rule 2: ISQ stable and >= 60 at 3 months -> SUCCES (MEDIUM confidence)
      if (!isq6m && implant.isq3m !== null && implant.isq3m !== undefined && implant.isq3m >= 60) {
        if (poseIsq !== null && poseIsq !== undefined && implant.isq3m >= poseIsq - 5) {
          suggestions.push({
            status: 'SUCCES',
            confidence: 'MEDIUM',
            rule: 'ISQ stable à 3 mois (≥ 60, pas de chute > 5)',
            reasonCode: 'OSTEOINTEGRATION_OK',
          });
        }
      }

      // Rule 3: ISQ drop > 15 points -> COMPLICATION (HIGH confidence)
      if (isqValues.length >= 2) {
        const maxDrop = Math.max(...isqValues.slice(0, -1)) - (latestIsq ?? 0);
        if (maxDrop > 15) {
          suggestions.push({
            status: 'COMPLICATION',
            confidence: 'HIGH',
            rule: 'Chute ISQ > 15 points',
            reasonCode: 'ISQ_DROP',
          });
        }
      }

      // Rule 4: Latest ISQ < 50 -> ECHEC (HIGH confidence)
      if (latestIsq !== null && latestIsq < 50) {
        suggestions.push({
          status: 'ECHEC',
          confidence: 'HIGH',
          rule: 'ISQ le plus récent < 50',
          reasonCode: 'DEPOSE',
        });
      }

      // Rule 5: Latest ISQ between 50-60 -> COMPLICATION (MEDIUM confidence)
      if (latestIsq !== null && latestIsq >= 50 && latestIsq < 60) {
        suggestions.push({
          status: 'COMPLICATION',
          confidence: 'MEDIUM',
          rule: 'ISQ entre 50-60 (ostéointégration insuffisante)',
          reasonCode: 'ISQ_DROP',
        });
      }

      // Filter out suggestions that have been applied and no new ISQ since
      const filteredSuggestions = suggestions.filter(s => !isSuggestionApplied(s.status));

      res.json({
        implantId,
        currentStatus: implant.statut,
        latestIsq,
        isqHistory: { pose: poseIsq, m2: implant.isq2m, m3: implant.isq3m, m6: isq6m },
        suggestions: filteredSuggestions,
      });
    } catch (error) {
      console.error("Error generating status suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // ========== DOCUMENTS (PDF) ==========
  // NOTE: /api/documents/* routes are now handled by the modular Documents router
  // mounted above via app.use("/api/documents", documentsRouter).
  // TODO: Remove deprecated routes and migrate /api/files, /api/patients/:patientId/documents
  
  // DEPRECATED: All /api/documents/* routes below are disabled - module handles them
  if (false) {
  app.get("/api/documents/tree", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const tree = await storage.getDocumentTree(organisationId);
      res.json(tree);
    } catch (error) {
      console.error("Error fetching document tree:", error);
      res.status(500).json({ error: "Failed to fetch document tree" });
    }
  });

  // Get filtered/paginated documents list (legacy - documents only)
  app.get("/api/documents", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const filters = {
        scope: req.query.scope as 'patients' | 'operations' | 'unclassified' | 'all' | undefined,
        patientId: req.query.patientId as string | undefined,
        operationId: req.query.operationId as string | undefined,
        q: req.query.q as string | undefined,
        tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string]) : undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        sort: req.query.sort as 'name' | 'date' | 'type' | 'size' | undefined,
        sortDir: req.query.sortDir as 'asc' | 'desc' | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };
      
      const result = await storage.getDocumentsFiltered(organisationId, filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });
  } // End of first deprecated block

  // Get unified files list (documents + radios combined) - KEEP ACTIVE
  app.get("/api/files", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const filters = {
        scope: req.query.scope as 'patients' | 'operations' | 'unclassified' | 'all' | undefined,
        patientId: req.query.patientId as string | undefined,
        operationId: req.query.operationId as string | undefined,
        q: req.query.q as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        sort: req.query.sort as 'name' | 'date' | 'type' | 'size' | undefined,
        sortDir: req.query.sortDir as 'asc' | 'desc' | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      };
      
      const result = await storage.getUnifiedFiles(organisationId, filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching unified files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // DEPRECATED: Continue disabling /api/documents routes
  if (false) {
  // Get signed upload URL for client-side document upload
  app.post("/api/documents/upload-url", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId, operationId, fileName, mimeType } = req.body;
      if (!fileName) {
        return res.status(400).json({ error: "fileName is required" });
      }

      // Generate unique document ID
      const documentId = crypto.randomUUID();
      
      // Generate file path based on context
      let filePath: string;
      if (patientId) {
        filePath = `org/${organisationId}/patients/${patientId}/documents/${documentId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      } else {
        filePath = `org/${organisationId}/documents/${documentId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      }

      // Get signed upload URL from Supabase
      const { signedUrl, token, path } = await supabaseStorage.createSignedUploadUrl(filePath);

      res.json({
        documentId,
        signedUrl,
        token,
        filePath: path,
        patientId: patientId || null,
        operationId: operationId || null,
      });
    } catch (error) {
      console.error("Error getting document upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });
  } // End of second deprecated block

  // Get all documents for a patient (signed URLs fetched on-demand) - KEEP ACTIVE
  app.get("/api/patients/:patientId/documents", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const docs = await storage.getPatientDocuments(organisationId, req.params.patientId);
      
      // OPTIMIZATION: Don't generate signed URLs upfront
      // Frontend fetches them on-demand via /api/documents/:id/signed-url endpoint
      res.json(docs.map(doc => ({ ...doc, signedUrl: null })));
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // DEPRECATED: Continue disabling remaining /api/documents routes
  if (false) {
  // Get single document with fresh signed URL
  app.get("/api/documents/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const doc = await storage.getDocument(organisationId, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      let signedUrl: string | null = null;
      if (doc.filePath && supabaseStorage.isStorageConfigured()) {
        try {
          signedUrl = await supabaseStorage.getSignedUrl(doc.filePath);
        } catch (err) {
          console.error("Failed to get signed URL:", err);
        }
      }
      
      res.json({ ...doc, signedUrl });
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Get fresh signed URL for a specific document
  app.get("/api/documents/:id/signed-url", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const doc = await storage.getDocument(organisationId, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (doc.filePath && supabaseStorage.isStorageConfigured()) {
        const signedUrl = await supabaseStorage.getSignedUrl(doc.filePath);
        return res.json({ signedUrl });
      }
      
      res.status(400).json({ error: "No file associated with this document" });
    } catch (error) {
      console.error("Error getting document signed URL:", error);
      res.status(500).json({ error: "Failed to get signed URL" });
    }
  });

  // Proxy endpoint to serve document file (bypasses CORS/CSP restrictions)
  app.get("/api/documents/:id/file", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const doc = await storage.getDocument(organisationId, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!doc.filePath || !supabaseStorage.isStorageConfigured()) {
        return res.status(400).json({ error: "No file associated with this document" });
      }

      // Get signed URL and fetch the file
      const signedUrl = await supabaseStorage.getSignedUrl(doc.filePath);
      const response = await fetch(signedUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Set appropriate headers for inline PDF viewing
      res.setHeader("Content-Type", doc.mimeType || "application/pdf");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Content-Disposition", `inline; filename="${doc.fileName || 'document.pdf'}"`);
      // Allow embedding in iframes from same origin
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
      
      res.send(buffer);
    } catch (error) {
      console.error("Error proxying document file:", error);
      res.status(500).json({ error: "Failed to fetch document file" });
    }
  });

  // Create document record (after successful upload)
  app.post("/api/documents", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = insertDocumentSchema.parse(req.body);
      const userId = req.jwtUser?.userId || null;
      const doc = await storage.createDocument(organisationId, { ...data, createdBy: userId });
      
      // Send notification about new document to other team members
      if (userId) {
        const orgUsers = await storage.getUsersByOrganisation(organisationId);
        
        for (const user of orgUsers) {
          if (user.id !== userId) {
            notificationService.notificationEvents.onDocumentUploaded({
              organisationId,
              recipientUserId: user.id,
              actorUserId: userId,
              documentId: doc.id,
              documentName: doc.title || doc.fileName,
              patientId: doc.patientId || undefined,
            }).catch(err => console.error("[Notification] Document uploaded notification failed:", err));
          }
        }
      }
      
      res.status(201).json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating document:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Update document (title, tags)
  app.patch("/api/documents/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const updates = updateDocumentSchema.parse(req.body);
      const doc = await storage.updateDocument(organisationId, req.params.id, updates);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating document:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Get document to find file path for deletion
      const doc = await storage.getDocument(organisationId, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Delete from Supabase Storage
      if (doc.filePath && supabaseStorage.isStorageConfigured()) {
        try {
          await supabaseStorage.deleteFile(doc.filePath);
        } catch (err) {
          console.error("Failed to delete document from storage:", err);
        }
      }

      // Delete from database
      const deleted = await storage.deleteDocument(organisationId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });
  } // End of third deprecated block - all /api/documents routes now disabled

  // ========== VISITES ==========
  app.get("/api/implants/:id/visites", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const visites = await storage.getImplantVisites(organisationId, req.params.id);
      res.json(visites);
    } catch (error) {
      console.error("Error fetching visites:", error);
      res.status(500).json({ error: "Failed to fetch visites" });
    }
  });

  app.post("/api/visites", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = insertVisiteSchema.parse(req.body);
      const visite = await storage.createVisite(organisationId, data);
      
      // Sync ISQ to surgery_implant and trigger flag detection
      if (data.isq !== null && data.isq !== undefined) {
        const surgeryImplantId = await storage.findSurgeryImplantForVisite(
          organisationId, 
          data.implantId, 
          data.patientId
        );
        
        if (surgeryImplantId) {
          // Get previous ISQ before syncing
          const previousVisites = await storage.getImplantVisites(organisationId, data.implantId);
          const sortedVisites = previousVisites
            .filter(v => v.isq !== null && v.id !== visite.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const previousIsq = sortedVisites.length > 0 ? sortedVisites[0].isq : null;
          
          await storage.syncVisiteIsqToSurgeryImplant(
            organisationId, 
            surgeryImplantId, 
            data.isq, 
            data.date
          );
          
          // Trigger flag detection asynchronously
          runFlagDetection(organisationId).catch(err => 
            console.error("Flag detection failed after visite ISQ sync:", err)
          );
          console.log(`[VISITE-ISQ] Synced ISQ=${data.isq} to surgery_implant=${surgeryImplantId}`);
          
          const userId = req.jwtUser?.userId;
          
          // Send notification for low ISQ (< 60)
          if (data.isq < 60 && userId) {
            notificationService.createNotification({
              organisationId,
              recipientUserId: userId,
              kind: "ALERT",
              type: "ISQ_LOW",
              severity: data.isq < 50 ? "CRITICAL" : "WARNING",
              title: `ISQ faible detecte: ${data.isq}`,
              body: `L'implant sur le site a un ISQ de ${data.isq}, ce qui est en dessous du seuil recommande.`,
              entityType: "IMPLANT",
              entityId: surgeryImplantId,
              dedupeKey: `isq_low_${surgeryImplantId}_${data.isq}`,
            }).catch(err => console.error("[Notification] ISQ_LOW notification failed:", err));
          }
          
          // Check for significant ISQ drop (10+ points)
          if (previousIsq !== null && userId) {
            const isqDrop = previousIsq - data.isq;
            if (isqDrop >= 10) {
              const patient = await storage.getPatient(organisationId, data.patientId);
              const patientName = patient ? `${patient.prenom} ${patient.nom}` : "Patient";
              const surgeryImplant = await storage.getSurgeryImplant(organisationId, surgeryImplantId);
              const implantSite = surgeryImplant?.siteFdi || "inconnu";
              
              notificationService.notificationEvents.onIsqDeclining({
                organisationId,
                recipientUserId: userId,
                patientId: data.patientId,
                patientName,
                implantSite,
                previousIsq,
                currentIsq: data.isq,
                drop: isqDrop,
              }).catch(err => console.error("[Notification] ISQ_DECLINING notification failed:", err));
            }
            
            // Check for unstable ISQ history (3+ consecutive low ISQs)
            const recentIsqValues = sortedVisites.slice(0, 3).map(v => v.isq as number);
            recentIsqValues.unshift(data.isq);
            const lowIsqCount = recentIsqValues.filter(v => v < 60).length;
            
            if (lowIsqCount >= 3) {
              const patient = await storage.getPatient(organisationId, data.patientId);
              const patientName = patient ? `${patient.prenom} ${patient.nom}` : "Patient";
              const surgeryImplant = await storage.getSurgeryImplant(organisationId, surgeryImplantId);
              const implantSite = surgeryImplant?.siteFdi || "inconnu";
              
              notificationService.notificationEvents.onUnstableIsqHistory({
                organisationId,
                recipientUserId: userId,
                patientId: data.patientId,
                patientName,
                implantSite,
                lowIsqCount,
                recentIsqValues: recentIsqValues.slice(0, lowIsqCount),
              }).catch(err => console.error("[Notification] UNSTABLE_ISQ notification failed:", err));
            }
          }
        }
      }
      
      res.status(201).json(visite);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating visite:", error);
      res.status(500).json({ error: "Failed to create visite" });
    }
  });

  // ========== PROTHESES ==========
  app.post("/api/protheses", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = insertProtheseSchema.parse(req.body);
      const prothese = await storage.createProthese(organisationId, data);
      res.status(201).json(prothese);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating prothese:", error);
      res.status(500).json({ error: "Erreur lors de la création de la prothèse" });
    }
  });

  app.get("/api/implants/:id/protheses", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const protheses = await storage.getImplantProtheses(organisationId, req.params.id);
      res.json(protheses);
    } catch (error) {
      console.error("Error fetching protheses:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des prothèses" });
    }
  });

  // ========== STATS ==========
  app.get("/api/stats", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const stats = await storage.getStats(organisationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/stats/advanced", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const stats = await storage.getAdvancedStats(organisationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching advanced stats:", error);
      res.status(500).json({ error: "Failed to fetch advanced stats" });
    }
  });

  app.get("/api/stats/clinical", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { from, to, implantModelId, patientIds, operationIds } = req.query;
      const dateFrom = from ? String(from) : undefined;
      const dateTo = to ? String(to) : undefined;
      const implantModel = implantModelId ? String(implantModelId) : undefined;
      const patientIdList = patientIds ? String(patientIds).split(",").filter(Boolean) : undefined;
      const operationIdList = operationIds ? String(operationIds).split(",").filter(Boolean) : undefined;
      const stats = await storage.getClinicalStats(organisationId, dateFrom, dateTo, implantModel, patientIdList, operationIdList);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching clinical stats:", error);
      res.status(500).json({ error: "Failed to fetch clinical stats" });
    }
  });

  app.get("/api/stats/patients", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const stats = await storage.getPatientStats(organisationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching patient stats:", error);
      res.status(500).json({ error: "Failed to fetch patient stats" });
    }
  });

  // Note: Legacy Replit Object Storage routes removed - using Supabase Storage now

  // ========== NOTES ==========
  app.get("/api/patients/:patientId/notes", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const notes = await storage.getPatientNotes(organisationId, patientId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/patients/:patientId/notes", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const userId = req.jwtUser?.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const noteData = insertNoteSchema.parse({ ...req.body, patientId });
      const note = await storage.createNote(organisationId, userId, noteData);
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const note = await storage.updateNote(organisationId, id, req.body);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const deleted = await storage.deleteNote(organisationId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // ========== RENDEZ-VOUS ==========
  app.get("/api/patients/:patientId/rendez-vous", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const rdvList = await storage.getPatientRendezVous(organisationId, patientId);
      res.json(rdvList);
    } catch (error) {
      console.error("Error fetching rendez-vous:", error);
      res.status(500).json({ error: "Failed to fetch rendez-vous" });
    }
  });

  app.post("/api/patients/:patientId/rendez-vous", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const rdvData = insertRendezVousSchema.parse({ ...req.body, patientId });
      const rdv = await storage.createRendezVous(organisationId, rdvData);
      res.status(201).json(rdv);
    } catch (error) {
      console.error("Error creating rendez-vous:", error);
      res.status(500).json({ error: "Failed to create rendez-vous" });
    }
  });

  app.patch("/api/rendez-vous/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const rdv = await storage.updateRendezVous(organisationId, id, req.body);
      if (!rdv) {
        return res.status(404).json({ error: "Rendez-vous not found" });
      }
      res.json(rdv);
    } catch (error) {
      console.error("Error updating rendez-vous:", error);
      res.status(500).json({ error: "Failed to update rendez-vous" });
    }
  });

  app.delete("/api/rendez-vous/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const deleted = await storage.deleteRendezVous(organisationId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Rendez-vous not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rendez-vous:", error);
      res.status(500).json({ error: "Failed to delete rendez-vous" });
    }
  });

  // ========== APPOINTMENTS (Unified RDV) ==========
  
  // Get all appointments for organisation (for dashboard)
  app.get("/api/appointments", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { status, withPatient } = req.query;
      if (withPatient === "true") {
        const appointmentsList = await storage.getAllAppointmentsWithPatient(organisationId, status as string);
        res.json(appointmentsList);
      } else {
        const appointmentsList = await storage.getAllAppointments(organisationId, status as string);
        res.json(appointmentsList);
      }
    } catch (error) {
      console.error("Error fetching all appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });
  
  // Get calendar appointments with date range filtering
  app.get("/api/appointments/calendar", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { start, end, types, statuses, patientId, operationId } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ error: "start and end date parameters are required" });
      }
      
      const filters = {
        start: start as string,
        end: end as string,
        types: types ? (Array.isArray(types) ? types as string[] : [types as string]) : undefined,
        statuses: statuses ? (Array.isArray(statuses) ? statuses as string[] : [statuses as string]) : undefined,
        patientId: patientId as string | undefined,
        operationId: operationId as string | undefined,
      };
      
      const appointmentsList = await storage.getCalendarAppointments(organisationId, filters);
      res.json(appointmentsList);
    } catch (error) {
      console.error("Error fetching calendar appointments:", error);
      res.status(500).json({ error: "Failed to fetch calendar appointments" });
    }
  });
  
  app.get("/api/patients/:patientId/appointments", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const { status } = req.query;
      
      let appointmentsList;
      if (status === "upcoming") {
        appointmentsList = await storage.getPatientUpcomingAppointments(organisationId, patientId);
      } else if (status === "completed") {
        appointmentsList = await storage.getPatientCompletedAppointments(organisationId, patientId);
      } else {
        appointmentsList = await storage.getPatientAppointments(organisationId, patientId);
      }
      res.json(appointmentsList);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const { details } = req.query;
      
      if (details === "true") {
        const appointment = await storage.getAppointmentWithDetails(organisationId, id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }
        res.json(appointment);
      } else {
        const appointment = await storage.getAppointment(organisationId, id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }
        res.json(appointment);
      }
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ error: "Failed to fetch appointment" });
    }
  });

  app.post("/api/patients/:patientId/appointments", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const appointmentData = insertAppointmentSchema.parse({ ...req.body, patientId });
      const appointment = await storage.createAppointment(organisationId, appointmentData);
      
      const userId = req.jwtUser?.userId;
      
      // If it's a future appointment, resolve the "NO_RECENT_APPOINTMENT" flag for this patient
      if (appointment.dateStart >= new Date() && userId) {
        const resolvedCount = await storage.resolveFlagByTypeAndPatient(
          organisationId, 
          "NO_RECENT_APPOINTMENT", 
          patientId, 
          userId
        );
        if (resolvedCount > 0) {
          console.log(`[APPOINTMENT] Resolved ${resolvedCount} NO_RECENT_APPOINTMENT flag(s) for patient ${patientId}`);
        }
      }
      
      // Send notification about new appointment
      if (userId) {
        notificationService.notificationEvents.onAppointmentCreated({
          organisationId,
          recipientUserId: userId,
          actorUserId: userId,
          appointmentId: appointment.id,
          appointmentDate: appointment.dateStart.toISOString(),
          patientId,
        }).catch(err => console.error("[Notification] Appointment created notification failed:", err));
      }
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const updateData = updateAppointmentSchema.parse(req.body) as Parameters<typeof storage.updateAppointment>[2];
      const appointment = await storage.updateAppointment(organisationId, id, updateData);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const deleted = await storage.deleteAppointment(organisationId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // Duplicate appointment
  app.post("/api/appointments/:id/duplicate", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const { dateStart, dateEnd } = req.body;
      
      // Get original appointment
      const original = await storage.getAppointmentById(organisationId, id);
      if (!original) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Create duplicate with new dates
      const duplicateData = {
        patientId: original.patientId,
        operationId: original.operationId,
        surgeryImplantId: original.surgeryImplantId,
        type: original.type,
        title: original.title,
        description: original.description,
        dateStart: dateStart ? new Date(dateStart) : original.dateStart,
        dateEnd: dateEnd ? new Date(dateEnd) : original.dateEnd,
        isq: original.isq,
        radioId: original.radioId,
      };
      
      const duplicate = await storage.createAppointment(organisationId, duplicateData);
      res.status(201).json(duplicate);
    } catch (error) {
      console.error("Error duplicating appointment:", error);
      res.status(500).json({ error: "Failed to duplicate appointment" });
    }
  });

  // Check for conflicts/overlaps
  app.get("/api/appointments/conflicts", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { start, end, excludeId } = req.query;
      if (!start || !end) {
        return res.status(400).json({ error: "start and end dates required" });
      }
      
      const conflicts = await storage.getAppointmentConflicts(
        organisationId,
        new Date(start as string),
        new Date(end as string),
        excludeId as string | undefined
      );
      res.json(conflicts);
    } catch (error) {
      console.error("Error checking conflicts:", error);
      res.status(500).json({ error: "Failed to check conflicts" });
    }
  });

  // ========== APPOINTMENT CLINICAL DATA ==========
  // GET clinical data for an appointment (implant, ISQ history, flags, suggestions)
  app.get("/api/appointments/:id/clinical", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const clinicalData = await storage.getAppointmentClinicalData(organisationId, id);
      if (!clinicalData) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(clinicalData);
    } catch (error) {
      console.error("Error fetching clinical data:", error);
      res.status(500).json({ error: "Failed to fetch clinical data" });
    }
  });

  // POST ISQ measurement for an appointment (upsert)
  app.post("/api/appointments/:id/isq", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id: appointmentId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { surgeryImplantId, isqValue, notes } = req.body;
      if (!surgeryImplantId || isqValue === undefined || isqValue === null) {
        return res.status(400).json({ error: "surgeryImplantId and isqValue are required" });
      }

      // Get appointment to determine measurement type
      const appointment = await storage.getAppointmentById(organisationId, appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Map appointment type to measurement type
      const measurementTypeMap: Record<string, 'POSE' | 'FOLLOW_UP' | 'CONTROL' | 'EMERGENCY'> = {
        'CHIRURGIE': 'POSE',
        'CONTROLE': 'CONTROL',
        'SUIVI': 'FOLLOW_UP',
        'URGENCE': 'EMERGENCY',
        'CONSULTATION': 'FOLLOW_UP',
        'AUTRE': 'FOLLOW_UP',
      };
      const measurementType = measurementTypeMap[appointment.type] || 'FOLLOW_UP';

      // Upsert the measurement
      const measurement = await storage.upsertImplantMeasurement(organisationId, {
        surgeryImplantId,
        appointmentId,
        type: measurementType,
        isqValue: Number(isqValue),
        notes: notes || null,
        measuredByUserId: userId,
        measuredAt: appointment.dateStart,
      });

      // Also update the appointment's ISQ field for backward compatibility
      await storage.updateAppointment(organisationId, appointmentId, { isq: Number(isqValue) });

      // Recalculate flags and get suggestions
      const flags = await storage.calculateIsqFlags(organisationId, surgeryImplantId);
      const suggestions = await storage.generateStatusSuggestions(organisationId, surgeryImplantId, flags);

      res.status(201).json({
        measurement,
        flags,
        suggestions,
      });
    } catch (error) {
      console.error("Error saving ISQ measurement:", error);
      res.status(500).json({ error: "Failed to save ISQ measurement" });
    }
  });

  // ========== APPOINTMENT RADIOS ==========
  // GET radios linked to an appointment
  app.get("/api/appointments/:id/radios", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const links = await storage.getAppointmentRadios(organisationId, id);
      
      // Get full radio details for each link
      const radiosWithDetails = await Promise.all(
        links.map(async (link) => {
          const radio = await storage.getRadio(organisationId, link.radioId);
          return { ...link, radio };
        })
      );
      
      res.json(radiosWithDetails);
    } catch (error) {
      console.error("Error fetching appointment radios:", error);
      res.status(500).json({ error: "Failed to fetch appointment radios" });
    }
  });

  // POST link a radio to an appointment
  app.post("/api/appointments/:id/radios", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
      const { id: appointmentId } = req.params;
      const { radioId, notes } = req.body;

      if (!radioId) {
        return res.status(400).json({ error: "radioId is required" });
      }

      // Verify appointment exists
      const appointment = await storage.getAppointmentById(organisationId, appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Verify radio exists
      const radio = await storage.getRadio(organisationId, radioId);
      if (!radio) {
        return res.status(404).json({ error: "Radio not found" });
      }

      const link = await storage.linkRadioToAppointment(organisationId, appointmentId, radioId, userId, notes);
      res.status(201).json({ ...link, radio });
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Radio already linked to this appointment" });
      }
      console.error("Error linking radio to appointment:", error);
      res.status(500).json({ error: "Failed to link radio to appointment" });
    }
  });

  // DELETE unlink a radio from an appointment
  app.delete("/api/appointments/:id/radios/:radioId", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id: appointmentId, radioId } = req.params;
      const deleted = await storage.unlinkRadioFromAppointment(organisationId, appointmentId, radioId);
      if (!deleted) {
        return res.status(404).json({ error: "Link not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking radio from appointment:", error);
      res.status(500).json({ error: "Failed to unlink radio from appointment" });
    }
  });

  // ========== SAVED FILTERS ==========
  app.get("/api/saved-filters/:pageType", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { pageType } = req.params;
      const validPageTypes = savedFilterPageTypeEnum.enumValues;
      if (!validPageTypes.includes(pageType as typeof validPageTypes[number])) {
        return res.status(400).json({ error: "Invalid page type" });
      }
      const filters = await storage.getSavedFilters(organisationId, pageType as typeof validPageTypes[number]);
      res.json(filters);
    } catch (error) {
      console.error("Error fetching saved filters:", error);
      res.status(500).json({ error: "Failed to fetch saved filters" });
    }
  });

  app.post("/api/saved-filters", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const filterData = insertSavedFilterSchema.parse(req.body);
      const filter = await storage.createSavedFilter(organisationId, filterData);
      res.status(201).json(filter);
    } catch (error) {
      console.error("Error creating saved filter:", error);
      res.status(500).json({ error: "Failed to create saved filter" });
    }
  });

  app.delete("/api/saved-filters/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const deleted = await storage.deleteSavedFilter(organisationId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Saved filter not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved filter:", error);
      res.status(500).json({ error: "Failed to delete saved filter" });
    }
  });

  // ========== FLAGS ==========
  app.get("/api/flags", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const includeResolved = req.query.includeResolved === "true";
      const withEntity = req.query.withEntity === "true";
      
      if (withEntity) {
        const flags = await storage.getFlagsWithEntity(organisationId, includeResolved);
        res.json(flags);
      } else {
        const flags = await storage.getFlags(organisationId, includeResolved);
        res.json(flags);
      }
    } catch (error) {
      console.error("Error fetching flags:", error);
      res.status(500).json({ error: "Failed to fetch flags" });
    }
  });

  app.get("/api/patients/:patientId/flags", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId } = req.params;
      const flagsData = await storage.getPatientAllFlags(organisationId, patientId);
      res.json(flagsData);
    } catch (error) {
      console.error("Error fetching patient flags:", error);
      res.status(500).json({ error: "Failed to fetch patient flags" });
    }
  });

  app.get("/api/flags/:entityType/:entityId", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { entityType, entityId } = req.params;
      const flags = await storage.getEntityFlags(organisationId, entityType, entityId);
      res.json(flags);
    } catch (error) {
      console.error("Error fetching entity flags:", error);
      res.status(500).json({ error: "Failed to fetch entity flags" });
    }
  });

  app.post("/api/flags", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const flagData = insertFlagSchema.parse(req.body);
      const flag = await storage.createFlag(organisationId, flagData);
      res.status(201).json(flag);
    } catch (error) {
      console.error("Error creating flag:", error);
      res.status(500).json({ error: "Failed to create flag" });
    }
  });

  app.patch("/api/flags/:id/resolve", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const userId = req.jwtUser?.id;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      const flag = await storage.resolveFlag(organisationId, id, userId);
      if (!flag) {
        return res.status(404).json({ error: "Flag not found" });
      }
      res.json(flag);
    } catch (error) {
      console.error("Error resolving flag:", error);
      res.status(500).json({ error: "Failed to resolve flag" });
    }
  });

  app.delete("/api/flags/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { id } = req.params;
      const deleted = await storage.deleteFlag(organisationId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Flag not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting flag:", error);
      res.status(500).json({ error: "Failed to delete flag" });
    }
  });

  app.post("/api/flags/detect", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const result = await runFlagDetection(organisationId);
      res.json({ 
        success: true,
        created: result.created,
        existing: result.existing,
        resolved: result.resolved,
        message: `Détection terminée: ${result.created} nouveaux flags, ${result.existing} existants, ${result.resolved} résolus`
      });
    } catch (error) {
      console.error("Error running flag detection:", error);
      res.status(500).json({ error: "Failed to run flag detection" });
    }
  });

  // ============================================
  // Google Calendar Integration Routes - OAuth 2.0
  // Multi-tenant: Each organization stores their own OAuth tokens
  // ============================================

  // Admin-only endpoint to check environment configuration
  app.get("/api/integrations/google/env-check", requireJwtOrSession, async (req, res) => {
    // Check for admin role
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const envCheck = googleCalendar.checkEnvVariables();
    res.json(envCheck);
  });

  // Initiate OAuth flow - redirects to Google consent screen
  app.get("/api/integrations/google/connect", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      if (!googleCalendar.isConfigured()) {
        return res.status(500).json({ 
          error: "Google OAuth non configuré. Contactez l'administrateur." 
        });
      }

      const authUrl = googleCalendar.generateAuthUrl(organisationId);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to initiate OAuth" });
    }
  });

  // OAuth callback - handles the redirect from Google
  app.get("/api/integrations/google/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const baseUrl = process.env.APP_BASE_URL || '';

    if (oauthError) {
      console.error("OAuth error:", oauthError);
      return res.redirect(`${baseUrl}/settings/integrations/google-calendar?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${baseUrl}/settings/integrations/google-calendar?error=missing_params`);
    }

    // Verify signed state
    const stateData = googleCalendar.verifySignedState(state as string);
    if (!stateData) {
      return res.redirect(`${baseUrl}/settings/integrations/google-calendar?error=invalid_state`);
    }

    const { organisationId } = stateData;

    try {
      // Exchange code for tokens
      const tokens = await googleCalendar.exchangeCodeForTokens(code as string);

      // Store or update integration with tokens
      let integration = await storage.getCalendarIntegration(organisationId);

      if (integration) {
        await storage.updateCalendarIntegration(organisationId, integration.id, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
          providerUserEmail: tokens.email,
          isEnabled: true,
        });
      } else {
        await storage.createCalendarIntegration(organisationId, {
          organisationId,
          userId: null,
          provider: "google",
          isEnabled: true,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
          providerUserEmail: tokens.email,
        });
      }

      res.redirect(`${baseUrl}/settings/integrations/google-calendar?connected=1`);
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect(`${baseUrl}/settings/integrations/google-calendar?error=token_exchange_failed`);
    }
  });

  app.get("/api/integrations/google/status", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const integration = await storage.getCalendarIntegration(organisationId);
      const status = await googleCalendar.getGoogleCalendarStatus(integration || null);
      
      res.json({
        connected: status.connected,
        configured: status.configured,
        email: integration?.providerUserEmail || undefined,
        error: status.error,
        integration: integration ? {
          id: integration.id,
          isEnabled: integration.isEnabled,
          targetCalendarId: integration.targetCalendarId,
          targetCalendarName: integration.targetCalendarName,
          lastSyncAt: integration.lastSyncAt,
          syncErrorCount: integration.syncErrorCount,
          lastSyncError: integration.lastSyncError,
        } : null,
      });
    } catch (error: any) {
      console.error("Error getting Google status:", error);
      res.json({ connected: false, configured: googleCalendar.isConfigured(), error: error.message });
    }
  });

  app.get("/api/integrations/google/calendars", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const integration = await storage.getCalendarIntegration(organisationId);
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }
      const { calendars, refreshedTokens } = await googleCalendar.listCalendars(integration);
      
      // Persist refreshed tokens if any
      if (refreshedTokens) {
        await storage.updateCalendarIntegration(organisationId, integration.id, {
          accessToken: refreshedTokens.accessToken,
          tokenExpiresAt: refreshedTokens.expiresAt,
        });
      }
      
      res.json(calendars);
    } catch (error: any) {
      console.error("Error listing calendars:", error);
      res.status(500).json({ error: error.message || "Failed to list calendars" });
    }
  });

  app.patch("/api/integrations/google/settings", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { isEnabled, targetCalendarId, targetCalendarName, importEnabled, sourceCalendarId, sourceCalendarName } = req.body;
      
      let integration = await storage.getCalendarIntegration(organisationId);
      
      if (!integration) {
        return res.status(404).json({ error: "No integration found. Please connect first." });
      }

      integration = await storage.updateCalendarIntegration(organisationId, integration.id, {
        isEnabled: isEnabled ?? integration.isEnabled,
        targetCalendarId: targetCalendarId !== undefined ? targetCalendarId : integration.targetCalendarId,
        targetCalendarName: targetCalendarName !== undefined ? targetCalendarName : integration.targetCalendarName,
        importEnabled: importEnabled !== undefined ? importEnabled : integration.importEnabled,
        sourceCalendarId: sourceCalendarId !== undefined ? sourceCalendarId : integration.sourceCalendarId,
        sourceCalendarName: sourceCalendarName !== undefined ? sourceCalendarName : integration.sourceCalendarName,
      });
      
      res.json(integration);
    } catch (error: any) {
      console.error("Error updating integration settings:", error);
      res.status(500).json({ error: error.message || "Failed to update settings" });
    }
  });

  // Disconnect Google Calendar integration (clear tokens)
  app.delete("/api/integrations/google/disconnect", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const integration = await storage.getCalendarIntegration(organisationId);
      
      if (!integration) {
        return res.status(404).json({ error: "No integration found" });
      }
      
      // Clear tokens but keep the record for settings
      await storage.updateCalendarIntegration(organisationId, integration.id, {
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        providerUserEmail: null,
        isEnabled: false,
      });
      
      res.json({ success: true, message: "Google Calendar disconnected" });
    } catch (error: any) {
      console.error("Error disconnecting integration:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect" });
    }
  });

  app.post("/api/integrations/google/sync-now", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    // Structured sync result
    interface SyncFailure { appointmentId: string; reason: string; googleCode?: string }
    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [] as SyncFailure[],
      total: 0,
    };

    console.log(`[SYNC] Starting sync for org=${organisationId}`);

    try {
      // Step 1: Get integration
      console.log(`[SYNC] Step 1: Fetching calendar integration`);
      const integration = await storage.getCalendarIntegration(organisationId);
      
      if (!integration) {
        console.log(`[SYNC] No integration found for org=${organisationId}`);
        return res.status(400).json({ 
          error: "INTEGRATION_NOT_FOUND",
          message: "Aucune intégration Google Calendar trouvée. Veuillez d'abord connecter votre compte Google.",
          step: "fetch_integration",
        });
      }

      if (!integration.isEnabled) {
        console.log(`[SYNC] Integration disabled for org=${organisationId}`);
        return res.status(400).json({ 
          error: "INTEGRATION_DISABLED",
          message: "L'intégration Google Calendar est désactivée.",
          step: "check_enabled",
        });
      }

      if (!integration.accessToken) {
        console.log(`[SYNC] No access token for org=${organisationId}`);
        return res.status(400).json({ 
          error: "NOT_CONNECTED",
          message: "Google Calendar n'est pas connecté. Veuillez vous reconnecter.",
          step: "check_tokens",
        });
      }

      if (!integration.refreshToken) {
        console.log(`[SYNC] No refresh token for org=${organisationId} - needs reconsent`);
        return res.status(400).json({ 
          error: "NEED_RECONSENT",
          message: "Le token de rafraîchissement est manquant. Veuillez déconnecter et reconnecter Google Calendar.",
          step: "check_refresh_token",
        });
      }

      const calendarId = integration.targetCalendarId || "primary";
      console.log(`[SYNC] Using calendarId=${calendarId}, lastSyncAt=${integration.lastSyncAt}`);

      // Step 2: Get appointments to sync
      console.log(`[SYNC] Step 2: Fetching appointments to sync`);
      const appointments = await storage.getAppointmentsForSync(organisationId, integration.lastSyncAt ?? undefined);
      result.total = appointments.length;
      console.log(`[SYNC] Found ${appointments.length} appointment(s) to sync`);

      if (appointments.length === 0) {
        console.log(`[SYNC] No appointments to sync`);
        await storage.updateIntegrationSyncStatus(organisationId, integration.id, {
          lastSyncAt: new Date(),
          syncErrorCount: 0,
          lastSyncError: null,
        });
        return res.json({ ...result, message: "Aucun rendez-vous à synchroniser" });
      }

      let lastPersistedToken = integration.accessToken;
      
      // Helper to persist refreshed tokens - stores every new token (handles multiple refreshes per sync)
      const persistRefreshedTokens = async (refreshedTokens?: { accessToken: string; expiresAt: Date }) => {
        if (refreshedTokens && refreshedTokens.accessToken !== lastPersistedToken) {
          lastPersistedToken = refreshedTokens.accessToken;
          console.log(`[SYNC] Token refreshed, persisting to database`);
          await storage.updateCalendarIntegration(organisationId, integration.id, {
            accessToken: refreshedTokens.accessToken,
            tokenExpiresAt: refreshedTokens.expiresAt,
          });
          // Update the integration object for subsequent calls
          integration.accessToken = refreshedTokens.accessToken;
          integration.tokenExpiresAt = refreshedTokens.expiresAt;
        }
      };

      // Step 3: Sync each appointment
      console.log(`[SYNC] Step 3: Syncing appointments one by one`);
      
      for (const apt of appointments) {
        const patient = apt.patient;
        const patientName = patient ? `${patient.prenom || ""} ${patient.nom || ""}`.trim() : "Patient inconnu";
        
        // Fail appointments without required data (don't skip - that's misleading)
        if (!apt.dateStart) {
          console.log(`[SYNC] Failing apt=${apt.id}: no dateStart`);
          result.failed++;
          result.failures.push({
            appointmentId: apt.id,
            reason: "Date de début manquante",
          });
          await storage.updateAppointmentSync(organisationId, apt.id, {
            syncStatus: "ERROR",
            syncError: "Date de début manquante",
          });
          continue;
        }

        try {
          const title = `[Cassius] ${apt.type} - ${patientName}`;
          const description = [
            `Rendez-vous Cassius`,
            `Type: ${apt.type}`,
            `Patient: ${patientName}`,
            apt.description ? `Notes: ${apt.description}` : null,
          ].filter(Boolean).join("\n");
          
          const startDate = new Date(apt.dateStart);
          const endDate = apt.dateEnd ? new Date(apt.dateEnd) : new Date(startDate.getTime() + 30 * 60 * 1000);

          if (apt.externalEventId) {
            // Check if event exists
            console.log(`[SYNC] Checking existing event apt=${apt.id}, eventId=${apt.externalEventId}`);
            const getResult = await googleCalendar.getCalendarEvent(integration, calendarId, apt.externalEventId);
            await persistRefreshedTokens(getResult.refreshedTokens);
            
            if (getResult.event) {
              // Update existing event
              console.log(`[SYNC] Updating event apt=${apt.id}`);
              const updateResult = await googleCalendar.updateCalendarEvent(integration, {
                calendarId,
                eventId: apt.externalEventId,
                summary: title,
                description,
                start: startDate,
                end: endDate,
                cassiusAppointmentId: apt.id,
              });
              await persistRefreshedTokens(updateResult.refreshedTokens);
              
              await storage.updateAppointmentSync(organisationId, apt.id, {
                syncStatus: "SYNCED",
                externalEtag: updateResult.etag,
                lastSyncedAt: new Date(),
                syncError: null,
              });
              result.updated++;
            } else {
              // Event was deleted, recreate
              console.log(`[SYNC] Event deleted, recreating apt=${apt.id}`);
              const createResult = await googleCalendar.createCalendarEvent(integration, {
                calendarId,
                summary: title,
                description,
                start: startDate,
                end: endDate,
                cassiusAppointmentId: apt.id,
              });
              await persistRefreshedTokens(createResult.refreshedTokens);
              
              await storage.updateAppointmentSync(organisationId, apt.id, {
                externalProvider: "google",
                externalCalendarId: calendarId,
                externalEventId: createResult.eventId,
                externalEtag: createResult.etag,
                syncStatus: "SYNCED",
                lastSyncedAt: new Date(),
                syncError: null,
              });
              result.created++;
            }
          } else {
            // Create new event
            console.log(`[SYNC] Creating new event apt=${apt.id}`);
            const createResult = await googleCalendar.createCalendarEvent(integration, {
              calendarId,
              summary: title,
              description,
              start: startDate,
              end: endDate,
              cassiusAppointmentId: apt.id,
            });
            await persistRefreshedTokens(createResult.refreshedTokens);
            
            await storage.updateAppointmentSync(organisationId, apt.id, {
              externalProvider: "google",
              externalCalendarId: calendarId,
              externalEventId: createResult.eventId,
              externalEtag: createResult.etag,
              syncStatus: "SYNCED",
              lastSyncedAt: new Date(),
              syncError: null,
            });
            result.created++;
          }
        } catch (error: any) {
          console.error(`[SYNC] Error syncing apt=${apt.id}:`, error);
          
          // Parse Google API error
          let reason = error.message || "Erreur inconnue";
          let googleCode: string | undefined;
          
          if (error.code) {
            googleCode = String(error.code);
            if (error.code === 401) {
              reason = "Token expiré ou invalide";
            } else if (error.code === 403) {
              reason = "Permissions insuffisantes sur le calendrier";
            } else if (error.code === 404) {
              reason = "Calendrier non trouvé";
            } else if (error.code === 429) {
              reason = "Limite de requêtes Google atteinte";
            }
          }
          
          await storage.updateAppointmentSync(organisationId, apt.id, {
            syncStatus: "ERROR",
            syncError: reason,
          });
          
          result.failed++;
          result.failures.push({
            appointmentId: apt.id,
            reason,
            googleCode,
          });
        }
      }

      // Step 4: Update integration status
      console.log(`[SYNC] Step 4: Updating integration status - created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);
      await storage.updateIntegrationSyncStatus(organisationId, integration.id, {
        lastSyncAt: new Date(),
        syncErrorCount: result.failed,
        lastSyncError: result.failed > 0 ? `${result.failed} rendez-vous en erreur` : null,
      });

      console.log(`[SYNC] Sync completed successfully`);
      res.json(result);
      
    } catch (error: any) {
      console.error(`[SYNC] Fatal error during sync:`, error);
      
      // Parse error for better response
      let errorCode = "SYNC_FAILED";
      let message = error.message || "Erreur lors de la synchronisation";
      let step = "unknown";
      let googleCode: string | undefined;
      
      if (error.code) {
        googleCode = String(error.code);
        if (error.code === 401) {
          errorCode = "TOKEN_INVALID";
          message = "Token d'accès invalide. Veuillez reconnecter Google Calendar.";
          step = "google_auth";
        } else if (error.code === 403) {
          errorCode = "INSUFFICIENT_PERMISSIONS";
          message = "Permissions insuffisantes. Veuillez reconnecter Google Calendar avec les bons scopes.";
          step = "google_auth";
        }
      }
      
      // Send sync error notification
      const userId = req.jwtUser?.userId;
      if (userId) {
        notificationService.notificationEvents.onSyncError({
          organisationId,
          recipientUserId: userId,
          integrationName: "Google Calendar",
          errorMessage: message,
        }).catch(err => console.error("[Notification] Sync error notification failed:", err));
      }
      
      res.status(500).json({ 
        error: errorCode,
        message,
        step,
        googleCode,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  // V2: Google Calendar Import (Google -> Cassius)
  
  // Helper: Check if V2 import tables exist
  const checkV2TablesExist = async (): Promise<boolean> => {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('google_calendar_events', 'sync_conflicts')
      `);
      const rows = result.rows as Array<{ count: string }>;
      return parseInt(rows[0]?.count || "0") === 2;
    } catch {
      return false;
    }
  };

  // GET /api/google/events - List events from Google Calendar
  app.get("/api/google/events", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const { calendarId, timeMin, timeMax } = req.query;
      
      if (!calendarId || !timeMin || !timeMax) {
        return res.status(400).json({ 
          error: "MISSING_PARAMS",
          message: "calendarId, timeMin et timeMax sont requis" 
        });
      }
      
      const integration = await storage.getCalendarIntegration(organisationId);
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ 
          error: "NOT_CONNECTED",
          message: "Google Calendar non connecté" 
        });
      }
      
      const result = await googleCalendar.listAllEvents(integration, {
        calendarId: String(calendarId),
        timeMin: String(timeMin),
        timeMax: String(timeMax),
      });
      
      // Update tokens if refreshed
      if (result.refreshedTokens) {
        await storage.updateCalendarIntegration(organisationId, integration.id, {
          accessToken: result.refreshedTokens.accessToken,
          tokenExpiresAt: result.refreshedTokens.expiresAt,
        });
      }
      
      res.json({
        events: result.events,
        count: result.events.length,
      });
      
    } catch (error: any) {
      console.error("[GOOGLE] Error listing events:", error);
      
      if (error.message === "SYNC_TOKEN_INVALID") {
        return res.status(400).json({
          error: "SYNC_TOKEN_INVALID",
          message: "Token de synchronisation invalide, import complet requis",
        });
      }
      
      res.status(500).json({ 
        error: "LIST_EVENTS_FAILED",
        message: error.message || "Erreur lors de la récupération des événements" 
      });
    }
  });
  
  // POST /api/google/import - Preview or import events
  app.post("/api/google/import", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      // Check if V2 tables exist
      const tablesExist = await checkV2TablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import Google Calendar ne sont pas disponibles. Exécutez la migration 20241230_005_google_events_import.sql sur Supabase."
        });
      }
      
      const { calendarId, timeMin, timeMax, mode = "preview" } = req.body;
      
      if (!calendarId || !timeMin || !timeMax) {
        return res.status(400).json({ 
          error: "MISSING_PARAMS",
          message: "calendarId, timeMin et timeMax sont requis" 
        });
      }
      
      if (mode !== "preview" && mode !== "import") {
        return res.status(400).json({
          error: "INVALID_MODE",
          message: "Le mode doit être 'preview' ou 'import'"
        });
      }
      
      const integration = await storage.getCalendarIntegration(organisationId);
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ 
          error: "NOT_CONNECTED",
          message: "Google Calendar non connecté" 
        });
      }
      
      console.log(`[IMPORT] Starting ${mode} for org=${organisationId}, calendar=${calendarId}, range=${timeMin} to ${timeMax}`);
      
      // Fetch events from Google
      const result = await googleCalendar.listAllEvents(integration, {
        calendarId: String(calendarId),
        timeMin: String(timeMin),
        timeMax: String(timeMax),
      });
      
      // Update tokens if refreshed
      if (result.refreshedTokens) {
        await storage.updateCalendarIntegration(organisationId, integration.id, {
          accessToken: result.refreshedTokens.accessToken,
          tokenExpiresAt: result.refreshedTokens.expiresAt,
        });
      }
      
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        cancelled: 0,
        failed: 0,
        conflicts: [] as Array<{ eventId: string; summary: string; reason: string }>,
        failures: [] as Array<{ eventId: string; reason: string }>,
      };
      
      // Filter out events created by Cassius (they have cassiusAppointmentId in extendedProperties)
      const externalEvents = result.events.filter(e => {
        // Skip if this is a Cassius-created event (has [Cassius] prefix)
        if (e.summary?.startsWith("[Cassius]")) {
          stats.skipped++;
          return false;
        }
        return true;
      });
      
      console.log(`[IMPORT] Found ${externalEvents.length} external events (skipped ${stats.skipped} Cassius events)`);
      
      if (mode === "preview") {
        // Just return preview without importing
        res.json({
          mode: "preview",
          total: externalEvents.length,
          events: externalEvents.map(e => ({
            id: e.id,
            summary: e.summary,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            status: e.status,
            location: e.location,
          })),
          skipped: stats.skipped,
        });
        return;
      }
      
      // Import mode: upsert events into google_calendar_events table
      for (const event of externalEvents) {
        if (!event.id || !event.start) {
          stats.failed++;
          stats.failures.push({ eventId: event.id || 'unknown', reason: 'ID ou date de début manquant' });
          continue;
        }
        
        try {
          if (event.status === 'cancelled') {
            // Mark as cancelled in DB
            await storage.upsertGoogleCalendarEvent(organisationId, {
              integrationId: integration.id,
              googleCalendarId: calendarId,
              googleEventId: event.id,
              etag: event.etag,
              status: 'cancelled',
              summary: event.summary,
              description: event.description,
              location: event.location,
              startAt: event.start,
              endAt: event.end,
              allDay: event.allDay,
              attendees: JSON.stringify(event.attendees),
              htmlLink: event.htmlLink,
              updatedAtGoogle: event.updated,
            });
            stats.cancelled++;
          } else {
            // Upsert event
            const { isNew } = await storage.upsertGoogleCalendarEvent(organisationId, {
              integrationId: integration.id,
              googleCalendarId: calendarId,
              googleEventId: event.id,
              etag: event.etag,
              status: event.status,
              summary: event.summary,
              description: event.description,
              location: event.location,
              startAt: event.start,
              endAt: event.end,
              allDay: event.allDay,
              attendees: JSON.stringify(event.attendees),
              htmlLink: event.htmlLink,
              updatedAtGoogle: event.updated,
            });
            
            if (isNew) {
              stats.created++;
            } else {
              stats.updated++;
            }
          }
        } catch (error: any) {
          console.error(`[IMPORT] Error importing event ${event.id}:`, error);
          stats.failed++;
          stats.failures.push({ eventId: event.id, reason: error.message });
        }
      }
      
      // Update import status
      await storage.updateCalendarIntegration(organisationId, integration.id, {
        lastImportAt: new Date(),
        sourceCalendarId: calendarId,
      });
      
      console.log(`[IMPORT] Completed: created=${stats.created}, updated=${stats.updated}, cancelled=${stats.cancelled}, skipped=${stats.skipped}, failed=${stats.failed}`);
      
      res.json({
        mode: "import",
        total: externalEvents.length,
        ...stats,
      });
      
    } catch (error: any) {
      console.error("[IMPORT] Fatal error:", error);
      
      res.status(500).json({ 
        error: "IMPORT_FAILED",
        step: "fetch_events",
        message: error.message || "Erreur lors de l'import" 
      });
    }
  });
  
  // GET /api/google/import/status - Get last import status
  app.get("/api/google/import/status", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const integration = await storage.getCalendarIntegration(organisationId);
      
      if (!integration) {
        return res.json({ 
          connected: false,
          importEnabled: false,
        });
      }
      
      // Get count of imported events
      const importedEvents = await storage.getGoogleCalendarEventsCount(organisationId);
      
      res.json({
        connected: !!integration.accessToken,
        importEnabled: integration.importEnabled || false,
        sourceCalendarId: integration.sourceCalendarId,
        sourceCalendarName: integration.sourceCalendarName,
        lastImportAt: integration.lastImportAt,
        importedEventsCount: importedEvents,
      });
      
    } catch (error: any) {
      console.error("[IMPORT] Error getting status:", error);
      res.status(500).json({ error: "Failed to get import status" });
    }
  });
  
  // GET /api/google/imported-events - Get imported Google events for calendar display
  app.get("/api/google/imported-events", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      // Check if V2 tables exist
      const tablesExist = await checkV2TablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import Google Calendar ne sont pas disponibles. Exécutez la migration 20241230_005_google_events_import.sql sur Supabase."
        });
      }
      
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ 
          error: "MISSING_PARAMS",
          message: "start et end sont requis" 
        });
      }
      
      const events = await storage.getGoogleCalendarEvents(
        organisationId,
        new Date(String(start)),
        new Date(String(end))
      );
      
      res.json(events);
      
    } catch (error: any) {
      console.error("[IMPORT] Error getting imported events:", error);
      res.status(500).json({ error: "Failed to get imported events" });
    }
  });
  
  // GET /api/sync/conflicts - Get sync conflicts
  app.get("/api/sync/conflicts", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      // Check if V2 tables exist
      const tablesExist = await checkV2TablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import Google Calendar ne sont pas disponibles. Exécutez la migration 20241230_005_google_events_import.sql sur Supabase."
        });
      }
      
      const { status = "open" } = req.query;
      const conflicts = await storage.getSyncConflicts(organisationId, String(status) as "open" | "resolved" | "ignored");
      res.json(conflicts);
    } catch (error: any) {
      console.error("[SYNC] Error getting conflicts:", error);
      res.status(500).json({ error: "Failed to get conflicts" });
    }
  });
  
  // PATCH /api/sync/conflicts/:id - Resolve a conflict
  app.patch("/api/sync/conflicts/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      // Check if V2 tables exist
      const tablesExist = await checkV2TablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import Google Calendar ne sont pas disponibles. Exécutez la migration 20241230_005_google_events_import.sql sur Supabase."
        });
      }
      
      const { id } = req.params;
      const { status, action } = req.body;
      
      if (!status || !["resolved", "ignored"].includes(status)) {
        return res.status(400).json({ 
          error: "INVALID_STATUS",
          message: "status doit être 'resolved' ou 'ignored'" 
        });
      }
      
      const userId = req.jwtUser?.id || null;
      await storage.resolveConflict(organisationId, id, status, userId);
      
      res.json({ success: true });
      
    } catch (error: any) {
      console.error("[SYNC] Error resolving conflict:", error);
      res.status(500).json({ error: "Failed to resolve conflict" });
    }
  });

  // ========================================
  // CSV Patient Import endpoints
  // ========================================
  
  const patientImport = await import("./patientImport");
  
  // Helper to check if import tables exist
  async function checkImportTablesExist(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'import_jobs'
        ) as exists
      `);
      return (result.rows[0] as any)?.exists === true;
    } catch {
      return false;
    }
  }
  
  // CSV template columns (in French)
  const CSV_TEMPLATE_COLUMNS = [
    "Nom",
    "Prénom", 
    "Numéro de dossier",
    "Numéro SS",
    "Date de naissance",
    "E-mail",
    "Téléphone",
    "Adresse",
    "Code postal",
    "Ville",
    "Pays"
  ];
  
  // GET /api/import/patients/template - Download CSV template
  app.get("/api/import/patients/template", requireJwtOrSession, (req, res) => {
    const variant = req.query.variant as string || "empty";
    
    const headers = CSV_TEMPLATE_COLUMNS.join(";");
    let content = headers + "\n";
    
    if (variant === "example") {
      content += "Dupont;Jean;P2024-001;1850175001234;15/03/1975;jean.dupont@email.com;0612345678;15 rue de la Paix;75001;Paris;France\n";
      content += "Martin;Marie;P2024-002;2880656789012;22/08/1988;marie.martin@email.com;0698765432;8 avenue Victor Hugo;69003;Lyon;France\n";
    }
    
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="modele_import_patients_${variant}.csv"`);
    res.send("\ufeff" + content); // BOM for Excel UTF-8 compatibility
  });
  
  // POST /api/import/patients/detect-headers - Detect CSV headers and suggest mapping
  app.post("/api/import/patients/detect-headers", requireJwtOrSession, async (req, res) => {
    try {
      const { jobId } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }
      
      const job = await patientImport.getImportJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      const csvContent = job.filePath || "";
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length === 0) {
        return res.status(400).json({ error: "CSV is empty" });
      }
      
      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
      
      // Get suggested mapping for each header
      const suggestedMapping = headers.map(header => {
        const field = patientImport.findFieldMapping ? 
          (patientImport as any).findFieldMapping(header) : null;
        return {
          csvHeader: header,
          suggestedField: field || null
        };
      });
      
      // Define available patient fields with metadata
      const patientFields = [
        { key: "nom", label: "Nom", required: true },
        { key: "prenom", label: "Prénom", required: true },
        { key: "fileNumber", label: "Numéro de dossier", required: false },
        { key: "ssn", label: "Numéro SS", required: false },
        { key: "dateNaissance", label: "Date de naissance", required: false },
        { key: "email", label: "E-mail", required: false },
        { key: "telephone", label: "Téléphone", required: false },
        { key: "addressFull", label: "Adresse", required: false },
        { key: "codePostal", label: "Code postal", required: false },
        { key: "ville", label: "Ville", required: false },
        { key: "pays", label: "Pays", required: false },
        { key: null, label: "Ignorer", required: false },
      ];
      
      res.json({
        headers,
        delimiter,
        rowCount: lines.length - 1,
        suggestedMapping,
        patientFields
      });
    } catch (error: any) {
      console.error("[IMPORT] Error detecting headers:", error);
      res.status(500).json({ error: error.message || "Failed to detect headers" });
    }
  });
  
  // POST /api/import/patients/upload - Upload CSV and create import job
  app.post("/api/import/patients/upload", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.id || null;
    
    try {
      const tablesExist = await checkImportTablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import ne sont pas disponibles. Exécutez la migration 20241230_008_import_jobs.sql sur Supabase."
        });
      }
      
      const { content, fileName } = req.body;
      
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "CSV content is required" });
      }
      
      const fileHash = patientImport.computeFileHash(content);
      const job = await patientImport.createImportJob(organisationId, userId, fileName || "import.csv", fileHash);
      
      // Store content in job for later validation
      await db.update(importJobs).set({ filePath: content }).where(eq(importJobs.id, job.id));
      
      res.json({ 
        jobId: job.id, 
        fileName: job.fileName,
        fileHash: job.fileHash,
        status: job.status
      });
    } catch (error: any) {
      console.error("[IMPORT] Error uploading CSV:", error);
      res.status(500).json({ error: error.message || "Failed to upload CSV" });
    }
  });
  
  // POST /api/import/patients/validate - Parse and validate CSV rows
  app.post("/api/import/patients/validate", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const tablesExist = await checkImportTablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import ne sont pas disponibles. Exécutez la migration 20241230_008_import_jobs.sql sur Supabase."
        });
      }
      
      const { jobId, mapping } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }
      
      const job = await patientImport.getImportJob(jobId);
      if (!job || job.organisationId !== organisationId) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      // Update status to validating
      await patientImport.updateImportJobStatus(jobId, "validating");
      
      // Parse CSV from stored content
      const csvContent = job.filePath || "";
      const debug = true;
      const rows = patientImport.parseCSV(csvContent, debug);
      
      if (rows.length === 0) {
        await patientImport.updateImportJobStatus(jobId, "failed", undefined, "CSV vide ou format invalide");
        return res.status(400).json({ error: "CSV is empty or invalid format" });
      }
      
      console.log(`[IMPORT] Processing ${rows.length} rows with ${mapping ? 'custom' : 'auto'} mapping...`);
      
      // Build custom mapping from request if provided
      const customMapping: patientImport.ColumnMapping | undefined = mapping ? 
        Object.fromEntries(
          Object.entries(mapping as Record<string, string | null>).map(([k, v]) => [k, v as keyof patientImport.NormalizedPatient | null])
        ) : undefined;
      
      // Validate each row (no DB lookups for speed - do matching during import)
      const stats: patientImport.ImportStats = {
        total: rows.length,
        ok: 0,
        warning: 0,
        error: 0,
        collision: 0,
        toCreate: rows.length, // Assume all new for now, will refine during import
        toUpdate: 0,
      };
      
      const rowResults: Array<{
        rowIndex: number;
        rawData: patientImport.CSVRow;
        result: patientImport.ValidationResult;
      }> = [];
      
      // Process all rows synchronously (fast, no DB calls)
      for (let i = 0; i < rows.length; i++) {
        const rawData = rows[i];
        const debugRow = i === 0; // Debug first row only
        const result = patientImport.normalizeRow(rawData, customMapping, debugRow);
        
        // Update stats (ok and warning are mutually exclusive)
        if (result.status === "ok") stats.ok++;
        else if (result.status === "warning") stats.warning++;
        else if (result.status === "error") stats.error++;
        
        rowResults.push({ rowIndex: i, rawData, result });
      }
      
      console.log(`[IMPORT] Validation complete: ${stats.ok} ok, ${stats.warning} warnings, ${stats.error} errors`);
      
      // Store stats with mapping for use during import
      const statsWithMapping = { ...stats, mapping: customMapping || null };
      
      // Update job status with stats and mapping
      await patientImport.updateImportJobStatus(jobId, "validated", statsWithMapping);
      
      // Return summary with sample rows
      const sampleOk = rowResults.filter(r => r.result.status === "ok").slice(0, 3);
      const sampleErrors = rowResults.filter(r => r.result.status === "error").slice(0, 5);
      const sampleWarnings = rowResults.filter(r => r.result.status === "warning").slice(0, 10);
      
      res.json({
        jobId,
        status: "validated",
        stats,
        samples: {
          ok: sampleOk.map(r => ({ row: r.rowIndex + 2, data: r.result.normalized })),
          errors: sampleErrors.map(r => ({ 
            row: r.rowIndex + 2, 
            raw: r.rawData, 
            errors: r.result.errors 
          })),
          warnings: sampleWarnings.map(r => ({ 
            row: r.rowIndex + 2, 
            data: r.result.normalized, 
            warnings: r.result.warnings 
          })),
        }
      });
    } catch (error: any) {
      console.error("[IMPORT] Error validating CSV:", error);
      res.status(500).json({ error: error.message || "Failed to validate CSV" });
    }
  });
  
  // POST /api/import/patients/run - Execute the import
  app.post("/api/import/patients/run", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const tablesExist = await checkImportTablesExist();
      if (!tablesExist) {
        return res.status(503).json({
          error: "MIGRATION_REQUIRED",
          message: "Les tables d'import ne sont pas disponibles. Exécutez la migration 20241230_008_import_jobs.sql sur Supabase."
        });
      }
      
      const { jobId } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }
      
      const job = await patientImport.getImportJob(jobId);
      if (!job || job.organisationId !== organisationId) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      if (job.status !== "validated") {
        return res.status(400).json({ error: "Job must be validated before running" });
      }
      
      // Update status to running
      await patientImport.updateImportJobStatus(jobId, "running");
      
      // Execute import
      const stats = await patientImport.executeImport(jobId, organisationId);
      
      // Update job to completed
      await patientImport.updateImportJobStatus(jobId, "completed", stats);
      
      // Send notification about import completion
      const userId = req.jwtUser?.userId;
      if (userId) {
        await notificationService.notificationEvents.onImportCompleted({
          organisationId,
          recipientUserId: userId,
          importId: jobId,
          successCount: stats.toCreate + stats.toUpdate,
          failureCount: stats.error,
        });
      }
      
      res.json({
        jobId,
        status: "completed",
        stats,
        message: `Import terminé: ${stats.toCreate} créés, ${stats.toUpdate} mis à jour, ${stats.error} erreurs`
      });
    } catch (error: any) {
      console.error("[IMPORT] Error running import:", error);
      res.status(500).json({ error: error.message || "Failed to run import" });
    }
  });
  
  // POST /api/import/:jobId/cancel - Request cancellation of an import job
  app.post("/api/import/:jobId/cancel", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const { jobId } = req.params;
      const job = await patientImport.getImportJob(jobId);
      
      if (!job || job.organisationId !== organisationId) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      if (job.status !== "running") {
        return res.status(400).json({ error: "Can only cancel running imports" });
      }
      
      const success = await patientImport.requestCancelImport(jobId);
      
      if (success) {
        console.log(`[IMPORT] Cancellation requested for job ${jobId}`);
        res.json({ 
          jobId, 
          status: job.status,
          cancelRequested: true,
          message: "Interruption demandée" 
        });
      } else {
        res.status(500).json({ error: "Failed to request cancellation" });
      }
    } catch (error: any) {
      console.error("[IMPORT] Error cancelling import:", error);
      res.status(500).json({ error: error.message || "Failed to cancel import" });
    }
  });
  
  // GET /api/import/patients/last - Get the last import job
  app.get("/api/import/patients/last", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const tablesExist = await checkImportTablesExist();
      if (!tablesExist) {
        return res.json({ lastImport: null });
      }
      
      // Get the most recent completed import job for this organisation
      const [lastJob] = await db
        .select()
        .from(importJobs)
        .where(and(
          eq(importJobs.organisationId, organisationId),
          eq(importJobs.type, "patients_csv"),
          inArray(importJobs.status, ["completed", "failed"])
        ))
        .orderBy(desc(importJobs.completedAt))
        .limit(1);
      
      if (!lastJob) {
        return res.json({ lastImport: null });
      }
      
      const stats = patientImport.safeParseJSON(lastJob.stats, null);
      
      res.json({
        lastImport: {
          id: lastJob.id,
          status: lastJob.status,
          fileName: lastJob.fileName,
          totalRows: lastJob.totalRows,
          processedRows: lastJob.processedRows,
          stats,
          completedAt: lastJob.completedAt,
          createdAt: lastJob.createdAt,
        }
      });
    } catch (error: any) {
      console.error("[IMPORT] Error getting last import:", error);
      res.status(500).json({ error: error.message || "Failed to get last import" });
    }
  });
  
  // GET /api/import/patients/history - Get import history
  app.get("/api/import/patients/history", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const tablesExist = await checkImportTablesExist();
      if (!tablesExist) {
        return res.json({ history: [] });
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await patientImport.getImportHistory(organisationId, limit);
      
      res.json({ history });
    } catch (error: any) {
      console.error("[IMPORT] Error getting import history:", error);
      res.status(500).json({ error: error.message || "Failed to get import history" });
    }
  });
  
  // GET /api/import/:jobId/progress - Get import progress
  app.get("/api/import/:jobId/progress", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const { jobId } = req.params;
      const progress = await patientImport.getImportProgress(jobId);
      
      if (!progress) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      // Disable caching for progress endpoint
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(progress);
    } catch (error: any) {
      console.error("[IMPORT] Error getting progress:", error);
      res.status(500).json({ error: error.message || "Failed to get progress" });
    }
  });

  // GET /api/import/:jobId - Get import job status
  app.get("/api/import/:jobId", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const { jobId } = req.params;
      const job = await patientImport.getImportJob(jobId);
      
      if (!job || job.organisationId !== organisationId) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      res.json({
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        stats: job.stats ? JSON.parse(job.stats) : null,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        validatedAt: job.validatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    } catch (error: any) {
      console.error("[IMPORT] Error getting job:", error);
      res.status(500).json({ error: error.message || "Failed to get job" });
    }
  });
  
  // GET /api/import/:jobId/errors - Get error rows for export
  app.get("/api/import/:jobId/errors", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      const { jobId } = req.params;
      const job = await patientImport.getImportJob(jobId);
      
      if (!job || job.organisationId !== organisationId) {
        return res.status(404).json({ error: "Import job not found" });
      }
      
      const rows = await patientImport.getImportJobRows(jobId);
      const errorRows = rows.filter(r => r.status === "error" || r.status === "collision");
      
      // Build CSV
      const headers = ["Ligne", "Statut", "Erreurs", "Données brutes"];
      const csvLines = [headers.join(";")];
      
      for (const row of errorRows) {
        const errors = row.errors ? JSON.parse(row.errors).map((e: any) => `${e.field}: ${e.message}`).join(", ") : "";
        const rawData = row.rawData ? JSON.stringify(JSON.parse(row.rawData)) : "";
        csvLines.push([row.rowIndex + 2, row.status, `"${errors}"`, `"${rawData}"`].join(";"));
      }
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="import_errors_${jobId}.csv"`);
      res.send(csvLines.join("\n"));
    } catch (error: any) {
      console.error("[IMPORT] Error getting errors:", error);
      res.status(500).json({ error: error.message || "Failed to get errors" });
    }
  });

  // ============================================
  // SETTINGS ENDPOINTS
  // ============================================
  
  // GET /api/settings/profile - Get current user profile with organisation info
  app.get("/api/settings/profile", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      let organisationNom: string | undefined;
      if (user.organisationId) {
        const org = await storage.getOrganisationById(user.organisationId);
        organisationNom = org?.nom;
      }
      
      res.json({
        id: user.id,
        username: user.username,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        organisationId: user.organisationId,
        organisationNom,
      });
    } catch (error: any) {
      console.error("[SETTINGS] Error getting profile:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du profil" });
    }
  });

  // PUT /api/settings/profile - Update user profile (nom, prenom)
  const profileUpdateSchema = z.object({
    nom: z.string().trim().max(100, "Le nom ne peut pas dépasser 100 caractères").optional(),
    prenom: z.string().trim().max(100, "Le prénom ne peut pas dépasser 100 caractères").optional(),
  });

  app.put("/api/settings/profile", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const parsed = profileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Données invalides" });
      }
      
      const { nom, prenom } = parsed.data;
      
      await storage.updateUser(userId, { 
        nom: nom || null, 
        prenom: prenom || null 
      });
      
      res.json({ success: true, message: "Profil mis à jour" });
    } catch (error: any) {
      console.error("[SETTINGS] Error updating profile:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du profil" });
    }
  });
  
  // POST /api/settings/password - Change password
  app.post("/api/settings/password", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      // Verify current password
      const { scrypt, timingSafeEqual } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      
      const [hashed, salt] = user.password.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(currentPassword, salt, 64)) as Buffer;
      
      if (!timingSafeEqual(hashedBuf, suppliedBuf)) {
        return res.status(400).json({ error: "Mot de passe actuel incorrect" });
      }
      
      // Hash new password
      const { randomBytes } = await import("crypto");
      const newSalt = randomBytes(16).toString("hex");
      const newHashedBuf = (await scryptAsync(newPassword, newSalt, 64)) as Buffer;
      const newHashedPassword = `${newHashedBuf.toString("hex")}.${newSalt}`;
      
      await storage.updateUser(userId, { password: newHashedPassword });
      
      res.json({ success: true, message: "Mot de passe modifié avec succès" });
    } catch (error: any) {
      console.error("[SETTINGS] Error changing password:", error);
      res.status(500).json({ error: "Erreur lors du changement de mot de passe" });
    }
  });
  
  // GET /api/settings/collaborators - Get organisation collaborators and invitations (admin only)
  app.get("/api/settings/collaborators", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      // Admin check
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const users = await storage.getUsersByOrganisation(organisationId);
      const invitations = await storage.getInvitationsByOrganisation(organisationId);
      
      // Combine users and pending invitations
      const collaborators = [
        ...users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.username,
          nom: u.nom,
          prenom: u.prenom,
          role: u.role,
          status: 'ACTIVE' as const,
          type: 'user' as const,
        })),
        ...invitations.filter(inv => inv.status === 'PENDING').map(inv => ({
          id: inv.id,
          username: inv.email,
          email: inv.email,
          nom: inv.nom,
          prenom: inv.prenom,
          role: inv.role,
          status: 'PENDING' as const,
          type: 'invitation' as const,
          expiresAt: inv.expiresAt,
        })),
      ];
      
      res.json(collaborators);
    } catch (error: any) {
      console.error("[SETTINGS] Error getting collaborators:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des collaborateurs" });
    }
  });
  
  // POST /api/settings/collaborators - Invite new collaborator (admin only)
  app.post("/api/settings/collaborators", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const { email, role, nom, prenom } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email requis" });
      }
      
      if (!role || !["ADMIN", "CHIRURGIEN", "ASSISTANT"].includes(role)) {
        return res.status(400).json({ error: "Rôle invalide" });
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà" });
      }
      
      // Check if invitation already exists
      const existingInvitation = await storage.getInvitationByEmail(organisationId, normalizedEmail);
      if (existingInvitation) {
        return res.status(400).json({ error: "Une invitation est déjà en attente pour cet email" });
      }
      
      // Get organisation name for email
      const org = await storage.getOrganisationById(organisationId);
      const organisationName = org?.nom || "Cabinet dentaire";
      
      // Get inviter name
      const inviterId = req.jwtUser?.userId || "";
      const inviter = await storage.getUserById(inviterId);
      const inviterName = inviter ? `${inviter.prenom || ""} ${inviter.nom || ""}`.trim() || inviter.username : "Un administrateur";
      
      // Generate secure invitation token
      const token = randomBytes(32).toString('hex');
      const tokenHash = scryptSync(token, 'salt_invitation', 64).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Create invitation
      const invitation = await storage.createInvitation(organisationId, {
        email: normalizedEmail,
        role: role as "ADMIN" | "CHIRURGIEN" | "ASSISTANT",
        tokenHash,
        expiresAt,
        invitedByUserId: inviterId,
        nom: nom || null,
        prenom: prenom || null,
      });
      
      // Send invitation email using new branded templates
      const baseUrl = getBaseUrl();
      const inviteUrl = `${baseUrl}/accept-invitation?token=${token}`;
      const result = await sendEmail(normalizedEmail, 'invitation', {
        inviteUrl,
        organisationName,
        inviterName,
        role,
        expiresAt,
      });
      
      // Log to email outbox
      await storage.logEmail({
        organisationId,
        toEmail: normalizedEmail,
        template: 'COLLABORATOR_INVITATION',
        subject: `Cassius - Invitation à rejoindre ${organisationName}`,
        payload: JSON.stringify({ role, organisationName, inviterName }),
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error || null,
      });
      
      console.log(`[SETTINGS] Invitation created for: ${normalizedEmail}, email sent: ${result.success}`);
      
      // Send notification to the inviting user about invitation sent
      if (inviterId) {
        notificationService.notificationEvents.onInvitationSent({
          organisationId,
          recipientUserId: inviterId,
          inviteeEmail: normalizedEmail,
          role,
        }).catch(err => console.error("[Notification] Invitation sent notification failed:", err));
      }
      
      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        nom: invitation.nom,
        prenom: invitation.prenom,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      });
    } catch (error: any) {
      console.error("[SETTINGS] Error creating invitation:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'envoi de l'invitation" });
    }
  });
  
  // PATCH /api/settings/collaborators/:id - Update collaborator role (admin only)
  app.patch("/api/settings/collaborators/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role || !["ADMIN", "CHIRURGIEN", "ASSISTANT"].includes(role)) {
        return res.status(400).json({ error: "Rôle invalide" });
      }
      
      const user = await storage.getUserById(id);
      if (!user || user.organisationId !== organisationId) {
        return res.status(404).json({ error: "Collaborateur non trouvé" });
      }
      
      // Prevent removing the last admin
      if (user.role === "ADMIN" && role !== "ADMIN") {
        const admins = await storage.getUsersByOrganisation(organisationId);
        const adminCount = admins.filter(u => u.role === "ADMIN").length;
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Impossible de retirer le dernier administrateur" });
        }
      }
      
      const previousRole = user.role;
      await storage.updateUser(id, { role: role as "ADMIN" | "CHIRURGIEN" | "ASSISTANT" });
      
      // Notify all admins about role change
      const actorUserId = req.jwtUser?.userId || "";
      const orgUsers = await storage.getUsersByOrganisation(organisationId);
      const userName = `${user.prenom || ""} ${user.nom || ""}`.trim() || user.username;
      
      for (const admin of orgUsers.filter(u => u.role === "ADMIN")) {
        notificationService.notificationEvents.onRoleChanged({
          organisationId,
          recipientUserId: admin.id,
          affectedUserName: userName,
          previousRole,
          newRole: role,
          actorUserId,
        }).catch(err => console.error("[Notification] Role changed notification failed:", err));
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SETTINGS] Error updating collaborator:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du rôle" });
    }
  });
  
  // DELETE /api/settings/collaborators/:id - Remove collaborator (admin only)
  app.delete("/api/settings/collaborators/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const { id } = req.params;
      const currentUserId = req.jwtUser?.userId;
      
      if (id === currentUserId) {
        return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
      }
      
      // First try to find as user
      const user = await storage.getUserById(id);
      if (user && user.organisationId === organisationId) {
        // Prevent removing the last admin
        if (user.role === "ADMIN") {
          const admins = await storage.getUsersByOrganisation(organisationId);
          const adminCount = admins.filter(u => u.role === "ADMIN").length;
          if (adminCount <= 1) {
            return res.status(400).json({ error: "Impossible de supprimer le dernier administrateur" });
          }
        }
        
        await storage.deleteUser(id);
        return res.json({ success: true });
      }
      
      // Try to find as invitation
      const invitation = await storage.getInvitationById(id);
      if (invitation && invitation.organisationId === organisationId) {
        await storage.deleteInvitation(id);
        return res.json({ success: true });
      }
      
      return res.status(404).json({ error: "Collaborateur non trouvé" });
    } catch (error: any) {
      console.error("[SETTINGS] Error deleting collaborator:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du collaborateur" });
    }
  });
  
  // GET /api/settings/organisation - Get organisation details (admin only)
  app.get("/api/settings/organisation", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const org = await storage.getOrganisationById(organisationId);
      if (!org) {
        return res.status(404).json({ error: "Organisation non trouvée" });
      }
      
      res.json({
        id: org.id,
        nom: org.nom,
        adresse: org.adresse || null,
        timezone: org.timezone || "Europe/Paris",
        createdAt: org.createdAt,
      });
    } catch (error: any) {
      console.error("[SETTINGS] Error getting organisation:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de l'organisation" });
    }
  });
  
  // PUT /api/settings/organisation - Update organisation (admin only)
  app.put("/api/settings/organisation", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const { nom, adresse, timezone } = req.body;
      
      await storage.updateOrganisation(organisationId, { 
        nom, 
        adresse, 
        timezone 
      });
      
      const updated = await storage.getOrganisationById(organisationId);
      
      res.json({
        id: updated?.id,
        nom: updated?.nom,
        adresse: updated?.adresse || null,
        timezone: updated?.timezone || "Europe/Paris",
        createdAt: updated?.createdAt,
      });
    } catch (error: any) {
      console.error("[SETTINGS] Error updating organisation:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'organisation" });
    }
  });

  // ========== INVITATION ACCEPTANCE FLOW ==========
  
  // GET /api/auth/verify-invitation - Verify invitation token
  app.get("/api/auth/verify-invitation", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, error: "Token manquant" });
      }
      
      const tokenHash = scryptSync(token, 'salt_invitation', 64).toString('hex');
      const invitation = await storage.getInvitationByToken(tokenHash);
      
      if (!invitation) {
        return res.json({ valid: false, error: "Invitation invalide" });
      }
      
      if (invitation.status !== 'PENDING') {
        return res.json({ valid: false, error: "Cette invitation a déjà été utilisée" });
      }
      
      if (new Date() > invitation.expiresAt) {
        return res.json({ valid: false, error: "Cette invitation a expiré" });
      }
      
      // Get organisation name
      const org = await storage.getOrganisationById(invitation.organisationId);
      
      res.json({
        valid: true,
        email: invitation.email,
        role: invitation.role,
        organisationName: org?.nom || "Cabinet dentaire",
        nom: invitation.nom,
        prenom: invitation.prenom,
      });
    } catch (error: any) {
      console.error("[AUTH] Error verifying invitation:", error);
      res.status(500).json({ valid: false, error: "Erreur de vérification" });
    }
  });
  
  // POST /api/auth/accept-invitation - Accept invitation and create account
  app.post("/api/auth/accept-invitation", async (req, res) => {
    try {
      const { token, password, nom, prenom } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token et mot de passe requis" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }
      
      const tokenHash = scryptSync(token, 'salt_invitation', 64).toString('hex');
      const invitation = await storage.getInvitationByToken(tokenHash);
      
      if (!invitation) {
        return res.status(400).json({ error: "Invitation invalide" });
      }
      
      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ error: "Cette invitation a déjà été utilisée" });
      }
      
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ error: "Cette invitation a expiré" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(invitation.email);
      if (existingUser) {
        return res.status(400).json({ error: "Un compte existe déjà avec cet email" });
      }
      
      // Hash password (format: hashedPassword.salt - same as auth.ts)
      const salt = randomBytes(16).toString('hex');
      const hashedPassword = scryptSync(password, salt, 64).toString('hex');
      const passwordWithSalt = `${hashedPassword}.${salt}`;
      
      // Create user
      const newUser = await storage.createUser({
        username: invitation.email,
        password: passwordWithSalt,
        role: invitation.role as "ADMIN" | "CHIRURGIEN" | "ASSISTANT",
        organisationId: invitation.organisationId,
        nom: nom || invitation.nom || null,
        prenom: prenom || invitation.prenom || null,
      });
      
      // Mark invitation as accepted
      await storage.acceptInvitation(invitation.id);
      
      // Notify all admins about new member joining
      const orgUsers = await storage.getUsersByOrganisation(invitation.organisationId);
      const newMemberName = `${prenom || invitation.prenom || ""} ${nom || invitation.nom || ""}`.trim() || invitation.email;
      
      for (const admin of orgUsers.filter(u => u.role === "ADMIN" && u.id !== newUser.id)) {
        notificationService.notificationEvents.onNewMemberJoined({
          organisationId: invitation.organisationId,
          recipientUserId: admin.id,
          newMemberName,
          newMemberEmail: invitation.email,
          role: invitation.role,
        }).catch(err => console.error("[Notification] New member notification failed:", err));
      }
      
      console.log("[AUTH] Invitation accepted, user created:", newUser.id);
      res.json({
        success: true,
        message: "Compte créé avec succès",
        email: newUser.username,
      });
    } catch (error: any) {
      console.error("[AUTH] Error accepting invitation:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la création du compte" });
    }
  });
  
  // DELETE /api/settings/invitations/:id - Cancel invitation (admin only)
  app.delete("/api/settings/invitations/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    
    try {
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const { id } = req.params;
      
      await storage.cancelInvitation(organisationId, id);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SETTINGS] Error cancelling invitation:", error);
      res.status(500).json({ error: "Erreur lors de l'annulation de l'invitation" });
    }
  });

  // ========== PASSWORD RESET FLOW ==========
  
  // POST /api/auth/forgot-password - Request password reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email requis" });
      }
      
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      
      // Always return success to prevent email enumeration
      if (!user) {
        console.log("[AUTH] Password reset requested for unknown email:", email);
        return res.json({ success: true, message: "Si cette adresse existe, un email a été envoyé." });
      }
      
      // Invalidate any existing password reset tokens
      await storage.invalidateEmailTokens(email.toLowerCase().trim(), 'PASSWORD_RESET');
      
      // Generate secure token
      const token = randomBytes(32).toString('hex');
      const tokenHash = scryptSync(token, 'salt_pw_reset', 64).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      await storage.createEmailToken({
        userId: user.id,
        email: email.toLowerCase().trim(),
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt,
      });
      
      // Send email using new branded templates
      const baseUrl = getBaseUrl();
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      const userName = user.prenom || user.nom || undefined;
      const result = await sendEmail(email, 'resetPassword', {
        resetUrl,
        firstName: userName,
      });
      
      // Log to email outbox
      await storage.logEmail({
        organisationId: user.organisationId,
        toEmail: email,
        template: 'PASSWORD_RESET',
        subject: 'Cassius - Réinitialisation de votre mot de passe',
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error || null,
      });
      
      res.json({ success: true, message: "Si cette adresse existe, un email a été envoyé." });
    } catch (error: any) {
      console.error("[AUTH] Error in forgot-password:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
    }
  });
  
  // POST /api/auth/reset-password - Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token et nouveau mot de passe requis" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }
      
      // Find token
      const tokenHash = scryptSync(token, 'salt_pw_reset', 64).toString('hex');
      const emailToken = await storage.getEmailTokenByHash(tokenHash);
      
      if (!emailToken) {
        return res.status(400).json({ error: "Lien invalide ou expiré" });
      }
      
      if (emailToken.usedAt) {
        return res.status(400).json({ error: "Ce lien a déjà été utilisé" });
      }
      
      if (new Date() > emailToken.expiresAt) {
        return res.status(400).json({ error: "Ce lien a expiré" });
      }
      
      if (!emailToken.userId) {
        return res.status(400).json({ error: "Token invalide" });
      }
      
      // Hash new password
      const salt = randomBytes(16).toString('hex');
      const hashedPassword = scryptSync(newPassword, salt, 64).toString('hex');
      const passwordWithSalt = `${salt}:${hashedPassword}`;
      
      // Update user password
      await storage.updateUser(emailToken.userId, { password: passwordWithSalt });
      
      // Mark token as used
      await storage.markEmailTokenUsed(emailToken.id);
      
      console.log("[AUTH] Password reset successful for user:", emailToken.userId);
      res.json({ success: true, message: "Mot de passe modifié avec succès" });
    } catch (error: any) {
      console.error("[AUTH] Error in reset-password:", error);
      res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe" });
    }
  });
  
  // GET /api/auth/verify-reset-token - Verify reset token is valid
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, error: "Token manquant" });
      }
      
      const tokenHash = scryptSync(token, 'salt_pw_reset', 64).toString('hex');
      const emailToken = await storage.getEmailTokenByHash(tokenHash);
      
      if (!emailToken || emailToken.usedAt || new Date() > emailToken.expiresAt) {
        return res.json({ valid: false });
      }
      
      res.json({ valid: true, email: emailToken.email });
    } catch (error: any) {
      console.error("[AUTH] Error verifying reset token:", error);
      res.status(500).json({ valid: false, error: "Erreur de vérification" });
    }
  });
  
  // ========== EMAIL VERIFICATION FLOW ==========
  
  // POST /api/auth/send-verification - Send email verification
  app.post("/api/auth/send-verification", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.id;
      const email = req.jwtUser?.username;
      
      if (!userId || !email) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      if ((user as any).emailVerified) {
        return res.json({ success: true, message: "Email déjà vérifié" });
      }
      
      // Invalidate any existing verification tokens
      await storage.invalidateEmailTokens(email, 'EMAIL_VERIFY');
      
      // Generate secure token
      const token = randomBytes(32).toString('hex');
      const tokenHash = scryptSync(token, 'salt_email_verify', 64).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.createEmailToken({
        userId,
        email,
        type: 'EMAIL_VERIFY',
        tokenHash,
        expiresAt,
      });
      
      // Send email using new branded templates
      const baseUrl = getBaseUrl();
      const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
      const userName = user.prenom || user.nom || undefined;
      const result = await sendEmail(email, 'verifyEmail', {
        verifyUrl,
        firstName: userName,
      });
      
      // Log to email outbox
      await storage.logEmail({
        organisationId: user.organisationId,
        toEmail: email,
        template: 'EMAIL_VERIFY',
        subject: 'Cassius - Confirmez votre adresse email',
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error || null,
      });
      
      if (result.success) {
        res.json({ success: true, message: "Email de vérification envoyé" });
      } else {
        res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
      }
    } catch (error: any) {
      console.error("[AUTH] Error sending verification email:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
    }
  });
  
  // POST /api/auth/verify-email - Verify email with token
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: "Token requis" });
      }
      
      const tokenHash = scryptSync(token, 'salt_email_verify', 64).toString('hex');
      const emailToken = await storage.getEmailTokenByHash(tokenHash);
      
      if (!emailToken) {
        return res.status(400).json({ error: "Lien invalide ou expiré" });
      }
      
      if (emailToken.usedAt) {
        return res.status(400).json({ error: "Ce lien a déjà été utilisé" });
      }
      
      if (new Date() > emailToken.expiresAt) {
        return res.status(400).json({ error: "Ce lien a expiré" });
      }
      
      if (!emailToken.userId) {
        return res.status(400).json({ error: "Token invalide" });
      }
      
      // Mark user email as verified
      await storage.updateUserEmailVerified(emailToken.userId);
      
      // Mark token as used
      await storage.markEmailTokenUsed(emailToken.id);
      
      console.log("[AUTH] Email verified for user:", emailToken.userId);
      res.json({ success: true, message: "Email vérifié avec succès" });
    } catch (error: any) {
      console.error("[AUTH] Error verifying email:", error);
      res.status(500).json({ error: "Erreur lors de la vérification" });
    }
  });
  
  // GET /api/auth/email-status - Get current email verification status
  app.get("/api/auth/email-status", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      res.json({
        email: user.username,
        verified: (user as any).emailVerified || false,
        verifiedAt: (user as any).emailVerifiedAt || null,
      });
    } catch (error: any) {
      console.error("[AUTH] Error getting email status:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  // ========== DEV ONLY: EMAIL PREVIEW ==========
  
  // GET /api/dev/email-preview - Preview email templates (DEV + ADMIN only)
  app.get("/api/dev/email-preview", requireJwtOrSession, async (req, res) => {
    try {
      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: "Non disponible en production" });
      }
      
      // Only allow admins
      if (req.jwtUser?.role !== "ADMIN") {
        return res.status(403).json({ error: "Accès réservé aux administrateurs" });
      }
      
      const { template } = req.query;
      
      if (!template || typeof template !== 'string') {
        const availableTemplates: TemplateName[] = [
          'resetPassword',
          'verifyEmail', 
          'invitation',
          'securityNotice',
          'integrationConnected',
          'systemAlert',
          'notificationDigest',
        ];
        return res.json({
          message: "Templates disponibles",
          templates: availableTemplates,
          usage: "/api/dev/email-preview?template=resetPassword",
        });
      }
      
      const validTemplates: TemplateName[] = [
        'resetPassword',
        'verifyEmail',
        'invitation',
        'securityNotice',
        'integrationConnected',
        'systemAlert',
        'notificationDigest',
      ];
      
      if (!validTemplates.includes(template as TemplateName)) {
        return res.status(400).json({ 
          error: `Template invalide: ${template}`,
          available: validTemplates,
        });
      }
      
      const html = getPreviewHtml(template as TemplateName);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      console.error("[DEV] Error previewing email:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/dev/test-notifications - Generate test notifications (DEV only)
  app.post("/api/dev/test-notifications", requireJwtOrSession, async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: "Non disponible en production" });
      }

      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const testNotifications = [
        {
          organisationId,
          recipientUserId: userId,
          kind: "ALERT" as const,
          type: "ISQ_LOW",
          severity: "CRITICAL" as const,
          title: "ISQ bas detecte",
          body: "Un implant presente un ISQ de 45, en dessous du seuil recommande.",
          entityType: "PATIENT" as const,
        },
        {
          organisationId,
          recipientUserId: userId,
          kind: "REMINDER" as const,
          type: "FOLLOWUP_TO_SCHEDULE",
          severity: "WARNING" as const,
          title: "Suivi a programmer",
          body: "Patient Jean Dupont necessite un rendez-vous de controle.",
          entityType: "PATIENT" as const,
        },
        {
          organisationId,
          recipientUserId: userId,
          kind: "ACTIVITY" as const,
          type: "DOCUMENT_ADDED",
          severity: "INFO" as const,
          title: "Document ajoute",
          body: "Une nouvelle radiographie a ete ajoutee au dossier patient.",
          entityType: "DOCUMENT" as const,
        },
        {
          organisationId,
          recipientUserId: userId,
          kind: "IMPORT" as const,
          type: "IMPORT_COMPLETED",
          severity: "INFO" as const,
          title: "Import termine",
          body: "12 patients ont ete importes avec succes.",
          entityType: "IMPORT" as const,
        },
        {
          organisationId,
          recipientUserId: userId,
          kind: "SYSTEM" as const,
          type: "SYSTEM_UPDATE",
          severity: "INFO" as const,
          title: "Mise à jour système",
          body: "De nouvelles fonctionnalités sont disponibles.",
        },
      ];

      const created = [];
      for (const notif of testNotifications) {
        const result = await notificationService.createNotification(notif);
        if (result) created.push(result);
      }

      res.json({
        success: true,
        message: `${created.length} notifications de test creees`,
        notifications: created,
      });
    } catch (error: any) {
      console.error("[DEV] Error creating test notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/dev/clear-notifications - Clear all notifications except last N (DEV only)
  app.delete("/api/dev/clear-notifications", async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: "Non disponible en production" });
      }

      // In dev mode, clear all notifications for all users
      const keepLast = parseInt(req.query.keep as string) || 0;
      
      // Get IDs to keep (most recent N globally)
      const toKeep = await db
        .select({ id: notifications.id })
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(keepLast);
      
      const keepIds = toKeep.map(n => n.id);
      
      // Delete all except those
      let deletedCount = 0;
      if (keepIds.length > 0) {
        const result = await db
          .delete(notifications)
          .where(notInArray(notifications.id, keepIds));
        deletedCount = result.rowCount || 0;
      } else {
        const result = await db
          .delete(notifications);
        deletedCount = result.rowCount || 0;
      }

      res.json({
        success: true,
        message: `${deletedCount} notifications supprimees, ${keepIds.length} conservees`,
        kept: keepIds,
      });
    } catch (error: any) {
      console.error("[DEV] Error clearing notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/dev/clear-flags - Clear all flags (DEV only)
  app.delete("/api/dev/clear-flags", async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: "Non disponible en production" });
      }

      const result = await db.delete(flags);
      res.json({
        success: true,
        message: `${result.rowCount || 0} flags supprimés`,
      });
    } catch (error: any) {
      console.error("[DEV] Error clearing flags:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== NOTIFICATION ROUTES ====================

  // Helper: Convert flags to notification-like objects
  function flagsToNotifications(flags: any[]): any[] {
    const severityMap: Record<string, string> = {
      CRITICAL: "CRITICAL",
      WARNING: "WARNING",
      INFO: "INFO",
    };
    
    const titleMap: Record<string, string> = {
      ISQ_LOW: "ISQ Bas Détecté",
      ISQ_CRITICAL: "ISQ Critique",
      NO_POSTOP_FOLLOWUP: "Suivi Post-opératoire Manquant",
      INCOMPLETE_DATA: "Données Incomplètes",
      OVERDUE_APPOINTMENT: "Rendez-vous en Retard",
      MISSING_XRAY: "Radiographie Manquante",
    };
    
    return flags.map((flag) => {
      const patientName = flag.patient ? `${flag.patient.prenom || ""} ${flag.patient.nom || ""}`.trim() : null;
      return {
        id: `flag-${flag.id}`,
        kind: "ALERT",
        type: flag.type,
        severity: severityMap[flag.severity] || "INFO",
        title: titleMap[flag.type] || flag.type,
        body: flag.message || (patientName ? `Alerte pour ${patientName}` : "Alerte clinique"),
        entityType: "PATIENT",
        entityId: flag.patientId,
        patientName,
        patientId: flag.patientId,
        createdAt: flag.createdAt || new Date().toISOString(),
        readAt: flag.resolvedAt || null,
        isVirtual: true,
      };
    });
  }

  // Helper: Convert upcoming appointments to notification-like objects
  function appointmentsToNotifications(appointments: any[]): any[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    return appointments
      .filter((apt) => {
        const aptDate = new Date(apt.dateHeure);
        return aptDate >= today && aptDate < dayAfter;
      })
      .map((apt) => {
        const aptDate = new Date(apt.dateHeure);
        const isToday = aptDate >= today && aptDate < tomorrow;
        const timeStr = aptDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        
        const patientName = apt.patient ? `${apt.patient.prenom || ""} ${apt.patient.nom || ""}`.trim() : null;
        return {
          id: `apt-${apt.id}`,
          kind: "REMINDER",
          type: "UPCOMING_APPOINTMENT",
          severity: isToday ? "WARNING" : "INFO",
          title: isToday ? `RDV Aujourd'hui à ${timeStr}` : `RDV Demain à ${timeStr}`,
          body: patientName ? `${patientName} - ${apt.type}` : apt.type,
          entityType: "APPOINTMENT",
          entityId: apt.id,
          patientName,
          patientId: apt.patientId,
          createdAt: apt.createdAt || new Date().toISOString(),
          readAt: null,
          isVirtual: true,
        };
      });
  }

  // Get notifications list (including flags and upcoming appointments)
  app.get("/api/notifications", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const { kind, unreadOnly, page, pageSize } = req.query;
      
      // Get stored notifications
      const result = await notificationService.getNotifications(userId, organisationId, {
        kind: kind as any,
        unreadOnly: unreadOnly === 'true',
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 20,
      });
      
      // Also get flags and upcoming appointments as virtual notifications
      const [flags, appointments] = await Promise.all([
        storage.getFlagsWithEntity(organisationId, false), // unresolved flags only
        storage.getAppointmentsForSync(organisationId),
      ]);
      
      const virtualFromFlags = flagsToNotifications(flags);
      const virtualFromAppointments = appointmentsToNotifications(appointments);
      
      // Enrich stored notifications with patient info from metadata
      const enrichedStoredNotifications = result.notifications.map((notif: any) => {
        let metadata: any = {};
        try {
          if (notif.metadata && typeof notif.metadata === 'string') {
            metadata = JSON.parse(notif.metadata);
          } else if (notif.metadata) {
            metadata = notif.metadata;
          }
        } catch (e) { /* ignore parse errors */ }
        
        return {
          ...notif,
          patientName: metadata.patientName || metadata.patientNom || null,
          patientId: notif.entityType === 'PATIENT' ? notif.entityId : (metadata.patientId || null),
        };
      });
      
      // Merge and sort by date (newest first)
      const allNotifications = [
        ...enrichedStoredNotifications,
        ...virtualFromFlags,
        ...virtualFromAppointments,
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Paginate the merged results
      const pageNum = page ? parseInt(page as string) : 1;
      const pageSizeNum = pageSize ? parseInt(pageSize as string) : 20;
      const startIdx = (pageNum - 1) * pageSizeNum;
      const paginatedNotifications = allNotifications.slice(startIdx, startIdx + pageSizeNum);
      
      res.json({
        notifications: paginatedNotifications,
        total: allNotifications.length,
      });
    } catch (error: any) {
      console.error("[Notifications] Error fetching notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get unread count (including flags and upcoming appointments)
  app.get("/api/notifications/unread-count", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      // Get stored notification count
      const storedCount = await notificationService.getUnreadCount(userId, organisationId);
      
      // Also count unresolved flags and upcoming appointments
      const [flags, appointments] = await Promise.all([
        storage.getFlagsWithEntity(organisationId, false),
        storage.getAppointmentsForSync(organisationId),
      ]);
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      const upcomingAppointmentsCount = appointments.filter((apt: any) => {
        const aptDate = new Date(apt.dateHeure);
        return aptDate >= today && aptDate < dayAfterTomorrow;
      }).length;
      
      const totalCount = storedCount + flags.length + upcomingAppointmentsCount;
      
      res.json({ count: totalCount });
    } catch (error: any) {
      console.error("[Notifications] Error fetching unread count:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const { id } = req.params;
      const success = await notificationService.markAsRead(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Notification non trouvee" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Notifications] Error marking notification as read:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark notification as unread
  app.patch("/api/notifications/:id/unread", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

      const { id } = req.params;
      const success = await notificationService.markAsUnread(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Notification non trouvée" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Notifications] Error marking notification as unread:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const count = await notificationService.markAllAsRead(userId, organisationId);
      res.json({ success: true, count });
    } catch (error: any) {
      console.error("[Notifications] Error marking all as read:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Archive a notification
  app.patch("/api/notifications/:id/archive", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const { id } = req.params;
      const success = await notificationService.archiveNotification(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Notification non trouvee" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Notifications] Error archiving notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a notification
  app.delete("/api/notifications/:id", requireJwtOrSession, async (req, res) => {
    try {
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const { id } = req.params;
      
      // Delete from database
      const result = await db
        .delete(notifications)
        .where(and(
          eq(notifications.id, id),
          eq(notifications.recipientUserId, userId)
        ));
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Notification non trouvee" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Notifications] Error deleting notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user notification preferences
  app.get("/api/notifications/preferences", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const preferences = await notificationService.getUserPreferences(userId, organisationId);
      res.json(preferences);
    } catch (error: any) {
      console.error("[Notifications] Error fetching preferences:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a notification preference
  app.patch("/api/notifications/preferences/:category", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const { category } = req.params;
      const { frequency, inAppEnabled, emailEnabled, digestTime, disabledTypes, disabledEmailTypes } = req.body;
      
      const preference = await notificationService.updatePreference(
        userId,
        organisationId,
        category as any,
        { frequency, inAppEnabled, emailEnabled, digestTime, disabledTypes, disabledEmailTypes }
      );
      
      res.json(preference);
    } catch (error: any) {
      console.error("[Notifications] Error updating preference:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual digest trigger (admin only - requires CHIRURGIEN or ADMIN role)
  app.post("/api/admin/digest/daily", requireJwtOrSession, async (req, res) => {
    try {
      const userRole = req.jwtUser?.role;
      if (!userRole || !["CHIRURGIEN", "ADMIN"].includes(userRole)) {
        return res.status(403).json({ error: "Acces refuse - Administrateur requis" });
      }
      
      const { runDailyDigest } = await import("./notifications/digestScheduler");
      const result = await runDailyDigest();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[Digest] Error running daily digest:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint for testing notification flow (admin only)
  app.get("/api/notifications/debug", requireJwtOrSession, async (req, res) => {
    try {
      const userRole = req.jwtUser?.role;
      if (!userRole || userRole !== "ADMIN") {
        return res.status(403).json({ error: "Acces refuse - Administrateur requis" });
      }

      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      
      const eventType = req.query.event as string || "ISQ_CRITICAL";
      
      // Get all users in the organisation
      const orgUsers = await db.select({
        id: users.id,
        username: users.username,
        nom: users.nom,
        prenom: users.prenom,
        role: users.role,
      }).from(users).where(eq(users.organisationId, organisationId));
      
      // Get preferences for each user
      const userDebugInfo = await Promise.all(orgUsers.map(async (user) => {
        const allPrefs = await notificationService.getUserPreferences(user.id, organisationId);
        
        // Map event type to category
        let category = "ALERTS_REMINDERS";
        if (eventType.includes("IMPORT")) category = "IMPORTS";
        else if (eventType.includes("ACTIVITY") || eventType.includes("TEAM")) category = "TEAM_ACTIVITY";
        else if (eventType.includes("SYSTEM")) category = "SYSTEM";
        
        const relevantPref = allPrefs.find(p => p.category === category);
        const defaultPref = { frequency: "IMMEDIATE", inAppEnabled: true, emailEnabled: false };
        const effectivePref = relevantPref || defaultPref;
        
        const wouldReceiveInApp = effectivePref.frequency !== "NONE" && (effectivePref.inAppEnabled || effectivePref.emailEnabled);
        const wouldReceiveEmail = effectivePref.emailEnabled && effectivePref.frequency === "IMMEDIATE";
        
        let skipReason: string | null = null;
        if (effectivePref.frequency === "NONE") {
          skipReason = "Frequency set to NONE";
        } else if (!effectivePref.inAppEnabled && !effectivePref.emailEnabled) {
          skipReason = "Both in-app and email disabled";
        }
        
        return {
          user: {
            id: user.id,
            email: user.username,
            name: `${user.prenom || ""} ${user.nom || ""}`.trim() || user.username,
            role: user.role,
          },
          preferences: {
            category,
            frequency: effectivePref.frequency,
            inAppEnabled: effectivePref.inAppEnabled,
            emailEnabled: effectivePref.emailEnabled,
            source: relevantPref ? "custom" : "default",
          },
          result: {
            wouldReceiveInApp,
            wouldReceiveEmail,
            wouldReceiveDigest: effectivePref.emailEnabled && effectivePref.frequency === "DIGEST",
            skipReason,
          },
        };
      }));
      
      res.json({
        eventType,
        organisation: organisationId,
        timestamp: new Date().toISOString(),
        targetedUsers: userDebugInfo,
        summary: {
          totalUsers: userDebugInfo.length,
          wouldReceiveInApp: userDebugInfo.filter(u => u.result.wouldReceiveInApp).length,
          wouldReceiveImmediateEmail: userDebugInfo.filter(u => u.result.wouldReceiveEmail).length,
          wouldReceiveDigest: userDebugInfo.filter(u => u.result.wouldReceiveDigest).length,
          skipped: userDebugInfo.filter(u => u.result.skipReason).length,
        },
      });
    } catch (error: any) {
      console.error("[Notifications] Debug endpoint error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test notification creation (admin only)
  app.post("/api/notifications/test", requireJwtOrSession, async (req, res) => {
    try {
      const userRole = req.jwtUser?.role;
      if (!userRole || userRole !== "ADMIN") {
        return res.status(403).json({ error: "Acces refuse - Administrateur requis" });
      }

      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });
      
      const { type = "TEST", severity = "INFO", title, body } = req.body;
      
      const notification = await notificationService.createNotification({
        organisationId,
        recipientUserId: userId,
        kind: "SYSTEM",
        type,
        severity,
        title: title || "Notification de test",
        body: body || "Ceci est une notification de test pour verifier le systeme.",
      });
      
      if (notification) {
        res.json({ success: true, notification });
      } else {
        res.json({ success: false, reason: "Notification skipped (check preferences or deduplication)" });
      }
    } catch (error: any) {
      console.error("[Notifications] Test notification error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ONBOARDING ROUTES ====================

  // GET /api/onboarding/checklist - Get dynamic checklist with completion status
  app.get("/api/onboarding/checklist", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Get onboarding state
      const state = await db
        .select()
        .from(onboardingState)
        .where(eq(onboardingState.organisationId, organisationId))
        .then(rows => rows[0]);

      const onboardingData = state ? JSON.parse(state.data || "{}") as OnboardingData & { manuallyCompleted?: Record<string, boolean> } : {};
      const manuallyCompleted = onboardingData.manuallyCompleted || {};

      // Run all count queries in parallel for performance
      const [
        userCount,
        patientCount,
        operationCount,
        surgeryImplantCount,
        isqCount,
        appointmentCount,
        documentCount,
        calendarIntegration,
        notificationEnabledCount
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(patients).where(eq(patients.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(operations).where(eq(operations.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(surgeryImplants).where(eq(surgeryImplants.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(visites).where(and(eq(visites.organisationId, organisationId), sql`${visites.isq} IS NOT NULL`)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(documents).where(eq(documents.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select().from(calendarIntegrations).where(eq(calendarIntegrations.organisationId, organisationId)).then(rows => rows[0]),
        db.select({ count: sql<number>`count(*)` }).from(notificationPreferences).where(and(eq(notificationPreferences.organisationId, organisationId), eq(notificationPreferences.inAppEnabled, true))).then(r => Number(r[0]?.count || 0))
      ]);

      // Build checklist items (real data OR manually marked as complete)
      const items = [
        {
          id: "clinic",
          label: "Renseigner les infos du cabinet",
          completed: manuallyCompleted["clinic"] || !!(onboardingData.clinicName && onboardingData.clinicName.trim().length > 0),
          actionUrl: "/settings?tab=organisation",
          wizardStep: 1
        },
        {
          id: "team",
          label: "Ajouter un collaborateur",
          completed: manuallyCompleted["team"] || userCount >= 2,
          actionUrl: "/settings?tab=collaborators",
          wizardStep: 2
        },
        {
          id: "patient",
          label: "Ajouter des patients",
          completed: manuallyCompleted["patient"] || patientCount >= 1,
          actionUrl: "/patients",
          wizardStep: 3
        },
        {
          id: "act",
          label: "Créer un acte",
          completed: manuallyCompleted["act"] || operationCount >= 1,
          actionUrl: "/actes",
          wizardStep: 4
        },
        {
          id: "implant",
          label: "Poser un implant",
          completed: manuallyCompleted["implant"] || surgeryImplantCount >= 1,
          actionUrl: "/actes",
          wizardStep: 4
        },
        {
          id: "isq",
          label: "Renseigner un ISQ",
          completed: manuallyCompleted["isq"] || isqCount >= 1,
          actionUrl: "/patients",
          wizardStep: null
        },
        {
          id: "calendar",
          label: "Créer un rendez-vous",
          completed: manuallyCompleted["calendar"] || appointmentCount >= 1,
          actionUrl: "/calendar",
          wizardStep: 5
        },
        {
          id: "google",
          label: "Connecter Google Calendar",
          completed: manuallyCompleted["google"] || !!(calendarIntegration?.accessToken),
          actionUrl: "/settings?tab=integrations",
          wizardStep: 5
        },
        {
          id: "notifications",
          label: "Activer les notifications",
          completed: manuallyCompleted["notifications"] || notificationEnabledCount >= 1,
          actionUrl: "/settings?tab=notifications",
          wizardStep: 6
        },
        {
          id: "documents",
          label: "Ajouter un document",
          completed: manuallyCompleted["documents"] || documentCount >= 1,
          actionUrl: "/documents",
          wizardStep: 7
        }
      ];

      const completedCount = items.filter(i => i.completed).length;

      res.json({
        completedCount,
        totalCount: items.length,
        items
      });
    } catch (error: any) {
      console.error("[Onboarding] Error getting checklist:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/onboarding - Get onboarding state for organisation
  app.get("/api/onboarding", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Try to get existing state
      let state = await db
        .select()
        .from(onboardingState)
        .where(eq(onboardingState.organisationId, organisationId))
        .then(rows => rows[0]);

      // If no state exists, create one
      if (!state) {
        const [newState] = await db
          .insert(onboardingState)
          .values({
            organisationId,
            currentStep: 0,
            completedSteps: "{}",
            skippedSteps: "{}",
            data: "{}",
            status: "IN_PROGRESS",
          })
          .returning();
        state = newState;
      }

      // Parse JSON fields
      const response = {
        ...state,
        completedSteps: JSON.parse(state.completedSteps || "{}"),
        skippedSteps: JSON.parse(state.skippedSteps || "{}"),
        data: JSON.parse(state.data || "{}") as OnboardingData,
      };

      res.json(response);
    } catch (error: any) {
      console.error("[Onboarding] Error getting state:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/onboarding - Update onboarding state
  app.patch("/api/onboarding", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { currentStep, markCompleteStep, markSkipStep, dataPatch } = req.body as {
        currentStep?: number;
        markCompleteStep?: number;
        markSkipStep?: number;
        dataPatch?: Partial<OnboardingData>;
      };

      // Required steps that cannot be skipped
      const requiredSteps = [0, 1, 3, 4];

      // Prevent skipping required steps
      if (markSkipStep !== undefined && requiredSteps.includes(markSkipStep)) {
        return res.status(400).json({ 
          error: "Cette etape est obligatoire et ne peut pas etre passee",
          requiredStep: markSkipStep 
        });
      }

      // Get existing state
      let state = await db
        .select()
        .from(onboardingState)
        .where(eq(onboardingState.organisationId, organisationId))
        .then(rows => rows[0]);

      if (!state) {
        return res.status(404).json({ error: "Onboarding state not found" });
      }

      // Parse existing JSON fields
      let completedSteps = JSON.parse(state.completedSteps || "{}") as Record<string, boolean>;
      let skippedSteps = JSON.parse(state.skippedSteps || "{}") as Record<string, boolean>;
      let data = JSON.parse(state.data || "{}") as OnboardingData;

      // Apply updates
      if (markCompleteStep !== undefined) {
        completedSteps[String(markCompleteStep)] = true;
        // Remove from skipped if was skipped
        delete skippedSteps[String(markCompleteStep)];
      }

      if (markSkipStep !== undefined) {
        skippedSteps[String(markSkipStep)] = true;
        // Also mark as completed for progress tracking
        completedSteps[String(markSkipStep)] = true;
      }

      if (dataPatch) {
        data = { ...data, ...dataPatch };
      }

      // Update the state
      const updateData: any = {
        updatedAt: new Date(),
        completedSteps: JSON.stringify(completedSteps),
        skippedSteps: JSON.stringify(skippedSteps),
        data: JSON.stringify(data),
      };

      if (currentStep !== undefined) {
        updateData.currentStep = currentStep;
      }

      const [updatedState] = await db
        .update(onboardingState)
        .set(updateData)
        .where(eq(onboardingState.organisationId, organisationId))
        .returning();

      // Parse and return response
      const response = {
        ...updatedState,
        completedSteps: JSON.parse(updatedState.completedSteps || "{}"),
        skippedSteps: JSON.parse(updatedState.skippedSteps || "{}"),
        data: JSON.parse(updatedState.data || "{}") as OnboardingData,
      };

      res.json(response);
    } catch (error: any) {
      console.error("[Onboarding] Error updating state:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/onboarding/complete - Mark onboarding as completed
  app.post("/api/onboarding/complete", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Get existing state
      const state = await db
        .select()
        .from(onboardingState)
        .where(eq(onboardingState.organisationId, organisationId))
        .then(rows => rows[0]);

      if (!state) {
        return res.status(404).json({ error: "Onboarding state not found" });
      }

      const completedSteps = JSON.parse(state.completedSteps || "{}") as Record<string, boolean>;
      const skippedSteps = JSON.parse(state.skippedSteps || "{}") as Record<string, boolean>;

      // Check required steps (0, 1, 3, 4 are required)
      const requiredSteps = [0, 1, 3, 4];
      const missingSteps = requiredSteps.filter(step => !completedSteps[String(step)]);

      if (missingSteps.length > 0) {
        return res.status(400).json({
          error: "Required steps not completed",
          missingSteps,
        });
      }

      // Mark as completed
      const [updatedState] = await db
        .update(onboardingState)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(onboardingState.organisationId, organisationId))
        .returning();

      res.json({
        success: true,
        redirectTo: "/dashboard",
        state: {
          ...updatedState,
          completedSteps: JSON.parse(updatedState.completedSteps || "{}"),
          skippedSteps: JSON.parse(updatedState.skippedSteps || "{}"),
          data: JSON.parse(updatedState.data || "{}"),
        },
      });
    } catch (error: any) {
      console.error("[Onboarding] Error completing:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/onboarding/dismiss - Hide onboarding widget
  app.post("/api/onboarding/dismiss", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const [updatedState] = await db
        .update(onboardingState)
        .set({
          dismissed: true,
          dismissedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(onboardingState.organisationId, organisationId))
        .returning();

      if (!updatedState) {
        return res.status(404).json({ error: "Onboarding state not found" });
      }

      res.json({
        success: true,
        state: {
          ...updatedState,
          completedSteps: JSON.parse(updatedState.completedSteps || "{}"),
          skippedSteps: JSON.parse(updatedState.skippedSteps || "{}"),
          data: JSON.parse(updatedState.data || "{}"),
        },
      });
    } catch (error: any) {
      console.error("[Onboarding] Error dismissing:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/onboarding/show - Show onboarding widget again
  app.post("/api/onboarding/show", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const [updatedState] = await db
        .update(onboardingState)
        .set({
          dismissed: false,
          dismissedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(onboardingState.organisationId, organisationId))
        .returning();

      if (!updatedState) {
        return res.status(404).json({ error: "Onboarding state not found" });
      }

      res.json({
        success: true,
        state: {
          ...updatedState,
          completedSteps: JSON.parse(updatedState.completedSteps || "{}"),
          skippedSteps: JSON.parse(updatedState.skippedSteps || "{}"),
          data: JSON.parse(updatedState.data || "{}"),
        },
      });
    } catch (error: any) {
      console.error("[Onboarding] Error showing:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/onboarding/checklist/:itemId/mark-done - Mark a checklist item as done manually
  app.post("/api/onboarding/checklist/:itemId/mark-done", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;
    const userId = req.jwtUser?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    const { itemId } = req.params;

    // Valid checklist item IDs
    const validItems = ["clinic", "team", "patient", "act", "implant", "isq", "calendar", "google", "notifications", "documents"];
    if (!validItems.includes(itemId)) {
      return res.status(400).json({ error: "Invalid checklist item ID" });
    }

    try {
      // Get existing state
      let state = await db
        .select()
        .from(onboardingState)
        .where(eq(onboardingState.organisationId, organisationId))
        .then(rows => rows[0]);

      if (!state) {
        return res.status(404).json({ error: "Onboarding state not found" });
      }

      // Store manual completion overrides in onboardingState.data.manuallyCompleted
      const onboardingData = JSON.parse(state.data || "{}") as OnboardingData & { manuallyCompleted?: Record<string, boolean> };
      const manuallyCompleted = onboardingData.manuallyCompleted || {};
      manuallyCompleted[itemId] = true;
      onboardingData.manuallyCompleted = manuallyCompleted;

      await db
        .update(onboardingState)
        .set({
          data: JSON.stringify(onboardingData),
          updatedAt: new Date(),
        })
        .where(eq(onboardingState.organisationId, organisationId));

      // Re-fetch checklist to check if all items are now complete
      const [
        userCount,
        patientCount,
        operationCount,
        surgeryImplantCount,
        isqCount,
        appointmentCount,
        documentCount,
        calendarIntegration,
        notificationEnabledCount
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(patients).where(eq(patients.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(operations).where(eq(operations.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(surgeryImplants).where(eq(surgeryImplants.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(visites).where(and(eq(visites.organisationId, organisationId), sql`${visites.isq} IS NOT NULL`)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`count(*)` }).from(documents).where(eq(documents.organisationId, organisationId)).then(r => Number(r[0]?.count || 0)),
        db.select().from(calendarIntegrations).where(eq(calendarIntegrations.organisationId, organisationId)).then(rows => rows[0]),
        db.select({ count: sql<number>`count(*)` }).from(notificationPreferences).where(and(eq(notificationPreferences.organisationId, organisationId), eq(notificationPreferences.inAppEnabled, true))).then(r => Number(r[0]?.count || 0))
      ]);

      // Calculate completion with manual overrides
      const mc = onboardingData.manuallyCompleted || {};
      const items = [
        { id: "clinic", completed: mc["clinic"] || !!(onboardingData.clinicName && onboardingData.clinicName.trim().length > 0) },
        { id: "team", completed: mc["team"] || userCount >= 2 },
        { id: "patient", completed: mc["patient"] || patientCount >= 1 },
        { id: "act", completed: mc["act"] || operationCount >= 1 },
        { id: "implant", completed: mc["implant"] || surgeryImplantCount >= 1 },
        { id: "isq", completed: mc["isq"] || isqCount >= 1 },
        { id: "calendar", completed: mc["calendar"] || appointmentCount >= 1 },
        { id: "google", completed: mc["google"] || !!(calendarIntegration?.accessToken) },
        { id: "notifications", completed: mc["notifications"] || notificationEnabledCount >= 1 },
        { id: "documents", completed: mc["documents"] || documentCount >= 1 },
      ];

      const allCompleted = items.every(i => i.completed);

      if (allCompleted) {
        // Check if we already created the completion notification
        const existingNotif = await db
          .select()
          .from(notifications)
          .where(and(
            eq(notifications.organisationId, organisationId),
            eq(notifications.type, "ONBOARDING_COMPLETED")
          ))
          .then(rows => rows[0]);

        if (!existingNotif) {
          // Create onboarding completed notification
          await db.insert(notifications).values({
            organisationId,
            recipientUserId: userId,
            kind: "SYSTEM",
            type: "ONBOARDING_COMPLETED",
            severity: "INFO",
            title: "Onboarding terminé",
            message: "Félicitations ! Vous avez terminé la configuration de Cassius.",
          });
        }
      }

      res.json({ success: true, itemId, allCompleted });
    } catch (error: any) {
      console.error("[Onboarding] Error marking item done:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/onboarding/demo - Generate demo data for the organization (atomic transaction)
  app.post("/api/onboarding/demo", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      // Use transaction for atomicity - all or nothing
      const result = await db.transaction(async (tx) => {
        // Check if demo data already exists (inside transaction for isolation)
        const existingPatients = await tx
          .select({ count: sql<number>`count(*)` })
          .from(patients)
          .where(eq(patients.organisationId, organisationId));
        
        if (Number(existingPatients[0]?.count || 0) > 0) {
          throw new Error("EXISTING_DATA");
        }

        // Demo patients data
        const demoPatients = [
          { nom: "Dupont", prenom: "Marie", dateNaissance: "1985-03-15", sexe: "F" as const, telephone: "0612345678", email: "marie.dupont@email.fr" },
          { nom: "Martin", prenom: "Jean", dateNaissance: "1972-08-22", sexe: "M" as const, telephone: "0698765432", email: "jean.martin@email.fr" },
          { nom: "Bernard", prenom: "Sophie", dateNaissance: "1990-11-30", sexe: "F" as const, telephone: "0645678901", email: "sophie.bernard@email.fr" },
          { nom: "Petit", prenom: "Pierre", dateNaissance: "1968-05-10", sexe: "M" as const, telephone: "0654321098", email: "pierre.petit@email.fr" },
          { nom: "Robert", prenom: "Isabelle", dateNaissance: "1978-02-28", sexe: "F" as const, telephone: "0687654321", email: "isabelle.robert@email.fr" },
        ];

        // Create patients
        const createdPatients = await tx.insert(patients).values(
          demoPatients.map(p => ({
            organisationId,
            nom: p.nom,
            prenom: p.prenom,
            dateNaissance: p.dateNaissance,
            sexe: p.sexe,
            telephone: p.telephone,
            email: p.email,
            statut: "ACTIF" as const,
          }))
        ).returning();

        // Create demo implants catalog
        const demoImplants = [
          { marque: "Nobel Biocare", referenceFabricant: "NB-Replace CC", diametre: 4.3, longueur: 11.5 },
          { marque: "Straumann", referenceFabricant: "BL Roxolid", diametre: 4.1, longueur: 10.0 },
          { marque: "Zimmer Biomet", referenceFabricant: "TSV", diametre: 4.0, longueur: 13.0 },
        ];

        const createdImplants = await tx.insert(implants).values(
          demoImplants.map(i => ({
            organisationId,
            typeImplant: "IMPLANT" as const,
            marque: i.marque,
            referenceFabricant: i.referenceFabricant,
            diametre: i.diametre,
            longueur: i.longueur,
          }))
        ).returning();

        // Create demo operations with implants
        const today = new Date();
        const demoOperations = [
          { patientIdx: 0, implantIdx: 0, daysAgo: 90, siteFdi: "36", typeIntervention: "POSE" as const, isqPose: 72 },
          { patientIdx: 1, implantIdx: 1, daysAgo: 60, siteFdi: "46", typeIntervention: "POSE" as const, isqPose: 68 },
          { patientIdx: 2, implantIdx: 2, daysAgo: 30, siteFdi: "24", typeIntervention: "POSE" as const, isqPose: 75 },
          { patientIdx: 3, implantIdx: 0, daysAgo: 120, siteFdi: "11", typeIntervention: "POSE" as const, isqPose: 70 },
          { patientIdx: 4, implantIdx: 1, daysAgo: 45, siteFdi: "21", typeIntervention: "POSE" as const, isqPose: 65 },
        ];

        for (const op of demoOperations) {
          const opDate = new Date(today);
          opDate.setDate(opDate.getDate() - op.daysAgo);
          const dateStr = opDate.toISOString().split("T")[0];

          const [createdOp] = await tx.insert(operations).values({
            organisationId,
            patientId: createdPatients[op.patientIdx].id,
            dateOperation: dateStr,
            typeIntervention: op.typeIntervention,
          }).returning();

          await tx.insert(surgeryImplants).values({
            organisationId,
            surgeryId: createdOp.id,
            implantId: createdImplants[op.implantIdx].id,
            siteFdi: op.siteFdi,
            datePose: dateStr,
            isqPose: op.isqPose,
            statut: "EN_SUIVI" as const,
          });
        }

        // Create demo appointments
        const futureAppointments = [
          { patientIdx: 0, daysFromNow: 7, type: "SUIVI" as const },
          { patientIdx: 1, daysFromNow: 14, type: "CONTROLE" as const },
          { patientIdx: 2, daysFromNow: 3, type: "CONSULTATION" as const },
        ];

        for (const apt of futureAppointments) {
          const aptDate = new Date(today);
          aptDate.setDate(aptDate.getDate() + apt.daysFromNow);
          aptDate.setHours(10, 0, 0, 0);

          const typeLabel = apt.type === "SUIVI" ? "Suivi" : apt.type === "CONTROLE" ? "Contrôle" : "Consultation";
          await tx.insert(appointments).values({
            organisationId,
            patientId: createdPatients[apt.patientIdx].id,
            titre: `${typeLabel} - ${createdPatients[apt.patientIdx].prenom} ${createdPatients[apt.patientIdx].nom}`,
            dateDebut: aptDate,
            dateFin: new Date(aptDate.getTime() + 30 * 60000),
            typeRdv: apt.type,
            statut: "PLANIFIE",
          });
        }

        return {
          patients: createdPatients.length,
          implants: createdImplants.length,
          operations: demoOperations.length,
          appointments: futureAppointments.length,
        };
      });

      res.json({ success: true, created: result });
    } catch (error: any) {
      if (error.message === "EXISTING_DATA") {
        return res.status(400).json({ error: "Des données existent déjà dans cette organisation" });
      }
      console.error("[Onboarding] Error generating demo data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
