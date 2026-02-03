import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, date, timestamp, real, boolean, pgEnum, bigint, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Table organisations (multi-tenant)
export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nom: text("nom").notNull(),
  adresse: text("adresse"),
  telephone: text("telephone"),
  timezone: text("timezone").default("Europe/Paris"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  operations: many(operations),
  implants: many(implants),
  surgeryImplants: many(surgeryImplants),
  visites: many(visites),
  appointments: many(appointments),
  radios: many(radios),
  protheses: many(protheses),
  documents: many(documents),
  flags: many(flags),
}));

export const sexeEnum = pgEnum("sexe", ["HOMME", "FEMME"]);

export const typeInterventionEnum = pgEnum("type_intervention", [
  "POSE_IMPLANT",
  "GREFFE_OSSEUSE", 
  "SINUS_LIFT",
  "EXTRACTION_IMPLANT_IMMEDIATE",
  "REPRISE_IMPLANT",
  "CHIRURGIE_GUIDEE",
  "POSE_PROTHESE"
]);

export const typeChirurgieTempsEnum = pgEnum("type_chirurgie_temps", ["UN_TEMPS", "DEUX_TEMPS"]);
export const typeChirurgieApprocheEnum = pgEnum("type_chirurgie_approche", ["LAMBEAU", "FLAPLESS"]);
export const typeMiseEnChargeEnum = pgEnum("type_mise_en_charge", ["IMMEDIATE", "PRECOCE", "DIFFEREE"]);
export const positionImplantEnum = pgEnum("position_implant", ["CRESTAL", "SOUS_CRESTAL", "SUPRA_CRESTAL"]);
export const typeOsEnum = pgEnum("type_os", ["D1", "D2", "D3", "D4"]);
export const statutImplantEnum = pgEnum("statut_implant", ["EN_SUIVI", "SUCCES", "COMPLICATION", "ECHEC"]);
export const typeRadioEnum = pgEnum("type_radio", ["PANORAMIQUE", "CBCT", "RETROALVEOLAIRE"]);
export const roleEnum = pgEnum("role", ["CHIRURGIEN", "ASSISTANT", "ADMIN"]);

// Enums pour les prothèses supra-implantaires
export const typeProtheseEnum = pgEnum("type_prothese", ["VISSEE", "SCELLEE"]);
export const typePilierEnum = pgEnum("type_pilier", ["DROIT", "ANGULE", "MULTI_UNIT"]);
export const quantiteProtheseEnum = pgEnum("quantite_prothese", ["UNITAIRE", "PLURALE"]);
export const mobiliteProtheseEnum = pgEnum("mobilite_prothese", ["AMOVIBLE", "FIXE"]);
export const typeNoteTagEnum = pgEnum("type_note_tag", ["CONSULTATION", "CHIRURGIE", "SUIVI", "COMPLICATION", "ADMINISTRATIVE"]);
export const typeRendezVousTagEnum = pgEnum("type_rdv_tag", ["CONSULTATION", "SUIVI", "CHIRURGIE"]);

// Enums pour les rendez-vous unifiés (appointments)
export const appointmentTypeEnum = pgEnum("appointment_type", [
  "CONSULTATION",
  "SUIVI", 
  "CHIRURGIE",
  "CONTROLE",
  "URGENCE",
  "AUTRE"
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "UPCOMING",
  "COMPLETED",
  "CANCELLED"
]);
export const syncStatusEnum = pgEnum("sync_status", [
  "NONE",
  "PENDING",
  "SYNCED",
  "ERROR"
]);

// Enums for V2 Google Calendar import
export const googleEventStatusEnum = pgEnum("google_event_status", [
  "confirmed",
  "tentative",
  "cancelled"
]);
export const syncConflictStatusEnum = pgEnum("sync_conflict_status", [
  "open",
  "resolved",
  "ignored"
]);
export const syncConflictSourceEnum = pgEnum("sync_conflict_source", [
  "google",
  "cassius"
]);
export const typeDocumentTagEnum = pgEnum("type_document_tag", ["DEVIS", "CONSENTEMENT", "COMPTE_RENDU", "ASSURANCE", "AUTRE"]);
export const statutPatientEnum = pgEnum("statut_patient", ["ACTIF", "INACTIF", "ARCHIVE"]);
export const typeImplantEnum = pgEnum("type_implant", ["IMPLANT", "MINI_IMPLANT", "PROTHESE"]);

export const savedFilterPageTypeEnum = pgEnum("saved_filter_page_type", ["patients", "implants", "actes", "protheses"]);

// Onboarding enums
export const onboardingStatusEnum = pgEnum("onboarding_status", ["IN_PROGRESS", "COMPLETED"]);
export const practiceTypeEnum = pgEnum("practice_type", ["SOLO", "CABINET"]);

// Flag system enums
export const flagLevelEnum = pgEnum("flag_level", ["CRITICAL", "WARNING", "INFO"]);
export const flagEntityTypeEnum = pgEnum("flag_entity_type", ["PATIENT", "OPERATION", "IMPLANT"]);
export const flagTypeEnum = pgEnum("flag_type", [
  // Critical (clinical)
  "ISQ_LOW",
  "ISQ_DECLINING",
  "LOW_SUCCESS_RATE",
  // Warning (follow-up)
  "NO_RECENT_ISQ",
  "NO_POSTOP_FOLLOWUP",
  "NO_RECENT_APPOINTMENT",
  // Follow-up reminders
  "FOLLOWUP_2M",
  "FOLLOWUP_4M",
  "FOLLOWUP_6M",
  "FOLLOWUP_12M",
  // Info (coherence)
  "IMPLANT_NO_OPERATION",
  "MISSING_DOCUMENT",
  "INCOMPLETE_DATA"
]);

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  fileNumber: text("file_number"),
  ssn: text("ssn"),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  dateNaissance: date("date_naissance"),
  sexe: sexeEnum("sexe"),
  telephone: text("telephone"),
  email: text("email"),
  adresse: text("adresse"),
  addressFull: text("address_full"),
  codePostal: text("code_postal"),
  ville: text("ville"),
  pays: text("pays").default("France"),
  allergies: text("allergies"),
  traitement: text("traitement"),
  conditions: text("conditions"),
  contexteMedical: text("contexte_medical"),
  statut: statutPatientEnum("statut").default("ACTIF"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientsRelations = relations(patients, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [patients.organisationId],
    references: [organisations.id],
  }),
  operations: many(operations),
  radios: many(radios),
  visites: many(visites),
  appointments: many(appointments),
  documents: many(documents),
}));

