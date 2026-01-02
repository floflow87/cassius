import { db } from "./db";
import { patients, importJobs, importJobRows } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ImportJob, ImportJobRow, InsertImportJob, InsertImportJobRow } from "@shared/schema";
import crypto from "crypto";

export interface CSVRow {
  [key: string]: string;
}

export interface NormalizedPatient {
  fileNumber?: string;
  ssn?: string;
  nom: string;
  prenom: string;
  dateNaissance?: string;
  sexe?: "HOMME" | "FEMME";
  telephone?: string;
  email?: string;
  addressFull?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  status: "ok" | "warning" | "error";
  normalized?: NormalizedPatient;
  errors: ValidationError[];
  warnings: ValidationError[];
  matchedPatientId?: string;
  matchType?: string;
}

export interface ImportStats {
  total: number;
  ok: number;
  warning: number;
  error: number;
  collision: number;
  toCreate: number;
  toUpdate: number;
}

function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const CSV_FIELD_MAPPINGS: Array<{ patterns: string[]; field: keyof NormalizedPatient }> = [
  { patterns: ["numerodedossier", "ndossier", "filenumber", "numero_dossier", "n_dossier"], field: "fileNumber" },
  { patterns: ["numeross", "nss", "ssn", "nir", "securitesociale"], field: "ssn" },
  { patterns: ["nom", "name", "lastname"], field: "nom" },
  { patterns: ["prenom", "firstname", "givenname"], field: "prenom" },
  { patterns: ["datedenaissance", "datenaissance", "date_naissance", "dob", "birthdate", "datenaiss"], field: "dateNaissance" },
  { patterns: ["sexe", "sex", "gender", "genre"], field: "sexe" },
  { patterns: ["telephone", "tel", "phone", "mobile", "portable"], field: "telephone" },
  { patterns: ["email", "mail", "courriel", "emailaddress"], field: "email" },
  { patterns: ["adresse", "address", "adressecomplete", "addressfull"], field: "addressFull" },
  { patterns: ["codepostal", "cp", "postalcode", "zipcode", "code_postal"], field: "codePostal" },
  { patterns: ["ville", "city", "commune", "localite"], field: "ville" },
  { patterns: ["pays", "country", "nation"], field: "pays" },
];

export function findFieldMapping(columnName: string): keyof NormalizedPatient | null {
  const normalized = normalizeColumnName(columnName);
  for (const mapping of CSV_FIELD_MAPPINGS) {
    if (mapping.patterns.includes(normalized)) {
      return mapping.field;
    }
  }
  return null;
}

export type ColumnMapping = Record<string, keyof NormalizedPatient | null>;

export function normalizeSSN(ssn: string | undefined): string | undefined {
  if (!ssn) return undefined;
  return ssn.replace(/[\s.-]/g, "").trim() || undefined;
}

export function normalizeFileNumber(fileNumber: string | undefined): string | undefined {
  if (!fileNumber) return undefined;
  return fileNumber.trim() || undefined;
}

export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/[\s.-]/g, "").trim() || undefined;
}

export function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : undefined;
}

export function parseDateFR(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  const frMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }
  
  return null;
}

export function parseSexe(sexe: string): "HOMME" | "FEMME" | null {
  if (!sexe) return null;
  const upper = sexe.trim().toUpperCase();
  if (upper === "M" || upper === "MASCULIN" || upper === "HOMME" || upper === "H") return "HOMME";
  if (upper === "F" || upper === "FEMININ" || upper === "FÉMININ" || upper === "FEMME") return "FEMME";
  return null;
}

export function extractAddressParts(addressFull: string | undefined): { codePostal?: string; ville?: string } {
  if (!addressFull) return {};
  
  const cpMatch = addressFull.match(/\b(\d{5})\b/);
  if (!cpMatch) return {};
  
  const codePostal = cpMatch[1];
  const afterCP = addressFull.substring(addressFull.indexOf(codePostal) + 5).trim();
  const ville = afterCP.split(/[,\n]/)[0]?.trim() || undefined;
  
  return { codePostal, ville };
}

export function mapCSVRow(row: CSVRow, customMapping?: ColumnMapping, debug = false): Partial<NormalizedPatient> {
  const result: Partial<NormalizedPatient> = {};
  
  for (const [csvKey, value] of Object.entries(row)) {
    // Use custom mapping if provided, otherwise auto-detect
    const mappedKey = customMapping ? customMapping[csvKey] : findFieldMapping(csvKey);
    if (mappedKey && value) {
      (result as any)[mappedKey] = value;
    }
    if (debug && !mappedKey && value) {
      console.log(`[IMPORT] Unmapped column: "${csvKey}" (normalized: "${normalizeColumnName(csvKey)}")`);
    }
  }
  
  if (debug) {
    console.log("[IMPORT] Mapped row:", JSON.stringify(result, null, 2));
  }
  
  return result;
}

