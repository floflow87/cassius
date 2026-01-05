import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, computeLatestIsq } from "./storage";
import { requireJwtOrSession } from "./jwtMiddleware";
import * as supabaseStorage from "./supabaseStorage";
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
} from "@shared/schema";
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
import { eq, sql, and, inArray, desc } from "drizzle-orm";

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

    try {
      const data = insertPatientSchema.partial().parse(req.body);
      const patient = await storage.updatePatient(organisationId, req.params.id, data);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
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

  // ========== DOCUMENTS (PDF) ==========
  
  // Get document tree structure for explorer
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

  // Get unified files list (documents + radios combined)
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

  // Get all documents for a patient (signed URLs fetched on-demand)
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
      
      // Send notification about new document
      if (userId) {
        await notificationService.notificationEvents.onDocumentUploaded({
          organisationId,
          recipientUserId: userId,
          actorUserId: userId,
          documentId: doc.id,
          documentName: doc.title || doc.fileName,
          patientId: doc.patientId || undefined,
        });
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
          
          // Send notification for low ISQ (< 60)
          if (data.isq < 60) {
            const userId = req.jwtUser?.userId;
            if (userId) {
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
      const { from, to } = req.query;
      const dateFrom = from ? String(from) : undefined;
      const dateTo = to ? String(to) : undefined;
      const stats = await storage.getClinicalStats(organisationId, dateFrom, dateTo);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching clinical stats:", error);
      res.status(500).json({ error: "Failed to fetch clinical stats" });
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
      
      // Send notification about new appointment
      const userId = req.jwtUser?.userId;
      if (userId) {
        await notificationService.notificationEvents.onAppointmentCreated({
          organisationId,
          recipientUserId: userId,
          actorUserId: userId,
          appointmentId: appointment.id,
          appointmentDate: appointment.dateStart.toISOString(),
          patientId,
        });
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
      
      await storage.updateUser(id, { role: role as "ADMIN" | "CHIRURGIEN" | "ASSISTANT" });
      
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

  // ==================== NOTIFICATION ROUTES ====================

  // Get notifications list
  app.get("/api/notifications", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const { kind, unreadOnly, page, pageSize } = req.query;
      
      const result = await notificationService.getNotifications(userId, organisationId, {
        kind: kind as any,
        unreadOnly: unreadOnly === 'true',
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 20,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Notifications] Error fetching notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get unread count
  app.get("/api/notifications/unread-count", requireJwtOrSession, async (req, res) => {
    try {
      const organisationId = getOrganisationId(req, res);
      if (!organisationId) return;
      const userId = req.jwtUser?.userId;
      if (!userId) return res.status(401).json({ error: "Utilisateur non authentifie" });

      const count = await notificationService.getUnreadCount(userId, organisationId);
      res.json({ count });
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
      const { frequency, inAppEnabled, emailEnabled, digestTime } = req.body;
      
      const preference = await notificationService.updatePreference(
        userId,
        organisationId,
        category as any,
        { frequency, inAppEnabled, emailEnabled, digestTime }
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

  return httpServer;
}