export const operations = pgTable("operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  dateOperation: date("date_operation").notNull(),
  typeIntervention: typeInterventionEnum("type_intervention").notNull(),
  typeChirurgieTemps: typeChirurgieTempsEnum("type_chirurgie_temps"),
  typeChirurgieApproche: typeChirurgieApprocheEnum("type_chirurgie_approche"),
  greffeOsseuse: boolean("greffe_osseuse").default(false),
  typeGreffe: text("type_greffe"),
  greffeQuantite: text("greffe_quantite"),
  greffeLocalisation: text("greffe_localisation"),
  typeMiseEnCharge: typeMiseEnChargeEnum("type_mise_en_charge"),
  conditionsMedicalesPreop: text("conditions_medicales_preop"),
  notesPerop: text("notes_perop"),
  observationsPostop: text("observations_postop"),
});

export const operationsRelations = relations(operations, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [operations.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [operations.patientId],
    references: [patients.id],
  }),
  surgeryImplants: many(surgeryImplants),
  radios: many(radios),
}));

// Table implants - référentiel/catalogue d'implants (informations produit uniquement)
export const implants = pgTable("implants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  typeImplant: typeImplantEnum("type_implant").default("IMPLANT").notNull(),
  marque: text("marque").notNull(),
  referenceFabricant: text("reference_fabricant"),
  diametre: real("diametre").notNull(),
  longueur: real("longueur").notNull(),
  lot: text("lot"), // Numéro de lot fabricant
  notes: text("notes"), // Notes générales sur ce type d'implant
  isFavorite: boolean("is_favorite").default(false).notNull(), // Marqué comme favori pour tri prioritaire
  // Champs spécifiques aux prothèses (optionnels, utilisés uniquement quand typeImplant = PROTHESE)
  typeProthese: typeProtheseEnum("type_prothese"), // vissée, scellée
  quantite: quantiteProtheseEnum("quantite"), // unitaire, plurale
  mobilite: mobiliteProtheseEnum("mobilite"), // amovible, fixe
  typePilier: typePilierEnum("type_pilier"), // multi-unit, droit, angulé
});

export const implantsRelations = relations(implants, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [implants.organisationId],
    references: [organisations.id],
  }),
  surgeryImplants: many(surgeryImplants),
  radios: many(radios),
  visites: many(visites),
  protheses: many(protheses),
}));

// Table de liaison surgery_implants - représente un implant posé lors d'une chirurgie
export const surgeryImplants = pgTable("surgery_implants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  surgeryId: varchar("surgery_id").notNull().references(() => operations.id, { onDelete: "cascade" }),
  implantId: varchar("implant_id").notNull().references(() => implants.id, { onDelete: "cascade" }),
  // Champs de pose
  siteFdi: text("site_fdi").notNull(),
  positionImplant: positionImplantEnum("position_implant"),
  typeOs: typeOsEnum("type_os"),
  miseEnCharge: typeMiseEnChargeEnum("mise_en_charge"),
  // Informations greffe spécifique à cet implant
  greffeOsseuse: boolean("greffe_osseuse").default(false),
  typeGreffe: text("type_greffe"),
  greffeQuantite: text("greffe_quantite"),
  // Temps chirurgical
  typeChirurgieTemps: typeChirurgieTempsEnum("type_chirurgie_temps"),
  // Mesures ISQ
  isqPose: real("isq_pose"),
  isq2m: real("isq_2m"),
  isq3m: real("isq_3m"),
  isq6m: real("isq_6m"),
  // Score de perte osseuse (0-5, où 0=excellent, 5=critique)
  boneLossScore: integer("bone_loss_score"),
  // Statut et dates
  statut: statutImplantEnum("statut").default("EN_SUIVI").notNull(),
  datePose: date("date_pose").notNull(),
  notes: text("notes"),
});

export const surgeryImplantsRelations = relations(surgeryImplants, ({ one }) => ({
  organisation: one(organisations, {
    fields: [surgeryImplants.organisationId],
    references: [organisations.id],
  }),
  surgery: one(operations, {
    fields: [surgeryImplants.surgeryId],
    references: [operations.id],
  }),
  implant: one(implants, {
    fields: [surgeryImplants.implantId],
    references: [implants.id],
  }),
}));

