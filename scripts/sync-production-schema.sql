-- Script SQL pour synchroniser le schéma de la base de données de production
-- Exécuter ce script dans l'éditeur SQL de Supabase sur la base de données PRODUCTION

-- =====================================================
-- CRÉER LES ENUMS MANQUANTS (ignore si existe déjà)
-- =====================================================

DO $$ BEGIN CREATE TYPE statut_patient AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_implant AS ENUM ('IMPLANT', 'MINI_IMPLANT', 'PROTHESE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE measurement_type AS ENUM ('POSE', 'FOLLOW_UP', 'CONTROL', 'EMERGENCY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_kind AS ENUM ('PATIENT_CREATED', 'PATIENT_UPDATED', 'APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER', 'ISQ_LOW', 'ISQ_CRITICAL', 'FLAG_CREATED', 'IMPLANT_STATUS_CHANGE', 'DOCUMENT_UPLOADED', 'USER_INVITED', 'SYSTEM_ALERT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_severity AS ENUM ('INFO', 'WARNING', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_entity_type AS ENUM ('PATIENT', 'APPOINTMENT', 'IMPLANT', 'OPERATION', 'DOCUMENT', 'USER', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_category AS ENUM ('CLINICAL', 'APPOINTMENT', 'DOCUMENT', 'SYSTEM', 'TEAM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_frequency AS ENUM ('INSTANT', 'HOURLY', 'DAILY', 'NEVER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE digest_status AS ENUM ('PENDING', 'SENT', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- USERS
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS was_invited boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

-- =====================================================
-- PATIENTS
-- =====================================================
ALTER TABLE patients ADD COLUMN IF NOT EXISTS statut text DEFAULT 'ACTIF';

-- =====================================================
-- IMPLANTS (catalogue)
-- =====================================================
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type text DEFAULT 'IMPLANT';

-- =====================================================
-- SURGERY_IMPLANTS
-- =====================================================
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS bone_loss_score integer;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_2m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_3m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_6m real;

-- =====================================================
-- APPOINTMENTS
-- =====================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'NONE';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_event_id text;

-- =====================================================
-- ORGANISATIONS
-- =====================================================
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- =====================================================
-- CALENDAR_INTEGRATIONS
-- =====================================================
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_error_count integer DEFAULT 0;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS target_calendar_id text;

-- =====================================================
-- NOTIFICATION_PREFERENCES
-- =====================================================
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS organisation_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS user_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS in_app_enabled boolean DEFAULT true;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS digested_at timestamp;

-- =====================================================
-- FLAGS
-- =====================================================
ALTER TABLE flags ADD COLUMN IF NOT EXISTS entity_id varchar;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved_at timestamp;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved_by varchar;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================
SELECT 'Schéma synchronisé avec succès!' as message;
