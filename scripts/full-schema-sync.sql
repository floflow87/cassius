-- ============================================================
-- SCRIPT DE SYNCHRONISATION COMPLÈTE DU SCHÉMA PRODUCTION
-- Généré à partir de shared/schema.ts
-- ============================================================

-- ============== ENUMS (créer si n'existent pas) ==============
DO $$ BEGIN
  CREATE TYPE sexe AS ENUM ('HOMME', 'FEMME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_intervention AS ENUM ('POSE_IMPLANT', 'GREFFE_OSSEUSE', 'SINUS_LIFT', 'EXTRACTION_IMPLANT_IMMEDIATE', 'REPRISE_IMPLANT', 'CHIRURGIE_GUIDEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_chirurgie_temps AS ENUM ('UN_TEMPS', 'DEUX_TEMPS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_chirurgie_approche AS ENUM ('LAMBEAU', 'FLAPLESS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_mise_en_charge AS ENUM ('IMMEDIATE', 'PRECOCE', 'DIFFEREE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE position_implant AS ENUM ('CRESTAL', 'SOUS_CRESTAL', 'SUPRA_CRESTAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_os AS ENUM ('D1', 'D2', 'D3', 'D4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE statut_implant AS ENUM ('EN_SUIVI', 'SUCCES', 'COMPLICATION', 'ECHEC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_radio AS ENUM ('PANORAMIQUE', 'CBCT', 'RETROALVEOLAIRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE role AS ENUM ('CHIRURGIEN', 'ASSISTANT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_prothese AS ENUM ('VISSEE', 'SCELLEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_pilier AS ENUM ('DROIT', 'ANGULE', 'MULTI_UNIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quantite_prothese AS ENUM ('UNITAIRE', 'PLURALE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mobilite_prothese AS ENUM ('AMOVIBLE', 'FIXE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_note_tag AS ENUM ('CONSULTATION', 'CHIRURGIE', 'SUIVI', 'COMPLICATION', 'ADMINISTRATIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_rdv_tag AS ENUM ('CONSULTATION', 'SUIVI', 'CHIRURGIE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_type AS ENUM ('CONSULTATION', 'SUIVI', 'CHIRURGIE', 'CONTROLE', 'URGENCE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('UPCOMING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE google_event_status AS ENUM ('confirmed', 'tentative', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_conflict_status AS ENUM ('open', 'resolved', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_conflict_source AS ENUM ('google', 'cassius');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_document_tag AS ENUM ('DEVIS', 'CONSENTEMENT', 'COMPTE_RENDU', 'ASSURANCE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE statut_patient AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE type_implant AS ENUM ('IMPLANT', 'MINI_IMPLANT', 'PROTHESE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE saved_filter_page_type AS ENUM ('patients', 'implants', 'actes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM ('IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE practice_type AS ENUM ('SOLO', 'CABINET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flag_level AS ENUM ('CRITICAL', 'WARNING', 'INFO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flag_entity_type AS ENUM ('PATIENT', 'OPERATION', 'IMPLANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flag_type AS ENUM ('ISQ_LOW', 'ISQ_DECLINING', 'LOW_SUCCESS_RATE', 'NO_RECENT_ISQ', 'NO_POSTOP_FOLLOWUP', 'NO_RECENT_APPOINTMENT', 'IMPLANT_NO_OPERATION', 'MISSING_DOCUMENT', 'INCOMPLETE_DATA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_job_status AS ENUM ('pending', 'validating', 'validated', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_row_status AS ENUM ('ok', 'warning', 'error', 'collision', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== TABLE: organisations ==============
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';

-- ============== TABLE: patients ==============
ALTER TABLE patients ADD COLUMN IF NOT EXISTS file_number text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ssn text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_full text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS code_postal text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pays text DEFAULT 'France';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS contexte_medical text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS statut text DEFAULT 'ACTIF';

-- ============== TABLE: operations ==============
ALTER TABLE operations ADD COLUMN IF NOT EXISTS greffe_osseuse boolean DEFAULT false;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS type_greffe text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS greffe_quantite text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS greffe_localisation text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS type_mise_en_charge text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS conditions_medicales_preop text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS notes_perop text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS observations_postop text;

-- ============== TABLE: implants ==============
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_implant text DEFAULT 'IMPLANT';
ALTER TABLE implants ADD COLUMN IF NOT EXISTS lot text;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_prothese text;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS quantite text;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS mobilite text;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_pilier text;
-- Rendre operation_id nullable s'il existe
ALTER TABLE implants ALTER COLUMN operation_id DROP NOT NULL;

-- ============== TABLE: surgery_implants ==============
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS position_implant text;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS type_os text;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS mise_en_charge text;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS greffe_osseuse boolean DEFAULT false;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS type_greffe text;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS type_chirurgie_temps text;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_pose real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_2m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_3m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_6m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS bone_loss_score integer;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS notes text;

-- ============== TABLE: radios ==============
ALTER TABLE radios ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE radios ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE radios ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE radios ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE radios ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE radios ADD COLUMN IF NOT EXISTS created_by varchar;
ALTER TABLE radios ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- ============== TABLE: radio_notes (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS radio_notes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id varchar NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  radio_id varchar NOT NULL REFERENCES radios(id) ON DELETE CASCADE,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- ============== TABLE: visites ==============
ALTER TABLE visites ADD COLUMN IF NOT EXISTS radio_id varchar;

-- ============== TABLE: protheses ==============
ALTER TABLE protheses ADD COLUMN IF NOT EXISTS prothese_unitaire boolean DEFAULT true;
ALTER TABLE protheses ADD COLUMN IF NOT EXISTS date_pose date;
ALTER TABLE protheses ADD COLUMN IF NOT EXISTS notes text;

-- ============== TABLE: notes ==============
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- ============== TABLE: users ==============
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS was_invited boolean DEFAULT false;

-- ============== TABLE: appointments ==============
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_provider text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_calendar_id text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_event_id text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'NONE';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS last_synced_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_etag text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS sync_error text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- ============== TABLE: calendar_integrations ==============
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS target_calendar_id text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS target_calendar_name text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS token_expires_at timestamp;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS provider_user_email text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS last_sync_at timestamp;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_error_count integer DEFAULT 0;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS last_sync_error text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS source_calendar_id text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS source_calendar_name text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS import_enabled boolean DEFAULT false;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS last_import_at timestamp;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_token text;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- ============== TABLE: documents ==============
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_by varchar;

-- ============== TABLE: flags ==============
ALTER TABLE flags ADD COLUMN IF NOT EXISTS description text;

-- ============== TABLE: saved_filters ==============
ALTER TABLE saved_filters ADD COLUMN IF NOT EXISTS filter_data text;

-- ============== TABLE: import_jobs (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS import_jobs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id varchar NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  type text DEFAULT 'patients_csv' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  cancel_requested boolean DEFAULT false NOT NULL,
  cancellation_reason text,
  file_name text,
  file_path text,
  file_hash text,
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  stats text DEFAULT '{}',
  error_message text,
  created_at timestamp DEFAULT now() NOT NULL,
  validated_at timestamp,
  started_at timestamp,
  completed_at timestamp
);

-- ============== TABLE: import_job_rows (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS import_job_rows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id varchar NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_data text NOT NULL,
  normalized_data text,
  status text DEFAULT 'ok' NOT NULL,
  errors text DEFAULT '[]',
  warnings text DEFAULT '[]',
  matched_patient_id varchar REFERENCES patients(id) ON DELETE SET NULL,
  match_type text,
  created_at timestamp DEFAULT now() NOT NULL
);

-- ============== TABLE: google_calendar_events (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS google_calendar_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id varchar NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  integration_id varchar REFERENCES calendar_integrations(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  google_event_id text NOT NULL,
  etag text,
  status text DEFAULT 'confirmed',
  summary text,
  description text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  attendees text,
  html_link text,
  updated_at_google timestamptz,
  last_synced_at timestamptz DEFAULT now(),
  cassius_appointment_id varchar REFERENCES appointments(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- ============== TABLE: sync_conflicts (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id varchar NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL,
  entity_type text DEFAULT 'event' NOT NULL,
  external_id text,
  internal_id varchar,
  reason text NOT NULL,
  payload text,
  status text DEFAULT 'open' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  resolved_at timestamp,
  resolved_by varchar REFERENCES users(id) ON DELETE SET NULL
);

-- ============== TABLE: appointment_external_links (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS appointment_external_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id varchar NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  integration_id varchar NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
  provider text DEFAULT 'google' NOT NULL,
  external_calendar_id text NOT NULL,
  external_event_id text NOT NULL,
  etag text,
  sync_status text DEFAULT 'NONE' NOT NULL,
  last_synced_at timestamp,
  last_error text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- ============== TABLE: appointment_radios (créer si n'existe pas) ==============
CREATE TABLE IF NOT EXISTS appointment_radios (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id varchar NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  appointment_id varchar NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  radio_id varchar NOT NULL REFERENCES radios(id) ON DELETE CASCADE,
  linked_by varchar REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL
);

-- ============== CONFIRMATION ==============
SELECT 'Synchronisation du schéma terminée avec succès!' as status;
