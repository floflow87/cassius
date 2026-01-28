import crypto from "crypto";
import * as repo from "./repo";
import type { DocumentFilters, CreateDocumentInput, UpdateDocumentInput, DocumentUploadRequest, DocumentUploadResponse } from "./types";
import { NotFoundError } from "../../lib/errors";

interface StorageProvider {
  isStorageConfigured(): boolean;
  createSignedUploadUrl(path: string): Promise<{ signedUrl: string; token: string; path: string }>;
  getSignedDownloadUrl(path: string, expiresIn?: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
}

let storageProvider: StorageProvider | null = null;

export function setStorageProvider(provider: StorageProvider) {
  storageProvider = provider;
}

function getStorage(): StorageProvider {
  if (!storageProvider) {
    console.error("[Documents] Storage provider not set");
    throw new Error("Storage provider not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }
  if (!storageProvider.isStorageConfigured()) {
    console.error("[Documents] Storage not configured - missing env vars");
    throw new Error("Supabase Storage is not properly configured. Check environment variables.");
  }
  return storageProvider;
}

export async function getDocument(organisationId: string, id: string) {
  const doc = await repo.getById(organisationId, id);
  if (!doc) {
    throw new NotFoundError("Document", id);
  }
  return doc;
}

export async function getPatientDocuments(organisationId: string, patientId: string) {
  return repo.getByPatientId(organisationId, patientId);
}

export async function getOperationDocuments(organisationId: string, operationId: string) {
  return repo.getByOperationId(organisationId, operationId);
}

export async function getDocumentsFiltered(organisationId: string, filters: DocumentFilters) {
  return repo.getFiltered(organisationId, filters);
}

export async function getDocumentTree(organisationId: string) {
  return repo.getTree(organisationId);
}

export async function createUploadUrl(
  organisationId: string, 
  request: DocumentUploadRequest
): Promise<DocumentUploadResponse> {
  const storage = getStorage();
  const documentId = crypto.randomUUID();
  
  const safeName = request.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  
  let filePath: string;
  if (request.patientId) {
    filePath = `org/${organisationId}/patients/${request.patientId}/documents/${documentId}/${safeName}`;
  } else {
    filePath = `org/${organisationId}/documents/${documentId}/${safeName}`;
  }

  const { signedUrl, token, path } = await storage.createSignedUploadUrl(filePath);

  return {
    documentId,
    signedUrl,
    token,
    filePath: path,
    patientId: request.patientId || null,
    operationId: request.operationId || null,
  };
}

export async function createDocument(organisationId: string, data: CreateDocumentInput) {
  return repo.create(organisationId, data);
}

export async function updateDocument(organisationId: string, id: string, data: UpdateDocumentInput) {
  const doc = await repo.update(organisationId, id, data);
  if (!doc) {
    throw new NotFoundError("Document", id);
  }
  return doc;
}

export async function deleteDocument(organisationId: string, id: string) {
  const doc = await repo.getById(organisationId, id);
  if (!doc) {
    throw new NotFoundError("Document", id);
  }

  const storage = getStorage();
  if (doc.filePath && storage.isStorageConfigured()) {
    try {
      await storage.deleteFile(doc.filePath);
    } catch (err) {
      console.error("Failed to delete document from storage:", err);
    }
  }

  const deleted = await repo.remove(organisationId, id);
  if (!deleted) {
    throw new NotFoundError("Document", id);
  }

  return true;
}

export async function getSignedUrl(organisationId: string, id: string, expiresIn = 3600): Promise<string> {
  const doc = await repo.getById(organisationId, id);
  if (!doc) {
    throw new NotFoundError("Document", id);
  }

  const storage = getStorage();
  if (!doc.filePath || !storage.isStorageConfigured()) {
    throw new Error("Storage not configured or document has no file path");
  }

  return storage.getSignedDownloadUrl(doc.filePath, expiresIn);
}
