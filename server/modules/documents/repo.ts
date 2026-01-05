import { eq, and, sql, desc, asc, ilike, or, gte, lte } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { documents, patients, operations } from "@shared/schema";
import type { Document } from "@shared/schema";
import type { DocumentFilters, CreateDocumentInput, UpdateDocumentInput, PaginatedDocumentsResult } from "./types";

const db = getDb();

export async function getById(organisationId: string, id: string): Promise<Document | undefined> {
  const [doc] = await db.select().from(documents).where(
    and(eq(documents.id, id), eq(documents.organisationId, organisationId))
  );
  return doc;
}

export async function getByPatientId(organisationId: string, patientId: string): Promise<Document[]> {
  return db.select().from(documents).where(
    and(eq(documents.patientId, patientId), eq(documents.organisationId, organisationId))
  ).orderBy(desc(documents.createdAt));
}

export async function getByOperationId(organisationId: string, operationId: string): Promise<Document[]> {
  return db.select().from(documents).where(
    and(eq(documents.operationId, operationId), eq(documents.organisationId, organisationId))
  ).orderBy(desc(documents.createdAt));
}

export async function create(organisationId: string, data: CreateDocumentInput): Promise<Document> {
  const [doc] = await db.insert(documents).values({
    id: data.id,
    organisationId,
    patientId: data.patientId || null,
    operationId: data.operationId || null,
    title: data.title,
    filePath: data.filePath,
    mimeType: data.mimeType || null,
    sizeBytes: data.sizeBytes || null,
    fileName: data.fileName || null,
    tags: data.tags || null,
    createdBy: data.createdBy || null,
  }).returning();
  return doc;
}

export async function update(organisationId: string, id: string, data: UpdateDocumentInput): Promise<Document | undefined> {
  const [doc] = await db.update(documents)
    .set(data)
    .where(and(eq(documents.id, id), eq(documents.organisationId, organisationId)))
    .returning();
  return doc;
}

export async function remove(organisationId: string, id: string): Promise<boolean> {
  const result = await db.delete(documents).where(
    and(eq(documents.id, id), eq(documents.organisationId, organisationId))
  ).returning();
  return result.length > 0;
}

export async function getFiltered(organisationId: string, filters: DocumentFilters): Promise<PaginatedDocumentsResult> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 25;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(documents.organisationId, organisationId)];

  if (filters.scope === "patients") {
    conditions.push(sql`${documents.patientId} IS NOT NULL`);
  } else if (filters.scope === "operations") {
    conditions.push(sql`${documents.operationId} IS NOT NULL`);
  } else if (filters.scope === "unclassified") {
    conditions.push(sql`${documents.patientId} IS NULL AND ${documents.operationId} IS NULL`);
  }

  if (filters.patientId) {
    conditions.push(eq(documents.patientId, filters.patientId));
  }

  if (filters.operationId) {
    conditions.push(eq(documents.operationId, filters.operationId));
  }

  if (filters.q) {
    conditions.push(or(
      ilike(documents.title, `%${filters.q}%`),
      ilike(documents.fileName, `%${filters.q}%`)
    )!);
  }

  if (filters.from) {
    conditions.push(gte(documents.createdAt, new Date(filters.from)));
  }

  if (filters.to) {
    conditions.push(lte(documents.createdAt, new Date(filters.to)));
  }

  let orderBy;
  const direction = filters.sortDir === "desc" ? desc : asc;
  switch (filters.sort) {
    case "name":
      orderBy = direction(documents.title);
      break;
    case "type":
      orderBy = direction(documents.mimeType);
      break;
    case "size":
      orderBy = direction(documents.sizeBytes);
      break;
    case "date":
    default:
      orderBy = direction(documents.createdAt);
  }

  const whereClause = and(...conditions);

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(whereClause);

  const docs = await db.select()
    .from(documents)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  return {
    documents: docs,
    total: Number(countResult.count),
    page,
    pageSize,
  };
}

export async function getTree(organisationId: string) {
  const allDocs = await db.select().from(documents)
    .where(eq(documents.organisationId, organisationId))
    .orderBy(documents.title);

  const patientDocs = new Map<string, Document[]>();
  const operationDocs = new Map<string, Document[]>();
  const unclassified: Document[] = [];

  for (const doc of allDocs) {
    if (doc.patientId) {
      if (!patientDocs.has(doc.patientId)) {
        patientDocs.set(doc.patientId, []);
      }
      patientDocs.get(doc.patientId)!.push(doc);
    } else if (doc.operationId) {
      if (!operationDocs.has(doc.operationId)) {
        operationDocs.set(doc.operationId, []);
      }
      operationDocs.get(doc.operationId)!.push(doc);
    } else {
      unclassified.push(doc);
    }
  }

  const patientsList = await db.select({ id: patients.id, nom: patients.nom, prenom: patients.prenom })
    .from(patients)
    .where(eq(patients.organisationId, organisationId));

  const operationsList = await db.select({ id: operations.id, patientId: operations.patientId })
    .from(operations)
    .where(eq(operations.organisationId, organisationId));

  return {
    patients: patientsList.map(p => ({
      id: p.id,
      name: `${p.prenom} ${p.nom}`,
      documents: patientDocs.get(p.id) || [],
    })),
    operations: operationsList.map(o => ({
      id: o.id,
      patientId: o.patientId,
      documents: operationDocs.get(o.id) || [],
    })),
    unclassified,
  };
}
