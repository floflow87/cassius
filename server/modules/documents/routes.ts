import { Router, Request, Response } from "express";
import { z } from "zod";
import * as service from "./service";
import { 
  documentFiltersSchema, 
  uploadUrlRequestSchema, 
  createDocumentSchema, 
  updateDocumentSchema,
  confirmUploadSchema 
} from "./schemas";
import { isAppError } from "../../lib/errors";
import { logger } from "../../lib/logger";

export function createDocumentsRouter(
  requireAuth: (req: Request, res: Response, next: () => void) => void,
  getOrganisationId: (req: Request, res: Response) => string | undefined,
  getUserId: (req: Request) => string | undefined
) {
  const router = Router();

  router.get("/tree", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const tree = await service.getDocumentTree(organisationId);
      res.json(tree);
    } catch (error) {
      logger.error("Error fetching document tree", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to fetch document tree" });
    }
  });

  router.get("/", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const filters = documentFiltersSchema.parse({
        ...req.query,
        tags: req.query.tags 
          ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags])
          : undefined,
      });
      
      const result = await service.getDocumentsFiltered(organisationId, filters);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      logger.error("Error fetching documents", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  router.post("/upload-url", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = uploadUrlRequestSchema.parse(req.body);
      const result = await service.createUploadUrl(organisationId, data);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      const errorMessage = (error as Error).message || "Unknown error";
      logger.error("Error creating upload URL", { error: errorMessage });
      res.status(500).json({ error: "Failed to create upload URL", details: errorMessage });
    }
  });

  router.post("/confirm-upload", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const data = confirmUploadSchema.parse(req.body);
      const userId = getUserId(req);
      
      const doc = await service.createDocument(organisationId, {
        id: data.documentId,
        title: data.title,
        filePath: data.filePath,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        patientId: data.patientId,
        operationId: data.operationId,
        tags: data.tags,
        createdBy: userId,
      });
      
      res.status(201).json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      logger.error("Error confirming upload", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });

  router.get("/:id", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const doc = await service.getDocument(organisationId, req.params.id);
      res.json(doc);
    } catch (error) {
      if (isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error("Error fetching document", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  router.get("/:id/signed-url", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const signedUrl = await service.getSignedUrl(organisationId, req.params.id);
      res.json({ signedUrl });
    } catch (error) {
      if (isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error("Error generating signed URL", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to generate signed URL" });
    }
  });

  router.patch("/:id", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      const updates = updateDocumentSchema.parse(req.body);
      const doc = await service.updateDocument(organisationId, req.params.id, updates);
      res.json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      if (isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error("Error updating document", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    const organisationId = getOrganisationId(req, res);
    if (!organisationId) return;

    try {
      await service.deleteDocument(organisationId, req.params.id);
      res.status(204).send();
    } catch (error) {
      if (isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error("Error deleting document", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  return router;
}