export const radios = pgTable("radios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  operationId: varchar("operation_id").references(() => operations.id, { onDelete: "set null" }),
  implantId: varchar("implant_id").references(() => implants.id, { onDelete: "set null" }),
  surgeryImplantId: varchar("surgery_implant_id").references(() => surgeryImplants.id, { onDelete: "set null" }),
  type: typeRadioEnum("type").notNull(),
  title: text("title").notNull(),
  filePath: text("file_path"), // Supabase Storage path (nullable for legacy data)
  url: text("url"), // Legacy Replit Object Storage URL (kept for backward compatibility)
  mimeType: text("mime_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  fileName: text("file_name"),
  date: date("date").notNull(),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const radiosRelations = relations(radios, ({ one }) => ({
  organisation: one(organisations, {
    fields: [radios.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [radios.patientId],
    references: [patients.id],
  }),
  operation: one(operations, {
    fields: [radios.operationId],
    references: [operations.id],
  }),
  implant: one(implants, {
    fields: [radios.implantId],
    references: [implants.id],
  }),
  surgeryImplant: one(surgeryImplants, {
    fields: [radios.surgeryImplantId],
    references: [surgeryImplants.id],
  }),
}));

export const visites = pgTable("visites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  implantId: varchar("implant_id").notNull().references(() => implants.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  isq: real("isq"), // Calculated weighted average: (V*2 + M + D) / 4
  isqVestibulaire: real("isq_vestibulaire"),
  isqMesial: real("isq_mesial"),
  isqDistal: real("isq_distal"),
  notes: text("notes"),
  radioId: varchar("radio_id").references(() => radios.id, { onDelete: "set null" }),
});

export const visitesRelations = relations(visites, ({ one }) => ({
  organisation: one(organisations, {
    fields: [visites.organisationId],
    references: [organisations.id],
  }),
  implant: one(implants, {
    fields: [visites.implantId],
    references: [implants.id],
  }),
  patient: one(patients, {
    fields: [visites.patientId],
    references: [patients.id],
  }),
  radio: one(radios, {
    fields: [visites.radioId],
    references: [radios.id],
  }),
}));

// Table prothèses supra-implantaires
export const protheses = pgTable("protheses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  implantId: varchar("implant_id").notNull().references(() => implants.id, { onDelete: "cascade" }),
  protheseUnitaire: boolean("prothese_unitaire").default(true).notNull(),
  typeProthese: typeProtheseEnum("type_prothese").notNull(),
  typePilier: typePilierEnum("type_pilier"),
  datePose: date("date_pose"),
  notes: text("notes"),
});

export const prothesesRelations = relations(protheses, ({ one }) => ({
  organisation: one(organisations, {
    fields: [protheses.organisationId],
    references: [organisations.id],
  }),
  implant: one(implants, {
    fields: [protheses.implantId],
    references: [implants.id],
  }),
}));

// Table notes patients
export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tag: typeNoteTagEnum("tag"),
  contenu: text("contenu").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notesRelations = relations(notes, ({ one }) => ({
  organisation: one(organisations, {
    fields: [notes.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [notes.patientId],
    references: [patients.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").default("ASSISTANT").notNull(),
  nom: text("nom"),
  prenom: text("prenom"),
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  wasInvited: boolean("was_invited").default(false),
  isOwner: boolean("is_owner").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
}));

// Table rendez-vous patients
export const rendezVous = pgTable("rendez_vous", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  titre: text("titre").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  heureDebut: text("heure_debut").notNull(),
  heureFin: text("heure_fin").notNull(),
  tag: typeRendezVousTagEnum("tag").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rendezVousRelations = relations(rendezVous, ({ one }) => ({
  organisation: one(organisations, {
    fields: [rendezVous.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [rendezVous.patientId],
    references: [patients.id],
  }),
}));

// Table appointments - RDV cliniques unifiés (remplace visites + rendez_vous)
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  operationId: varchar("operation_id").references(() => operations.id, { onDelete: "set null" }),
  surgeryImplantId: varchar("surgery_implant_id").references(() => surgeryImplants.id, { onDelete: "set null" }),
  type: appointmentTypeEnum("type").notNull(),
  status: appointmentStatusEnum("status").default("UPCOMING").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dateStart: timestamp("date_start").notNull(),
  dateEnd: timestamp("date_end"),
  isq: real("isq"), // Calculated weighted average: (V*2 + M + D) / 4
  isqVestibulaire: real("isq_vestibulaire"),
  isqMesial: real("isq_mesial"),
  isqDistal: real("isq_distal"),
  radioId: varchar("radio_id").references(() => radios.id, { onDelete: "set null" }),
  // Custom color override (nullable - when null, uses type-based color)
  color: text("color"),
  // Status timestamps
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  // Google Calendar sync preparation (future feature)
  externalProvider: text("external_provider"),
  externalCalendarId: text("external_calendar_id"),
  externalEventId: text("external_event_id"),
  syncStatus: syncStatusEnum("sync_status").default("NONE").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  externalEtag: text("external_etag"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  organisation: one(organisations, {
    fields: [appointments.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  operation: one(operations, {
    fields: [appointments.operationId],
    references: [operations.id],
  }),
  surgeryImplant: one(surgeryImplants, {
    fields: [appointments.surgeryImplantId],
    references: [surgeryImplants.id],
  }),
  radio: one(radios, {
    fields: [appointments.radioId],
    references: [radios.id],
  }),
}));

// Table calendar_integrations - Multi-tenant (org-level or user-level) Calendar settings
export const calendarIntegrations = pgTable("calendar_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").default("google").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  targetCalendarId: text("target_calendar_id"),
  targetCalendarName: text("target_calendar_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scope: text("scope"),
  providerUserEmail: text("provider_user_email"),
  lastSyncAt: timestamp("last_sync_at"),
  syncErrorCount: integer("sync_error_count").default(0).notNull(),
  lastSyncError: text("last_sync_error"),
  // V2: Import settings (Google -> Cassius)
  sourceCalendarId: text("source_calendar_id"),
  sourceCalendarName: text("source_calendar_name"),
  importEnabled: boolean("import_enabled").default(false),
  lastImportAt: timestamp("last_import_at"),
  syncToken: text("sync_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("calendar_integrations_org_provider_user_idx").on(table.organisationId, table.provider, table.userId),
]);

export const calendarIntegrationsRelations = relations(calendarIntegrations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [calendarIntegrations.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [calendarIntegrations.userId],
    references: [users.id],
  }),
}));

export const insertCalendarIntegrationSchema = createInsertSchema(calendarIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCalendarIntegration = z.infer<typeof insertCalendarIntegrationSchema>;
export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;

// Table appointment_external_links - External calendar event mappings (for V2 multi-calendar support)
export const appointmentExternalLinks = pgTable("appointment_external_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  integrationId: varchar("integration_id").notNull().references(() => calendarIntegrations.id, { onDelete: "cascade" }),
  provider: text("provider").default("google").notNull(),
  externalCalendarId: text("external_calendar_id").notNull(),
  externalEventId: text("external_event_id").notNull(),
  etag: text("etag"),
  syncStatus: syncStatusEnum("sync_status").default("NONE").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("appointment_external_links_appt_integration_idx").on(table.appointmentId, table.integrationId),
]);

export const appointmentExternalLinksRelations = relations(appointmentExternalLinks, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentExternalLinks.appointmentId],
    references: [appointments.id],
  }),
  integration: one(calendarIntegrations, {
    fields: [appointmentExternalLinks.integrationId],
    references: [calendarIntegrations.id],
  }),
}));

