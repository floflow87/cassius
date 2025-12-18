import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireJwtOrSession } from "./jwtMiddleware";
import * as supabaseStorage from "./supabaseStorage";
import {
  insertPatientSchema,
  insertOperationSchema,
  insertImplantSchema,
  insertRadioSchema,
  insertVisiteSchema,
  insertProtheseSchema,
  insertNoteSchema,
  insertRendezVousSchema,
  insertDocumentSchema,
  updateDocumentSchema,
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

  app.get("/api/patients/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const patient = await storage.getPatientWithDetails(organisationId, req.params.id);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Add signed URLs to radios
      if (supabaseStorage.isStorageConfigured() && patient.radios && patient.radios.length > 0) {
        const filePaths = patient.radios.map(r => r.filePath).filter(Boolean) as string[];
        if (filePaths.length > 0) {
          const signedUrls = await supabaseStorage.getSignedUrls(filePaths);
          patient.radios = patient.radios.map(radio => ({
            ...radio,
            signedUrl: radio.filePath ? signedUrls.get(radio.filePath) || null : null,
          }));
        }
      }
      
      res.json(patient);
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

  // ========== OPERATIONS ==========
  app.get("/api/operations/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const operation = await storage.getOperation(organisationId, req.params.id);
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

  // Get surgery implant with details (implant posé avec patient, surgery, visites, radios)
  app.get("/api/surgery-implants/:id", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const surgeryImplant = await storage.getSurgeryImplantWithDetails(organisationId, req.params.id);
      if (!surgeryImplant) {
        return res.status(404).json({ error: "Implant not found" });
      }
      res.json(surgeryImplant);
    } catch (error) {
      console.error("Error fetching surgery implant:", error);
      res.status(500).json({ error: "Failed to fetch surgery implant" });
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
      res.json(surgeryImplants);
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
  app.get("/api/surgery-implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { marque, siteFdi, typeOs, statut } = req.query;
      if (marque || siteFdi || typeOs || statut) {
        const filtered = await storage.filterSurgeryImplants(organisationId, {
          marque: marque as string,
          siteFdi: siteFdi as string,
          typeOs: typeOs as string,
          statut: statut as string,
        });
        return res.json(filtered);
      }
      const surgeryImplants = await storage.getAllSurgeryImplants(organisationId);
      res.json(surgeryImplants);
    } catch (error) {
      console.error("Error fetching surgery implants:", error);
      res.status(500).json({ error: "Failed to fetch surgery implants" });
    }
  });

  // Legacy route - retourne les implants catalogue
  app.get("/api/implants", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { marque, siteFdi, typeOs, statut } = req.query;
      if (marque || siteFdi || typeOs || statut) {
        const filtered = await storage.filterSurgeryImplants(organisationId, {
          marque: marque as string,
          siteFdi: siteFdi as string,
          typeOs: typeOs as string,
          statut: statut as string,
        });
        return res.json(filtered);
      }
      // Retourne tous les surgery_implants enrichis (comportement équivalent à l'ancien)
      const surgeryImplants = await storage.getAllSurgeryImplants(organisationId);
      res.json(surgeryImplants);
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

  // Get all radios for a patient with signed URLs
  app.get("/api/patients/:patientId/radios", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const radios = await storage.getPatientRadios(organisationId, req.params.patientId);
      
      // Generate signed URLs for all radios
      if (supabaseStorage.isStorageConfigured() && radios.length > 0) {
        const filePaths = radios.map(r => r.filePath).filter(Boolean) as string[];
        const signedUrls = await supabaseStorage.getSignedUrls(filePaths);
        
        const radiosWithUrls = radios.map(radio => ({
          ...radio,
          signedUrl: radio.filePath ? signedUrls.get(radio.filePath) || null : null,
        }));
        
        return res.json(radiosWithUrls);
      }
      
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
  
  // Get signed upload URL for client-side document upload
  app.post("/api/documents/upload-url", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const { patientId, fileName, mimeType } = req.body;
      if (!patientId || !fileName) {
        return res.status(400).json({ error: "patientId and fileName are required" });
      }

      // Generate unique document ID
      const documentId = crypto.randomUUID();
      
      // Generate file path: org/{orgId}/patients/{patientId}/documents/{docId}/{filename}
      const filePath = `org/${organisationId}/patients/${patientId}/documents/${documentId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      // Get signed upload URL from Supabase
      const { signedUrl, token, path } = await supabaseStorage.createSignedUploadUrl(filePath);

      res.json({
        documentId,
        signedUrl,
        token,
        filePath: path,
      });
    } catch (error) {
      console.error("Error getting document upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Get all documents for a patient with signed URLs
  app.get("/api/patients/:patientId/documents", requireJwtOrSession, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const docs = await storage.getPatientDocuments(organisationId, req.params.patientId);
      
      // Generate signed URLs for all documents
      const docsWithUrls = await Promise.all(docs.map(async (doc) => {
        let signedUrl: string | null = null;
        if (doc.filePath && supabaseStorage.isStorageConfigured()) {
          try {
            signedUrl = await supabaseStorage.getSignedUrl(doc.filePath);
          } catch (err) {
            console.error("Failed to get signed URL for document:", err);
          }
        }
        return { ...doc, signedUrl };
      }));
      
      res.json(docsWithUrls);
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
      
      // Set appropriate headers
      res.setHeader("Content-Type", doc.mimeType || "application/pdf");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Content-Disposition", `inline; filename="${doc.fileName || 'document.pdf'}"`);
      
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

  return httpServer;
}
