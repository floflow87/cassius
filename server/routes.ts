import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, computeLatestIsq } from "./storage";
import { requireJwtOrSession } from "./jwtMiddleware";
import * as supabaseStorage from "./supabaseStorage";
import { getTopSlowestEndpoints, getTopDbHeavyEndpoints, getAllStats, clearStats } from "./instrumentation";
import { runFlagDetection } from "./flagEngine";
import * as googleCalendar from "./googleCalendar";
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
import { eq } from "drizzle-orm";

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

      res.redirect(`${baseUrl}/settings/integrations/google-calendar?success=connected`);
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
      const { isEnabled, targetCalendarId, targetCalendarName } = req.body;
      
      let integration = await storage.getCalendarIntegration(organisationId);
      
      if (!integration) {
        return res.status(404).json({ error: "No integration found. Please connect first." });
      }

      integration = await storage.updateCalendarIntegration(organisationId, integration.id, {
        isEnabled: isEnabled ?? integration.isEnabled,
        targetCalendarId: targetCalendarId !== undefined ? targetCalendarId : integration.targetCalendarId,
        targetCalendarName: targetCalendarName !== undefined ? targetCalendarName : integration.targetCalendarName,
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

    try {
      const integration = await storage.getCalendarIntegration(organisationId);
      
      if (!integration || !integration.isEnabled || !integration.accessToken) {
        return res.status(400).json({ error: "Google Calendar integration not enabled or not connected" });
      }
      
      const calendarId = integration.targetCalendarId || "primary";
      
      // Get appointments that need syncing
      const appointments = await storage.getAppointmentsForSync(organisationId, integration.lastSyncAt ?? undefined);
      
      let synced = 0;
      let errors = 0;
      let tokensRefreshed = false;
      
      // Helper to persist refreshed tokens
      const persistRefreshedTokens = async (refreshedTokens?: { accessToken: string; expiresAt: Date }) => {
        if (refreshedTokens && !tokensRefreshed) {
          tokensRefreshed = true;
          await storage.updateCalendarIntegration(organisationId, integration.id, {
            accessToken: refreshedTokens.accessToken,
            tokenExpiresAt: refreshedTokens.expiresAt,
          });
        }
      };
      
      for (const apt of appointments) {
        try {
          const patient = apt.patient;
          const title = `[Cassius] ${apt.type} - ${patient?.prenom || ""} ${patient?.nom || ""}`.trim();
          const description = `Rendez-vous Cassius\nType: ${apt.type}\nPatient: ${patient?.prenom || ""} ${patient?.nom || ""}`;
          
          const startDate = new Date(apt.dateStart);
          const endDate = apt.dateEnd ? new Date(apt.dateEnd) : new Date(startDate.getTime() + 30 * 60 * 1000);
          
          if (apt.externalEventId) {
            // Update existing event
            const getResult = await googleCalendar.getCalendarEvent(integration, calendarId, apt.externalEventId);
            await persistRefreshedTokens(getResult.refreshedTokens);
            
            if (getResult.event) {
              const result = await googleCalendar.updateCalendarEvent(integration, {
                calendarId,
                eventId: apt.externalEventId,
                summary: title,
                description,
                start: startDate,
                end: endDate,
                cassiusAppointmentId: apt.id,
              });
              await persistRefreshedTokens(result.refreshedTokens);
              
              await storage.updateAppointmentSync(organisationId, apt.id, {
                syncStatus: "SYNCED",
                externalEtag: result.etag,
                lastSyncedAt: new Date(),
                syncError: null,
              });
            } else {
              // Event was deleted, recreate
              const result = await googleCalendar.createCalendarEvent(integration, {
                calendarId,
                summary: title,
                description,
                start: startDate,
                end: endDate,
                cassiusAppointmentId: apt.id,
              });
              await persistRefreshedTokens(result.refreshedTokens);
              
              await storage.updateAppointmentSync(organisationId, apt.id, {
                externalProvider: "google",
                externalCalendarId: calendarId,
                externalEventId: result.eventId,
                externalEtag: result.etag,
                syncStatus: "SYNCED",
                lastSyncedAt: new Date(),
                syncError: null,
              });
            }
          } else {
            // Create new event
            const result = await googleCalendar.createCalendarEvent(integration, {
              calendarId,
              summary: title,
              description,
              start: startDate,
              end: endDate,
              cassiusAppointmentId: apt.id,
            });
            await persistRefreshedTokens(result.refreshedTokens);
            
            await storage.updateAppointmentSync(organisationId, apt.id, {
              externalProvider: "google",
              externalCalendarId: calendarId,
              externalEventId: result.eventId,
              externalEtag: result.etag,
              syncStatus: "SYNCED",
              lastSyncedAt: new Date(),
              syncError: null,
            });
          }
          
          synced++;
        } catch (error: any) {
          console.error(`Error syncing appointment ${apt.id}:`, error);
          await storage.updateAppointmentSync(organisationId, apt.id, {
            syncStatus: "ERROR",
            syncError: error.message || "Unknown error",
          });
          errors++;
        }
      }
      
      // Update integration sync status
      await storage.updateIntegrationSyncStatus(organisationId, integration.id, {
        lastSyncAt: new Date(),
        syncErrorCount: errors,
        lastSyncError: errors > 0 ? `${errors} appointment(s) failed to sync` : null,
      });
      
      res.json({ synced, errors, total: appointments.length });
    } catch (error: any) {
      console.error("Error during sync:", error);
      res.status(500).json({ error: error.message || "Sync failed" });
    }
  });

  return httpServer;
}
