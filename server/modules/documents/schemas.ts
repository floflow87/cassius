import { z } from "zod";

export const documentFiltersSchema = z.object({
  scope: z.enum(["patients", "operations", "unclassified", "all"]).optional(),
  patientId: z.string().optional(),
  operationId: z.string().optional(),
  q: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional().transform(val => 
    val === undefined ? undefined : (Array.isArray(val) ? val : [val])
  ),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(["name", "date", "type", "size"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const uploadUrlRequestSchema = z.object({
  patientId: z.string().optional(),
  operationId: z.string().optional(),
  fileName: z.string().min(1, "fileName is required"),
  mimeType: z.string().optional(),
});

export const createDocumentSchema = z.object({
  id: z.string().optional(),
  patientId: z.string().nullable().optional(),
  operationId: z.string().nullable().optional(),
  title: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().nullable().optional(),
  fileName: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  patientId: z.string().nullable().optional(),
  operationId: z.string().nullable().optional(),
});

export const confirmUploadSchema = z.object({
  documentId: z.string(),
  title: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  patientId: z.string().nullable().optional(),
  operationId: z.string().nullable().optional(),
  filePath: z.string(),
  tags: z.array(z.string()).optional(),
});