export function normalizeRow(rawData: CSVRow, customMapping?: ColumnMapping, debug = false): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  const mapped = mapCSVRow(rawData, customMapping, debug);
  
  if (!mapped.nom) {
    errors.push({ field: "nom", message: "Nom requis" });
  }
  if (!mapped.prenom) {
    errors.push({ field: "prenom", message: "Prénom requis" });
  }
  
  let dateISO: string | undefined = undefined;
  if (!mapped.dateNaissance) {
    warnings.push({ field: "dateNaissance", message: "Date de naissance manquante" });
  } else {
    dateISO = parseDateFR(mapped.dateNaissance) || undefined;
    if (!dateISO) {
      warnings.push({ field: "dateNaissance", message: `Format date invalide: "${mapped.dateNaissance}" (attendu: jj/mm/aaaa)` });
    }
  }
  
  let sexe: "HOMME" | "FEMME" | undefined = undefined;
  if (!mapped.sexe) {
    warnings.push({ field: "sexe", message: "Sexe non renseigné" });
  } else {
    sexe = parseSexe(mapped.sexe) || undefined;
    if (!sexe) {
      warnings.push({ field: "sexe", message: `Sexe invalide: "${mapped.sexe}" (attendu: M, F, Homme, Femme)` });
    }
  }
  
  const email = normalizeEmail(mapped.email);
  if (mapped.email && !email) {
    warnings.push({ field: "email", message: "Email invalide, sera ignoré" });
  }
  
  let codePostal = mapped.codePostal;
  let ville = mapped.ville;
  if (mapped.addressFull && (!codePostal || !ville)) {
    const extracted = extractAddressParts(mapped.addressFull);
    codePostal = codePostal || extracted.codePostal;
    ville = ville || extracted.ville;
  }
  
  if (errors.length > 0) {
    return { status: "error", errors, warnings };
  }
  
  const normalized: NormalizedPatient = {
    fileNumber: normalizeFileNumber(mapped.fileNumber),
    ssn: normalizeSSN(mapped.ssn),
    nom: (mapped.nom || "").trim(),
    prenom: (mapped.prenom || "").trim(),
    dateNaissance: dateISO,
    sexe,
    telephone: normalizePhone(mapped.telephone),
    email,
    addressFull: mapped.addressFull?.trim(),
    codePostal,
    ville,
    pays: mapped.pays?.trim() || "France",
  };
  
  return {
    status: warnings.length > 0 ? "warning" : "ok",
    normalized,
    errors,
    warnings,
  };
}

export async function findMatchingPatient(
  organisationId: string,
  normalized: NormalizedPatient
): Promise<{ patientId?: string; matchType?: string }> {
  if (normalized.fileNumber) {
    const match = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.organisationId, organisationId),
          eq(patients.fileNumber, normalized.fileNumber)
        )
      )
      .limit(1);
    if (match.length > 0) {
      return { patientId: match[0].id, matchType: "file_number" };
    }
  }
  
  if (normalized.dateNaissance) {
    const nameMatch = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.organisationId, organisationId),
          sql`LOWER(${patients.nom}) = LOWER(${normalized.nom})`,
          sql`LOWER(${patients.prenom}) = LOWER(${normalized.prenom})`,
          eq(patients.dateNaissance, normalized.dateNaissance)
        )
      )
      .limit(1);
    if (nameMatch.length > 0) {
      return { patientId: nameMatch[0].id, matchType: "name_dob" };
    }
  }
  
  if (normalized.email) {
    const emailMatch = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.organisationId, organisationId),
          sql`LOWER(${patients.email}) = LOWER(${normalized.email})`
        )
      )
      .limit(1);
    if (emailMatch.length > 0) {
      return { patientId: emailMatch[0].id, matchType: "email" };
    }
  }
  
  return {};
}

export function parseCSV(content: string, debug = false): CSVRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const delimiter = lines[0].includes(";") ? ";" : ",";
  
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseRow(lines[0]);
  
  if (debug) {
    console.log("[IMPORT] CSV delimiter:", delimiter);
    console.log("[IMPORT] Detected headers:", headers);
    console.log("[IMPORT] Header mappings:");
    headers.forEach(h => {
      const mapped = findFieldMapping(h);
      console.log(`  "${h}" -> ${mapped || "(unmapped)"}`);
    });
  }
  
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length === 0 || values.every(v => !v)) continue;
    
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }
  
  if (debug && rows.length > 0) {
    console.log("[IMPORT] First raw row:", JSON.stringify(rows[0], null, 2));
  }
  
  return rows;
}

