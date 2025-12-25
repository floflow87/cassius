import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, date, timestamp, real, boolean, pgEnum, bigint, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Table organisations (multi-tenant)
export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nom: text("nom").notNull(),
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
}));

export const sexeEnum = pgEnum("sexe", ["HOMME", "FEMME"]);

export const typeInterventionEnum = pgEnum("type_intervention", [
  "POSE_IMPLANT",
  "GREFFE_OSSEUSE", 
  "SINUS_LIFT",
  "EXTRACTION_IMPLANT_IMMEDIATE",
  "REPRISE_IMPLANT",
  "CHIRURGIE_GUIDEE"
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
export const typeDocumentTagEnum = pgEnum("type_document_tag", ["DEVIS", "CONSENTEMENT", "COMPTE_RENDU", "ASSURANCE", "AUTRE"]);
export const statutPatientEnum = pgEnum("statut_patient", ["ACTIF", "INACTIF", "ARCHIVE"]);
export const typeImplantEnum = pgEnum("type_implant", ["IMPLANT", "MINI_IMPLANT"]);

export const savedFilterPageTypeEnum = pgEnum("saved_filter_page_type", ["patients", "implants", "actes"]);

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  dateNaissance: date("date_naissance").notNull(),
  sexe: sexeEnum("sexe").notNull(),
  telephone: text("telephone"),
  email: text("email"),
  adresse: text("adresse"),
  codePostal: text("code_postal"),
  ville: text("ville"),
  pays: text("pays"),
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
}));

export const visites = pgTable("visites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  implantId: varchar("implant_id").notNull().references(() => implants.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  isq: real("isq"),
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
  isq: real("isq"),
  radioId: varchar("radio_id").references(() => radios.id, { onDelete: "set null" }),
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

// Table documents patients (PDF, etc.)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organisationId: varchar("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
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
});

export const updateAppointmentSchema = z.object({
  type: z.enum(["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"]).optional(),
  status: z.enum(["UPCOMING", "COMPLETED", "CANCELLED"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().nullable().optional(),
  isq: z.number().nullable().optional(),
  operationId: z.string().nullable().optional(),
  surgeryImplantId: z.string().nullable().optional(),
  radioId: z.string().nullable().optional(),
});

export const appointmentTypeValues = ["CONSULTATION", "SUIVI", "CHIRURGIE", "CONTROLE", "URGENCE", "AUTRE"] as const;
export type AppointmentType = typeof appointmentTypeValues[number];

export const appointmentStatusValues = ["UPCOMING", "COMPLETED", "CANCELLED"] as const;
export type AppointmentStatus = typeof appointmentStatusValues[number];

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
});

export const insertOrganisationSchema = createInsertSchema(organisations).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type Organisation = typeof organisations.$inferSelect;

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

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;

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
