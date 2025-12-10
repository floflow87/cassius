CREATE TYPE "public"."position_implant" AS ENUM('CRESTAL', 'SOUS_CRESTAL', 'SUPRA_CRESTAL');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CHIRURGIEN', 'ASSISTANT', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."sexe" AS ENUM('HOMME', 'FEMME');--> statement-breakpoint
CREATE TYPE "public"."statut_implant" AS ENUM('EN_SUIVI', 'SUCCES', 'COMPLICATION', 'ECHEC');--> statement-breakpoint
CREATE TYPE "public"."type_chirurgie_approche" AS ENUM('LAMBEAU', 'FLAPLESS');--> statement-breakpoint
CREATE TYPE "public"."type_chirurgie_temps" AS ENUM('UN_TEMPS', 'DEUX_TEMPS');--> statement-breakpoint
CREATE TYPE "public"."type_intervention" AS ENUM('POSE_IMPLANT', 'GREFFE_OSSEUSE', 'SINUS_LIFT', 'EXTRACTION_IMPLANT_IMMEDIATE', 'REPRISE_IMPLANT', 'CHIRURGIE_GUIDEE');--> statement-breakpoint
CREATE TYPE "public"."type_mise_en_charge" AS ENUM('IMMEDIATE', 'PRECOCE', 'DIFFEREE');--> statement-breakpoint
CREATE TYPE "public"."type_os" AS ENUM('D1', 'D2', 'D3', 'D4');--> statement-breakpoint
CREATE TYPE "public"."type_radio" AS ENUM('PANORAMIQUE', 'CBCT', 'RETROALVEOLAIRE');--> statement-breakpoint
CREATE TABLE "implants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" varchar NOT NULL,
	"patient_id" varchar NOT NULL,
	"marque" text NOT NULL,
	"reference_fabricant" text,
	"diametre" real NOT NULL,
	"longueur" real NOT NULL,
	"site_fdi" text NOT NULL,
	"position_implant" "position_implant",
	"type_os" "type_os",
	"mise_en_charge_prevue" "type_mise_en_charge",
	"isq_pose" real,
	"isq_2m" real,
	"isq_3m" real,
	"isq_6m" real,
	"statut" "statut_implant" DEFAULT 'EN_SUIVI' NOT NULL,
	"date_pose" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" varchar NOT NULL,
	"date_operation" date NOT NULL,
	"type_intervention" "type_intervention" NOT NULL,
	"type_chirurgie_temps" "type_chirurgie_temps",
	"type_chirurgie_approche" "type_chirurgie_approche",
	"greffe_osseuse" boolean DEFAULT false,
	"type_greffe" text,
	"greffe_quantite" text,
	"greffe_localisation" text,
	"type_mise_en_charge" "type_mise_en_charge",
	"conditions_medicales_preop" text,
	"notes_perop" text,
	"observations_postop" text
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"date_naissance" date NOT NULL,
	"sexe" "sexe" NOT NULL,
	"telephone" text,
	"email" text,
	"contexte_medical" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" varchar NOT NULL,
	"operation_id" varchar,
	"implant_id" varchar,
	"type" "type_radio" NOT NULL,
	"url" text NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" "role" DEFAULT 'ASSISTANT' NOT NULL,
	"nom" text,
	"prenom" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "visites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"implant_id" varchar NOT NULL,
	"patient_id" varchar NOT NULL,
	"date" date NOT NULL,
	"isq" real,
	"notes" text,
	"radio_id" varchar
);
--> statement-breakpoint
ALTER TABLE "implants" ADD CONSTRAINT "implants_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implants" ADD CONSTRAINT "implants_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radios" ADD CONSTRAINT "radios_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radios" ADD CONSTRAINT "radios_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radios" ADD CONSTRAINT "radios_implant_id_implants_id_fk" FOREIGN KEY ("implant_id") REFERENCES "public"."implants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visites" ADD CONSTRAINT "visites_implant_id_implants_id_fk" FOREIGN KEY ("implant_id") REFERENCES "public"."implants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visites" ADD CONSTRAINT "visites_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visites" ADD CONSTRAINT "visites_radio_id_radios_id_fk" FOREIGN KEY ("radio_id") REFERENCES "public"."radios"("id") ON DELETE set null ON UPDATE no action;