export const insertAppointmentExternalLinkSchema = createInsertSchema(appointmentExternalLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppointmentExternalLink = z.infer<typeof insertAppointmentExternalLinkSchema>;
export type AppointmentExternalLink = typeof appointmentExternalLinks.$inferSelect;

// Table appointment_radios - Links radios to appointments (many-to-many)
export const appointmentRadios = pgTable("appointment_radios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  radioId: varchar("radio_id").notNull().references(() => radios.id, { onDelete: "cascade" }),
  linkedBy: varchar("linked_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("appointment_radios_unique_idx").on(table.appointmentId, table.radioId),
]);

export const appointmentRadiosRelations = relations(appointmentRadios, ({ one }) => ({
  organisation: one(organisations, {
    fields: [appointmentRadios.organisationId],
    references: [organisations.id],
  }),
  appointment: one(appointments, {
    fields: [appointmentRadios.appointmentId],
    references: [appointments.id],
  }),
  radio: one(radios, {
    fields: [appointmentRadios.radioId],
    references: [radios.id],
  }),
  linkedByUser: one(users, {
    fields: [appointmentRadios.linkedBy],
    references: [users.id],
  }),
}));

export const insertAppointmentRadioSchema = createInsertSchema(appointmentRadios).omit({
  id: true,
  createdAt: true,
});
export type InsertAppointmentRadio = z.infer<typeof insertAppointmentRadioSchema>;
export type AppointmentRadio = typeof appointmentRadios.$inferSelect;

// Table google_calendar_events - Imported Google Calendar events for V2 bidirectional sync
export const googleCalendarEvents = pgTable("google_calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  integrationId: varchar("integration_id").references(() => calendarIntegrations.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").notNull(),
  googleEventId: text("google_event_id").notNull(),
  etag: text("etag"),
  status: googleEventStatusEnum("status").default("confirmed"),
  summary: text("summary"),
  description: text("description"),
  location: text("location"),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  allDay: boolean("all_day").default(false),
  attendees: text("attendees"),
  htmlLink: text("html_link"),
  updatedAtGoogle: timestamp("updated_at_google", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow(),
  cassiusAppointmentId: varchar("cassius_appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("google_calendar_events_unique_idx").on(table.organisationId, table.googleCalendarId, table.googleEventId),
]);

export const googleCalendarEventsRelations = relations(googleCalendarEvents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [googleCalendarEvents.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [googleCalendarEvents.userId],
    references: [users.id],
  }),
  integration: one(calendarIntegrations, {
    fields: [googleCalendarEvents.integrationId],
    references: [calendarIntegrations.id],
  }),
  cassiusAppointment: one(appointments, {
    fields: [googleCalendarEvents.cassiusAppointmentId],
    references: [appointments.id],
  }),
}));

export const insertGoogleCalendarEventSchema = createInsertSchema(googleCalendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGoogleCalendarEvent = z.infer<typeof insertGoogleCalendarEventSchema>;
export type GoogleCalendarEvent = typeof googleCalendarEvents.$inferSelect;

// Table sync_conflicts - Tracks conflicts between Cassius and Google Calendar events
export const syncConflicts = pgTable("sync_conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  source: syncConflictSourceEnum("source").notNull(),
  entityType: text("entity_type").default("event").notNull(),
  externalId: text("external_id"),
  internalId: varchar("internal_id"),
  reason: text("reason").notNull(),
  payload: text("payload"),
  status: syncConflictStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
});

export const syncConflictsRelations = relations(syncConflicts, ({ one }) => ({
  organisation: one(organisations, {
    fields: [syncConflicts.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [syncConflicts.userId],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [syncConflicts.resolvedBy],
    references: [users.id],
  }),
}));

export const insertSyncConflictSchema = createInsertSchema(syncConflicts).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
});
export type InsertSyncConflict = z.infer<typeof insertSyncConflictSchema>;
export type SyncConflict = typeof syncConflicts.$inferSelect;

// Import job enums
export const importJobStatusEnum = pgEnum("import_job_status", [
  "pending",
  "validating",
  "validated",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const importRowStatusEnum = pgEnum("import_row_status", [
  "ok",
  "warning",
  "error",
  "collision",
  "skipped"
]);

// Table import_jobs - Tracks CSV import jobs
export const importJobs = pgTable("import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").default("patients_csv").notNull(),
  status: importJobStatusEnum("status").default("pending").notNull(),
  cancelRequested: boolean("cancel_requested").default(false).notNull(),
  cancellationReason: text("cancellation_reason"), // 'user' or 'system'
  fileName: text("file_name"),
  filePath: text("file_path"),
  fileHash: text("file_hash"),
  totalRows: integer("total_rows").default(0),
  processedRows: integer("processed_rows").default(0),
  stats: text("stats").default("{}"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validatedAt: timestamp("validated_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const importJobsRelations = relations(importJobs, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [importJobs.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [importJobs.userId],
    references: [users.id],
  }),
  rows: many(importJobRows),
}));

// Table import_job_rows - Individual rows from CSV imports
export const importJobRows = pgTable("import_job_rows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  rawData: text("raw_data").notNull(),
  normalizedData: text("normalized_data"),
  status: importRowStatusEnum("status").default("ok").notNull(),
  errors: text("errors").default("[]"),
  warnings: text("warnings").default("[]"),
  matchedPatientId: varchar("matched_patient_id").references(() => patients.id, { onDelete: "set null" }),
  matchType: text("match_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const importJobRowsRelations = relations(importJobRows, ({ one }) => ({
  job: one(importJobs, {
    fields: [importJobRows.jobId],
    references: [importJobs.id],
  }),
  matchedPatient: one(patients, {
    fields: [importJobRows.matchedPatientId],
    references: [patients.id],
  }),
}));

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  createdAt: true,
  validatedAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;

export const insertImportJobRowSchema = createInsertSchema(importJobRows).omit({
  id: true,
  createdAt: true,
});
export type InsertImportJobRow = z.infer<typeof insertImportJobRowSchema>;
export type ImportJobRow = typeof importJobRows.$inferSelect;

// Table flags - Clinical alerts and warnings
export const flags = pgTable("flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  level: flagLevelEnum("level").notNull(),
  type: flagTypeEnum("type").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  entityType: flagEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
});

export const flagsRelations = relations(flags, ({ one }) => ({
  organisation: one(organisations, {
    fields: [flags.organisationId],
    references: [organisations.id],
  }),
  resolvedByUser: one(users, {
    fields: [flags.resolvedBy],
    references: [users.id],
  }),
}));

// Table documents patients (PDF, etc.)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  operationId: varchar("operation_id").references(() => operations.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  fileName: text("file_name"),
  tags: text("tags").array(),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [documents.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [documents.patientId],
    references: [patients.id],
  }),
  operation: one(operations, {
    fields: [documents.operationId],
    references: [operations.id],
  }),
  createdByUser: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
  }),
}));

