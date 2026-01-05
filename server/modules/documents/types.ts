import type { Document } from "@shared/schema";

export type { Document };

export interface DocumentFilters {
  scope?: "patients" | "operations" | "unclassified" | "all";
  patientId?: string;
  operationId?: string;
  q?: string;
  tags?: string[];
  from?: string;
  to?: string;
  sort?: "name" | "date" | "type" | "size";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface DocumentTreeItem {
  id: string;
  type: "folder" | "document";
  name: string;
  patientId?: string;
  operationId?: string;
  children?: DocumentTreeItem[];
  document?: Document;
}

export interface DocumentUploadRequest {
  patientId?: string;
  operationId?: string;
  fileName: string;
  mimeType?: string;
}

export interface DocumentUploadResponse {
  documentId: string;
  signedUrl: string;
  token: string;
  filePath: string;
  patientId: string | null;
  operationId: string | null;
}

export interface CreateDocumentInput {
  id?: string;
  patientId?: string | null;
  operationId?: string | null;
  title: string;
  filePath: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileName?: string | null;
  tags?: string[] | null;
  createdBy?: string | null;
}

export interface UpdateDocumentInput {
  title?: string;
  tags?: string[];
  patientId?: string | null;
  operationId?: string | null;
}

export interface PaginatedDocumentsResult {
  documents: Document[];
  total: number;
  page: number;
  pageSize: number;
}