export function computeFileHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

export async function createImportJob(
  organisationId: string,
  userId: string | null,
  fileName: string,
  fileHash: string
): Promise<ImportJob> {
  const [job] = await db
    .insert(importJobs)
    .values({
      organisationId,
      userId,
      fileName,
      fileHash,
      type: "patients_csv",
      status: "pending",
    })
    .returning();
  return job;
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, jobId))
    .limit(1);
  return job || null;
}

export async function updateImportJobStatus(
  jobId: string,
  status: ImportJob["status"],
  stats?: ImportStats,
  errorMessage?: string
): Promise<void> {
  const updates: Partial<ImportJob> = { status };
  
  if (stats) {
    updates.stats = JSON.stringify(stats);
    updates.totalRows = stats.total;
  }
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }
  if (status === "validated") {
    updates.validatedAt = new Date();
  }
  if (status === "running") {
    updates.startedAt = new Date();
  }
  if (status === "completed" || status === "failed") {
    updates.completedAt = new Date();
  }
  
  await db.update(importJobs).set(updates).where(eq(importJobs.id, jobId));
}

export async function saveImportJobRows(
  jobId: string,
  rows: Array<{
    rowIndex: number;
    rawData: CSVRow;
    result: ValidationResult;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  
  const values: InsertImportJobRow[] = rows.map(row => ({
    jobId,
    rowIndex: row.rowIndex,
    rawData: JSON.stringify(row.rawData),
    normalizedData: row.result.normalized ? JSON.stringify(row.result.normalized) : null,
    status: row.result.status as any,
    errors: JSON.stringify(row.result.errors),
    warnings: JSON.stringify(row.result.warnings),
    matchedPatientId: row.result.matchedPatientId,
    matchType: row.result.matchType,
  }));
  
  const BATCH_SIZE = 500;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db.insert(importJobRows).values(batch);
  }
}

export async function getImportJobRows(
  jobId: string,
  status?: ImportJobRow["status"]
): Promise<ImportJobRow[]> {
  let query = db.select().from(importJobRows).where(eq(importJobRows.jobId, jobId));
  
  if (status) {
    query = db
      .select()
      .from(importJobRows)
      .where(and(eq(importJobRows.jobId, jobId), eq(importJobRows.status, status)));
  }
  
  return await query.orderBy(importJobRows.rowIndex);
}

export async function executeImport(
  jobId: string,
  organisationId: string
): Promise<ImportStats> {
  const rows = await getImportJobRows(jobId);
  
  const stats: ImportStats = {
    total: rows.length,
    ok: 0,
    warning: 0,
    error: 0,
    collision: 0,
    toCreate: 0,
    toUpdate: 0,
  };
  
  for (const row of rows) {
    if (row.status === "error") {
      stats.error++;
      continue;
    }
    
    if (!row.normalizedData) {
      stats.error++;
      continue;
    }
    
    const normalized: NormalizedPatient = JSON.parse(row.normalizedData);
    
    try {
      if (row.matchedPatientId) {
        await db
          .update(patients)
          .set({
            fileNumber: normalized.fileNumber,
            ssn: normalized.ssn,
            nom: normalized.nom,
            prenom: normalized.prenom,
            dateNaissance: normalized.dateNaissance,
            sexe: normalized.sexe,
            telephone: normalized.telephone,
            email: normalized.email,
            addressFull: normalized.addressFull,
            codePostal: normalized.codePostal,
            ville: normalized.ville,
            pays: normalized.pays,
          })
          .where(eq(patients.id, row.matchedPatientId));
        stats.toUpdate++;
      } else {
        await db.insert(patients).values({
          organisationId,
          fileNumber: normalized.fileNumber,
          ssn: normalized.ssn,
          nom: normalized.nom,
          prenom: normalized.prenom,
          dateNaissance: normalized.dateNaissance,
          sexe: normalized.sexe,
          telephone: normalized.telephone,
          email: normalized.email,
          addressFull: normalized.addressFull,
          codePostal: normalized.codePostal,
          ville: normalized.ville,
          pays: normalized.pays,
        });
        stats.toCreate++;
      }
      
      if (row.status === "warning") {
        stats.warning++;
      } else {
        stats.ok++;
      }
    } catch (error) {
      console.error(`Error importing row ${row.rowIndex}:`, error);
      stats.error++;
      
      await db
        .update(importJobRows)
        .set({ status: "error", errors: JSON.stringify([{ field: "db", message: String(error) }]) })
        .where(eq(importJobRows.id, row.id));
    }
  }
  
  return stats;
}