// Table savedFilters - filtres avancés sauvegardés par page
export const savedFilters = pgTable("saved_filters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pageType: savedFilterPageTypeEnum("page_type").notNull(),
  filterData: text("filter_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedFiltersRelations = relations(savedFilters, ({ one }) => ({
  organisation: one(organisations, {
    fields: [savedFilters.organisationId],
    references: [organisations.id],
  }),
}));

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  organisationId: true,
});

export const insertOperationSchema = createInsertSchema(operations).omit({
  id: true,
  organisationId: true,
});

export const insertImplantSchema = createInsertSchema(implants).omit({
  id: true,
  organisationId: true,
});

export const insertSurgeryImplantSchema = createInsertSchema(surgeryImplants).omit({
  id: true,
  organisationId: true,
});

export const insertRadioSchema = createInsertSchema(radios).omit({
  id: true,
  organisationId: true,
  createdAt: true,
});

export const updateRadioSchema = z.object({
  title: z.string().optional(),
});

export const insertVisiteSchema = createInsertSchema(visites).omit({
  id: true,
  organisationId: true,
});

export const insertProtheseSchema = createInsertSchema(protheses).omit({
  id: true,
  organisationId: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  organisationId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRendezVousSchema = createInsertSchema(rendezVous).omit({
  id: true,
  organisationId: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  organisationId: true,
  createdAt: true,
  updatedAt: true,
  // Auto-managed status timestamps
  completedAt: true,
  cancelledAt: true,
  // Sync fields are auto-managed
  syncStatus: true,
  lastSyncedAt: true,
  externalEtag: true,
  syncError: true,
}).extend({
  dateStart: z.coerce.date(),
  dateEnd: z.coerce.date().nullable().optional(),
});

export const updateAppointmentSchema = z.object({
  type: z.enum(["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"]).optional(),
  status: z.enum(["UPCOMING", "COMPLETED", "CANCELLED"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().nullable().optional(),
  isq: z.number().nullable().optional(),
  color: z.string().nullable().optional(),
  operationId: z.string().nullable().optional(),
  surgeryImplantId: z.string().nullable().optional(),
  radioId: z.string().nullable().optional(),
  cancelReason: z.string().nullable().optional(),
});

export const syncStatusValues = ["NONE", "PENDING", "SYNCED", "ERROR"] as const;
export type SyncStatus = typeof syncStatusValues[number];

export const appointmentTypeValues = ["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"] as const;
export type AppointmentType = typeof appointmentTypeValues[number];

export const appointmentStatusValues = ["UPCOMING", "COMPLETED", "CANCELLED"] as const;
export type AppointmentStatus = typeof appointmentStatusValues[number];

// Flag schemas and types
export const insertFlagSchema = createInsertSchema(flags).omit({
  id: true,
  organisationId: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
});

export const flagLevelValues = ["CRITICAL", "WARNING", "INFO"] as const;
export type FlagLevel = typeof flagLevelValues[number];

export const flagEntityTypeValues = ["PATIENT", "OPERATION", "IMPLANT"] as const;
export type FlagEntityType = typeof flagEntityTypeValues[number];

export const flagTypeValues = [
  "ISQ_LOW",
  "ISQ_DECLINING",
  "LOW_SUCCESS_RATE",
  "NO_RECENT_ISQ",
  "NO_POSTOP_FOLLOWUP",
  "NO_RECENT_APPOINTMENT",
  "FOLLOWUP_2M",
  "FOLLOWUP_4M",
  "FOLLOWUP_6M",
  "FOLLOWUP_12M",
  "IMPLANT_NO_OPERATION",
  "MISSING_DOCUMENT",
  "INCOMPLETE_DATA"
] as const;
export type FlagType = typeof flagTypeValues[number];

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  organisationId: true,
  createdAt: true,
});

export const insertSavedFilterSchema = createInsertSchema(savedFilters).omit({
  id: true,
  organisationId: true,
  createdAt: true,
});

export const savedFilterPageTypeValues = ["patients", "implants", "actes"] as const;
export type SavedFilterPageType = typeof savedFilterPageTypeValues[number];

export const documentTagValues = ["DEVIS", "CONSENTEMENT", "COMPTE_RENDU", "ASSURANCE", "AUTRE"] as const;
export type DocumentTag = typeof documentTagValues[number];

export const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  tags: z.array(z.enum(documentTagValues)).optional(),
  patientId: z.string().nullable().optional(),
  operationId: z.string().nullable().optional(),
});

export const insertOrganisationSchema = createInsertSchema(organisations).omit({
  id: true,
  createdAt: true,
});

// Enums for transactional emails
export const emailTokenTypeEnum = pgEnum("email_token_type", ["PASSWORD_RESET", "EMAIL_VERIFY"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]);
export const emailStatusEnum = pgEnum("email_status", ["PENDING", "SENT", "FAILED"]);

// Email tokens for password reset and email verification
export const emailTokens = pgTable("email_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  type: emailTokenTypeEnum("type").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailTokensRelations = relations(emailTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailTokens.userId],
    references: [users.id],
  }),
}));

// Invitations for collaborators
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: invitationStatusEnum("status").default("PENDING").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  invitedByUserId: varchar("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  nom: text("nom"),
  prenom: text("prenom"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [invitations.organisationId],
    references: [organisations.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedByUserId],
    references: [users.id],
  }),
}));

// Email outbox for tracking sent emails
export const emailOutbox = pgTable("email_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  toEmail: text("to_email").notNull(),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  payload: text("payload"),
  status: emailStatusEnum("status").default("PENDING").notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailOutboxRelations = relations(emailOutbox, ({ one }) => ({
  organisation: one(organisations, {
    fields: [emailOutbox.organisationId],
    references: [organisations.id],
  }),
}));

// Notification system enums
export const notificationKindEnum = pgEnum("notification_kind", [
  "ALERT",
  "REMINDER",
  "ACTIVITY",
  "IMPORT",
  "SYSTEM"
]);

export const notificationSeverityEnum = pgEnum("notification_severity", [
  "INFO",
  "WARNING",
  "CRITICAL"
]);

export const notificationEntityTypeEnum = pgEnum("notification_entity_type", [
  "PATIENT",
  "IMPLANT",
  "OPERATION",
  "APPOINTMENT",
  "DOCUMENT",
  "IMPORT",
  "INTEGRATION",
  "BILLING"
]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "ALERTS_REMINDERS",
  "TEAM_ACTIVITY",
  "IMPORTS",
  "SYSTEM"
]);

