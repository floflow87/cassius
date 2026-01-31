-- =====================================================
-- SCRIPT DE MIGRATION PRODUCTION CASSIUS
-- À exécuter dans Supabase SQL Editor (projet PRODUCTION)
-- =====================================================

-- ÉTAPE 1: Créer tous les ENUMS manquants
DO $$ BEGIN CREATE TYPE appointment_type AS ENUM ('CONTROLE', 'POSE', 'MISE_EN_CHARGE', 'SUIVI', 'URGENCE', 'AUTRE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE appointment_status AS ENUM ('UPCOMING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE type_implant AS ENUM ('IMPLANT', 'MINI_IMPLANT', 'PROTHESE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE statut_implant AS ENUM ('EN_SUIVI', 'SUCCES', 'ECHEC', 'DEPOSE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE position_implant AS ENUM ('ANTERIEUR', 'POSTERIEUR', 'PREMOLAIRE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE type_os AS ENUM ('D1', 'D2', 'D3', 'D4'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE mise_en_charge AS ENUM ('IMMEDIATE', 'PRECOCE', 'CONVENTIONNELLE', 'DIFFEREE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE type_chirurgie_temps AS ENUM ('UN_TEMPS', 'DEUX_TEMPS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE type_prothese AS ENUM ('COURONNE', 'BRIDGE', 'PROTHESE_AMOVIBLE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE quantite_prothese AS ENUM ('UNITAIRE', 'PLURALE', 'COMPLETE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE mobilite_prothese AS ENUM ('FIXE', 'AMOVIBLE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE type_pilier AS ENUM ('DROIT', 'ANGULE', 'MULTI_UNIT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE flag_level AS ENUM ('INFO', 'WARNING', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE flag_type AS ENUM ('ISQ_CRITICAL', 'ISQ_WARNING', 'NO_FOLLOWUP', 'OVERDUE_APPOINTMENT', 'BONE_LOSS', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE entity_type AS ENUM ('patient', 'operation', 'surgery_implant', 'appointment', 'document'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notification_kind AS ENUM ('PUSH', 'EMAIL', 'IN_APP'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notification_severity AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE page_type AS ENUM ('patients', 'operations', 'implants', 'appointments', 'documents'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE patch_note_type AS ENUM ('FEATURE', 'IMPROVEMENT', 'BUGFIX'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ÉTAPE 2: Ajouter les colonnes manquantes à la table patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS traitement TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS conditions TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS code_postal VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ville VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pays VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS statut VARCHAR DEFAULT 'EN_SUIVI';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS file_number VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ssn VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_full TEXT;

-- ÉTAPE 3: Renommer la table implants actuelle (qui contient les implants posés)
-- Si la table surgery_implants n'existe pas, on la crée à partir de implants
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'surgery_implants') THEN
    -- Renommer implants -> surgery_implants_old temporairement
    ALTER TABLE implants RENAME TO implants_old_backup;
  END IF;
END $$;

-- ÉTAPE 4: Créer la nouvelle table implants (catalogue)
CREATE TABLE IF NOT EXISTS implants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  marque TEXT NOT NULL,
  reference_fabricant TEXT,
  diametre REAL NOT NULL,
  longueur REAL NOT NULL,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  type_implant type_implant NOT NULL DEFAULT 'IMPLANT',
  lot TEXT,
  notes TEXT,
  type_prothese type_prothese,
  quantite quantite_prothese,
  mobilite mobilite_prothese,
  type_pilier type_pilier,
  is_favorite BOOLEAN NOT NULL DEFAULT false
);

-- ÉTAPE 5: Créer la table surgery_implants (implants posés)
CREATE TABLE IF NOT EXISTS surgery_implants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  surgery_id VARCHAR NOT NULL REFERENCES operations(id),
  implant_id VARCHAR NOT NULL REFERENCES implants(id),
  site_fdi TEXT NOT NULL,
  position_implant position_implant,
  type_os type_os,
  mise_en_charge mise_en_charge,
  greffe_osseuse BOOLEAN DEFAULT false,
  type_greffe TEXT,
  type_chirurgie_temps type_chirurgie_temps,
  isq_pose REAL,
  isq_2m REAL,
  isq_3m REAL,
  isq_6m REAL,
  statut statut_implant NOT NULL DEFAULT 'EN_SUIVI',
  date_pose DATE NOT NULL,
  notes TEXT,
  bone_loss_score INTEGER
);

-- ÉTAPE 6: Créer la table appointments
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  patient_id VARCHAR NOT NULL REFERENCES patients(id),
  operation_id VARCHAR,
  surgery_implant_id VARCHAR,
  type appointment_type NOT NULL,
  status appointment_status NOT NULL DEFAULT 'UPCOMING',
  title TEXT NOT NULL,
  description TEXT,
  date_start TIMESTAMP NOT NULL,
  date_end TIMESTAMP,
  isq REAL,
  radio_id VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,
  external_provider TEXT,
  external_calendar_id TEXT,
  external_event_id TEXT,
  sync_status sync_status NOT NULL DEFAULT 'NONE',
  last_synced_at TIMESTAMP,
  external_etag TEXT,
  sync_error TEXT,
  color TEXT,
  isq_vestibulaire REAL,
  isq_mesial REAL,
  isq_distal REAL
);

-- ÉTAPE 7: Créer la table flags
CREATE TABLE IF NOT EXISTS flags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  level flag_level NOT NULL,
  type flag_type NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  entity_type entity_type NOT NULL,
  entity_id VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR
);

-- ÉTAPE 8: Créer la table documents
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  patient_id VARCHAR,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  file_name TEXT,
  tags TEXT[],
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  operation_id VARCHAR
);