export const notificationFrequencyEnum = pgEnum("notification_frequency", [
  "NONE",
  "DIGEST",
  "IMMEDIATE"
]);

export const digestStatusEnum = pgEnum("digest_status", [
  "PENDING",
  "SENT",
  "FAILED"
]);

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  recipientUserId: varchar("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  type: text("type").notNull(),
  severity: notificationSeverityEnum("severity").default("INFO").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  entityType: notificationEntityTypeEnum("entity_type"),
  entityId: varchar("entity_id"),
  actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  metadata: text("metadata"),
  dedupeKey: text("dedupe_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  archivedAt: timestamp("archived_at"),
  digestedAt: timestamp("digested_at"),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organisation: one(organisations, {
    fields: [notifications.organisationId],
    references: [organisations.id],
  }),
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));

// Notification preferences table
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: notificationCategoryEnum("category").notNull(),
  frequency: notificationFrequencyEnum("frequency").default("IMMEDIATE").notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  emailEnabled: boolean("email_enabled").default(false).notNull(),
  digestTime: text("digest_time").default("08:30"),
  disabledTypes: text("disabled_types").array().default([]),
  disabledEmailTypes: text("disabled_email_types").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  organisation: one(organisations, {
    fields: [notificationPreferences.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

// Digest runs table for tracking digest email batches
export const digestRuns = pgTable("digest_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: notificationCategoryEnum("category").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  status: digestStatusEnum("status").default("PENDING").notNull(),
  errorMessage: text("error_message"),
  notificationCount: integer("notification_count").default(0),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const digestRunsRelations = relations(digestRuns, ({ one }) => ({
  organisation: one(organisations, {
    fields: [digestRuns.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [digestRuns.userId],
    references: [users.id],
  }),
}));

// Patient share links for public sharing
export const patientShareLinks = pgTable("patient_share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  sharedByUserId: varchar("shared_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientShareLinksRelations = relations(patientShareLinks, ({ one }) => ({
  organisation: one(organisations, {
    fields: [patientShareLinks.organisationId],
    references: [organisations.id],
  }),
  patient: one(patients, {
    fields: [patientShareLinks.patientId],
    references: [patients.id],
  }),
  sharedByUser: one(users, {
    fields: [patientShareLinks.sharedByUserId],
    references: [users.id],
  }),
}));

// Share email status enum
export const shareEmailStatusEnum = pgEnum("share_email_status", ["SENT", "DELIVERED", "FAILED", "READ"]);

// Share link emails history
export const shareLinkEmails = pgTable("share_link_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shareLinkId: varchar("share_link_id").notNull().references(() => patientShareLinks.id, { onDelete: "cascade" }),
  recipientEmail: varchar("recipient_email").notNull(),
  subject: varchar("subject").notNull(),
  status: shareEmailStatusEnum("status").default("SENT").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  resendMessageId: varchar("resend_message_id"),
});

export const shareLinkEmailsRelations = relations(shareLinkEmails, ({ one }) => ({
  shareLink: one(patientShareLinks, {
    fields: [shareLinkEmails.shareLinkId],
    references: [patientShareLinks.id],
  }),
}));

// Custom brands added by users
export const customBrandTypeEnum = pgEnum("custom_brand_type", ["IMPLANT", "PROTHESE"]);

export const customBrands = pgTable("custom_brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull(),
  name: varchar("name").notNull(),
  type: varchar("type").notNull().default("IMPLANT"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CustomBrand = typeof customBrands.$inferSelect;
export type InsertCustomBrand = typeof customBrands.$inferInsert;

// Onboarding state for wizard
export const onboardingState = pgTable("onboarding_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }).unique(),
  currentStep: integer("current_step").default(0).notNull(),
  completedSteps: text("completed_steps").default("{}").notNull(),
  skippedSteps: text("skipped_steps").default("{}").notNull(),
  data: text("data").default("{}").notNull(),
  status: onboardingStatusEnum("status").default("IN_PROGRESS").notNull(),
  dismissed: boolean("dismissed").default(false).notNull(),
  dismissedAt: timestamp("dismissed_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const onboardingStateRelations = relations(onboardingState, ({ one }) => ({
  organisation: one(organisations, {
    fields: [onboardingState.organisationId],
    references: [organisations.id],
  }),
}));

// ============================================
// RADIO NOTES - Remarques sur les radios
// ============================================

export const radioNotes = pgTable("radio_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  radioId: varchar("radio_id").notNull().references(() => radios.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const radioNotesRelations = relations(radioNotes, ({ one }) => ({
  organisation: one(organisations, {
    fields: [radioNotes.organisationId],
    references: [organisations.id],
  }),
  radio: one(radios, {
    fields: [radioNotes.radioId],
    references: [radios.id],
  }),
  author: one(users, {
    fields: [radioNotes.authorId],
    references: [users.id],
  }),
}));

// ============================================
// IMPLANT STATUS REASONS - Motifs de statut
// ============================================

export const implantStatusReasons = pgTable("implant_status_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").references(() => organisations.id, { onDelete: "cascade" }), // NULL = system
  status: statutImplantEnum("status").notNull(), // SUCCES, COMPLICATION, ECHEC
  code: text("code").notNull(), // Stable code like ISQ_LOW
  label: text("label").notNull(), // Human-readable label
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const implantStatusReasonsRelations = relations(implantStatusReasons, ({ one }) => ({
  organisation: one(organisations, {
    fields: [implantStatusReasons.organisationId],
    references: [organisations.id],
  }),
}));

// ============================================
// IMPLANT STATUS HISTORY - Historique des statuts
// ============================================

export const implantStatusHistory = pgTable("implant_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  implantId: varchar("implant_id").notNull().references(() => surgeryImplants.id, { onDelete: "cascade" }),
  fromStatus: statutImplantEnum("from_status"),
  toStatus: statutImplantEnum("to_status").notNull(),
  reasonId: varchar("reason_id").references(() => implantStatusReasons.id, { onDelete: "set null" }),
  reasonFreeText: text("reason_free_text"),
  evidence: text("evidence"), // JSON string with ISQ, radioId, visitId, etc.
  changedByUserId: varchar("changed_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const implantStatusHistoryRelations = relations(implantStatusHistory, ({ one }) => ({
  organisation: one(organisations, {
    fields: [implantStatusHistory.organisationId],
    references: [organisations.id],
  }),
  implant: one(surgeryImplants, {
    fields: [implantStatusHistory.implantId],
    references: [surgeryImplants.id],
  }),
  reason: one(implantStatusReasons, {
    fields: [implantStatusHistory.reasonId],
    references: [implantStatusReasons.id],
  }),
  changedBy: one(users, {
    fields: [implantStatusHistory.changedByUserId],
    references: [users.id],
  }),
}));

// ============================================
// IMPLANT MEASUREMENTS - Source de vérité ISQ
// ============================================

export const measurementTypeEnum = pgEnum("measurement_type", ["POSE", "FOLLOW_UP", "CONTROL", "EMERGENCY"]);

export const implantMeasurements = pgTable("implant_measurements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  surgeryImplantId: varchar("surgery_implant_id").notNull().references(() => surgeryImplants.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  type: measurementTypeEnum("type").notNull(),
  isqValue: real("isq_value"), // Calculated weighted average: (V*2 + M + D) / 4
  isqVestibulaire: real("isq_vestibulaire"),
  isqMesial: real("isq_mesial"),
  isqDistal: real("isq_distal"),
  isqStability: text("isq_stability"), // low, moderate, high
  boneLossScore: integer("bone_loss_score"),
  notes: text("notes"),
  measuredAt: timestamp("measured_at").notNull(),
  measuredByUserId: varchar("measured_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  index("idx_implant_measurements_org").on(table.organisationId),
  index("idx_implant_measurements_implant").on(table.surgeryImplantId),
  index("idx_implant_measurements_appointment").on(table.appointmentId),
  index("idx_implant_measurements_measured_at").on(table.measuredAt),
]);

export const implantMeasurementsRelations = relations(implantMeasurements, ({ one }) => ({
  organisation: one(organisations, {
    fields: [implantMeasurements.organisationId],
    references: [organisations.id],
  }),
  surgeryImplant: one(surgeryImplants, {
    fields: [implantMeasurements.surgeryImplantId],
    references: [surgeryImplants.id],
  }),
  appointment: one(appointments, {
    fields: [implantMeasurements.appointmentId],
    references: [appointments.id],
  }),
  measuredBy: one(users, {
    fields: [implantMeasurements.measuredByUserId],
    references: [users.id],
  }),
}));

// Insert schemas for new tables
export const insertImplantMeasurementSchema = createInsertSchema(implantMeasurements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailTokenSchema = createInsertSchema(emailTokens).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

export const insertEmailOutboxSchema = createInsertSchema(emailOutbox).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigestRunSchema = createInsertSchema(digestRuns).omit({
  id: true,
  createdAt: true,
});

export const insertPatientShareLinkSchema = createInsertSchema(patientShareLinks).omit({
  id: true,
  createdAt: true,
  accessCount: true,
});

export const insertShareLinkEmailSchema = createInsertSchema(shareLinkEmails).omit({
  id: true,
  sentAt: true,
});

export const insertOnboardingStateSchema = createInsertSchema(onboardingState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRadioNoteSchema = createInsertSchema(radioNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImplantStatusReasonSchema = createInsertSchema(implantStatusReasons).omit({
  id: true,
  createdAt: true,
});

export const insertImplantStatusHistorySchema = createInsertSchema(implantStatusHistory).omit({
  id: true,
  changedAt: true,
});

export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type Organisation = typeof organisations.$inferSelect;

export type InsertEmailToken = z.infer<typeof insertEmailTokenSchema>;
export type EmailToken = typeof emailTokens.$inferSelect;

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export type InsertEmailOutbox = z.infer<typeof insertEmailOutboxSchema>;
export type EmailOutbox = typeof emailOutbox.$inferSelect;

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;

export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type Operation = typeof operations.$inferSelect;

export type InsertImplant = z.infer<typeof insertImplantSchema>;
export type Implant = typeof implants.$inferSelect;

export type ImplantWithStats = Implant & {
  poseCount: number;
  lastPoseDate: string | null;
  successRate: number | null;
};

export type InsertSurgeryImplant = z.infer<typeof insertSurgeryImplantSchema>;
export type SurgeryImplant = typeof surgeryImplants.$inferSelect;

export type InsertRadio = z.infer<typeof insertRadioSchema>;
export type Radio = typeof radios.$inferSelect;

export type InsertVisite = z.infer<typeof insertVisiteSchema>;
export type Visite = typeof visites.$inferSelect;

export type InsertProthese = z.infer<typeof insertProtheseSchema>;
export type Prothese = typeof protheses.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

export type InsertRendezVous = z.infer<typeof insertRendezVousSchema>;
export type RendezVous = typeof rendezVous.$inferSelect;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

export type InsertFlag = z.infer<typeof insertFlagSchema>;
export type Flag = typeof flags.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export type InsertDigestRun = z.infer<typeof insertDigestRunSchema>;
export type DigestRun = typeof digestRuns.$inferSelect;

export type InsertPatientShareLink = z.infer<typeof insertPatientShareLinkSchema>;
export type PatientShareLink = typeof patientShareLinks.$inferSelect;

export type InsertShareLinkEmail = z.infer<typeof insertShareLinkEmailSchema>;
export type ShareLinkEmail = typeof shareLinkEmails.$inferSelect;

export type InsertOnboardingState = z.infer<typeof insertOnboardingStateSchema>;
export type OnboardingState = typeof onboardingState.$inferSelect;

export type InsertRadioNote = z.infer<typeof insertRadioNoteSchema>;
export type RadioNote = typeof radioNotes.$inferSelect;

export type InsertImplantStatusReason = z.infer<typeof insertImplantStatusReasonSchema>;
export type ImplantStatusReason = typeof implantStatusReasons.$inferSelect;

export type InsertImplantStatusHistory = z.infer<typeof insertImplantStatusHistorySchema>;
export type ImplantStatusHistory = typeof implantStatusHistory.$inferSelect;

export type InsertImplantMeasurement = z.infer<typeof insertImplantMeasurementSchema>;
export type ImplantMeasurement = typeof implantMeasurements.$inferSelect;

// Onboarding data interface
export interface OnboardingData {
  practiceType?: "SOLO" | "CABINET";
  timezone?: string;
  language?: string;
  clinicName?: string;
  phone?: string;
  address?: string;
  sessionTimeoutMinutes?: number;
  emailVerified?: boolean;
  demoModeEnabled?: boolean;
  importCompleted?: boolean;
  firstCaseCreated?: boolean;
  googleConnected?: boolean;
  notificationsConfigured?: boolean;
  documentUploaded?: boolean;
}

// Extended types for API responses
export interface SurgeryImplantWithDetails extends SurgeryImplant {
  implant: Implant;
  surgery?: Operation;
  patient?: Patient;
}

export interface OperationWithImplants extends Operation {
  surgeryImplants: SurgeryImplantWithDetails[];
}

export interface AppointmentWithDetails extends Appointment {
  patient?: Patient;
  operation?: Operation;
  surgeryImplant?: SurgeryImplant & { implant: Implant };
  radio?: Radio;
}

export interface FlagWithEntity extends Flag {
  entityName?: string;
  patientId?: string;
  patientNom?: string;
  patientPrenom?: string;
}

export interface AppointmentWithPatient extends Appointment {
  patientNom: string;
  patientPrenom: string;
}

export interface DocumentWithDetails extends Document {
  patient?: Patient;
  operation?: Operation;
}

export interface PatientShareLinkWithDetails extends PatientShareLink {
  sharedByUserName?: string;
}

export interface PublicPatientShareData {
  patient: {
    prenom: string;
    nom: string;
    dateNaissance?: string | null;
  };
  implants: Array<{
    id: string;
    siteFdi: string;
    marque?: string | null;
    reference?: string | null;
    diametre?: number | null;
    longueur?: number | null;
    position?: string | null;
    statut?: string | null;
    datePose: string;
    isqPose?: number | null;
    isq2m?: number | null;
    isq3m?: number | null;
    isq6m?: number | null;
  }>;
  sharedByUserName: string;
  createdAt: string;
}

// Radio note with author details
export interface RadioNoteWithAuthor extends RadioNote {
  authorNom?: string | null;
  authorPrenom?: string | null;
}

// Implant status suggestion from clinical assistant
export interface ImplantStatusSuggestion {
  toStatus: "SUCCES" | "COMPLICATION" | "ECHEC";
  confidence: "low" | "medium" | "high";
  message: string;
  evidence: {
    latestIsq?: number;
    isqDelta?: number;
    daysSinceLastIsq?: number;
    daysSincePose?: number;
    isqHistory?: Array<{ value: number; date: string }>;
  };
  defaultReasonCode: string;
}

// Implant status history with details
export interface ImplantStatusHistoryWithDetails extends ImplantStatusHistory {
  reasonLabel?: string | null;
  reasonCode?: string | null;
  changedByNom?: string | null;
  changedByPrenom?: string | null;
}

// System status reason codes
export const SYSTEM_STATUS_REASONS = {
  SUCCES: [
    { code: "SUCCESS_OSSEOINTEGRATION", label: "Ostéo-intégration confirmée" },
    { code: "SUCCESS_PROSTHESIS", label: "Prothèse posée avec succès" },
    { code: "SUCCESS_STABLE_ISQ", label: "ISQ stable et satisfaisant" },
  ],
  COMPLICATION: [
    { code: "ISQ_LOW", label: "ISQ faible" },
    { code: "ISQ_DECLINING", label: "ISQ en diminution" },
    { code: "INFECTION", label: "Infection" },
    { code: "PAIN", label: "Douleur persistante" },
    { code: "MOBILITY", label: "Mobilité de l'implant" },
    { code: "RADIO_ANOMALY", label: "Anomalie radiologique" },
  ],
  ECHEC: [
    { code: "FAILURE_NO_OSSEOINTEGRATION", label: "Absence d'ostéo-intégration" },
    { code: "FAILURE_IMPLANT_LOST", label: "Implant perdu / déposé" },
    { code: "FAILURE_MOBILITY", label: "Mobilité irréversible" },
  ],
} as const;

// Audit Log System
export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "ARCHIVE",
  "RESTORE",
  "LOGIN",
  "LOGOUT",
]);

export const auditEntityTypeEnum = pgEnum("audit_entity_type", [
  "PATIENT",
  "OPERATION",
  "SURGERY_IMPLANT",
  "CATALOG_IMPLANT",
  "APPOINTMENT",
  "DOCUMENT",
  "RADIO",
  "USER",
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  entityType: auditEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: auditActionEnum("action").notNull(),
  details: text("details"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("audit_logs_org_idx").on(table.organisationId),
  entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  userIdx: index("audit_logs_user_idx").on(table.userId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLogs.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type AuditLogWithUser = AuditLog & {
  user?: {
    id: string;
    nom: string | null;
    prenom: string | null;
    username: string;
  } | null;
};

// Patch Notes System
export const patchNoteTypeEnum = pgEnum("patch_note_type", [
  "FEATURE",
  "IMPROVEMENT",
  "BUGFIX",
  "SECURITY",
]);

export const patchNotes = pgTable("patch_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull(),
  date: date("date").notNull(),
  baseline: text("baseline").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  versionIdx: index("patch_notes_version_idx").on(table.version),
  dateIdx: index("patch_notes_date_idx").on(table.date),
}));

export const patchNoteLines = pgTable("patch_note_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patchNoteId: varchar("patch_note_id").notNull().references(() => patchNotes.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  type: patchNoteTypeEnum("type").notNull().default("FEATURE"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  patchNoteIdx: index("patch_note_lines_patch_note_idx").on(table.patchNoteId),
}));

export const patchNotesRelations = relations(patchNotes, ({ many }) => ({
  lines: many(patchNoteLines),
}));

export const patchNoteLinesRelations = relations(patchNoteLines, ({ one }) => ({
  patchNote: one(patchNotes, {
    fields: [patchNoteLines.patchNoteId],
    references: [patchNotes.id],
  }),
}));

export const insertPatchNoteSchema = createInsertSchema(patchNotes).omit({
  id: true,
  createdAt: true,
});

export const insertPatchNoteLineSchema = createInsertSchema(patchNoteLines).omit({
  id: true,
  createdAt: true,
});

export type InsertPatchNote = z.infer<typeof insertPatchNoteSchema>;
export type PatchNote = typeof patchNotes.$inferSelect;
export type InsertPatchNoteLine = z.infer<typeof insertPatchNoteLineSchema>;
export type PatchNoteLine = typeof patchNoteLines.$inferSelect;

export type PatchNoteWithLines = PatchNote & {
  lines: PatchNoteLine[];
};