-- ÉTAPE 9: Créer la table calendar_integrations
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  user_id VARCHAR,
  provider TEXT NOT NULL DEFAULT 'google',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  target_calendar_id TEXT,
  target_calendar_name TEXT,
  source_calendar_id TEXT,
  source_calendar_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  scope TEXT,
  provider_user_email TEXT,
  import_enabled BOOLEAN DEFAULT false,
  sync_token TEXT,
  last_sync_at TIMESTAMP,
  last_import_at TIMESTAMP,
  sync_error_count INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ÉTAPE 10: Créer la table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  recipient_user_id VARCHAR NOT NULL,
  kind notification_kind NOT NULL,
  type TEXT NOT NULL,
  severity notification_severity NOT NULL DEFAULT 'INFO',
  title TEXT NOT NULL,
  body TEXT,
  entity_type entity_type,
  entity_id VARCHAR,
  actor_user_id VARCHAR,
  metadata TEXT,
  dedupe_key TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP,
  archived_at TIMESTAMP,
  digested_at TIMESTAMP
);

-- ÉTAPE 11: Créer la table saved_filters
CREATE TABLE IF NOT EXISTS saved_filters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  page_type page_type NOT NULL,
  filter_data TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ÉTAPE 12: Créer la table audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id),
  user_id VARCHAR,
  entity_type entity_type NOT NULL,
  entity_id VARCHAR NOT NULL,
  action audit_action NOT NULL,
  details TEXT,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ÉTAPE 13: Créer les tables patch_notes
CREATE TABLE IF NOT EXISTS patch_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  version TEXT NOT NULL,
  date DATE NOT NULL,
  baseline TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patch_note_lines (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patch_note_id VARCHAR NOT NULL REFERENCES patch_notes(id),
  description TEXT NOT NULL,
  type patch_note_type NOT NULL DEFAULT 'FEATURE',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ÉTAPE 14: Créer la table notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  digest_frequency TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ÉTAPE 15: Créer la table onboarding_state
CREATE TABLE IF NOT EXISTS onboarding_state (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  completed_steps TEXT[] DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ÉTAPE 16: Insérer les données patch notes de base
INSERT INTO patch_notes (id, version, date, baseline) VALUES
('patch-1-0-0', '1.0.0', '2026-01-15', 'Lancement initial de Cassius'),
('patch-1-0-1', '1.0.1', '2026-01-31', 'Améliorations UI et corrections')
ON CONFLICT (id) DO NOTHING;

INSERT INTO patch_note_lines (id, patch_note_id, description, type, "order") VALUES
('pnl-100-1', 'patch-1-0-0', 'Gestion complète des patients et dossiers médicaux', 'FEATURE', 1),
('pnl-100-2', 'patch-1-0-0', 'Suivi des implants avec mesures ISQ', 'FEATURE', 2),
('pnl-100-3', 'patch-1-0-0', 'Calendrier avec synchronisation Google Calendar', 'FEATURE', 3),
('pnl-100-4', 'patch-1-0-0', 'Gestion des documents et radiographies', 'FEATURE', 4),
('pnl-100-5', 'patch-1-0-0', 'Tableau de bord personnalisable', 'FEATURE', 5),
('pnl-101-1', 'patch-1-0-1', 'Badge alerte patient en couleur pastel', 'IMPROVEMENT', 1),
('pnl-101-2', 'patch-1-0-1', 'Affichage dynamique des notes de patch depuis la base de données', 'IMPROVEMENT', 2),
('pnl-101-3', 'patch-1-0-1', 'Correction de l''upload de documents', 'BUGFIX', 3)
ON CONFLICT (id) DO NOTHING;

-- FIN DU SCRIPT
-- Si vous avez des erreurs, vérifiez les messages et adaptez le script
