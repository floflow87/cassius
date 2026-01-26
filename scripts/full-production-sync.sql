-- =====================================================
-- SCRIPT DE SYNCHRONISATION COMPLETE PRODUCTION
-- Exécuter dans l'éditeur SQL de Supabase
-- =====================================================

-- 1. CRÉER TOUS LES ENUMS MANQUANTS
DO $$ BEGIN CREATE TYPE sexe AS ENUM ('HOMME', 'FEMME'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_intervention AS ENUM ('POSE_IMPLANT', 'EXTRACTION_POSE', 'GREFFE_OSSEUSE', 'LEVEE_SINUS', 'GREFFE_GINGIVALE', 'AUTRE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_chirurgie_temps AS ENUM ('UN_TEMPS', 'DEUX_TEMPS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_chirurgie_approche AS ENUM ('LAMBEAU', 'FLAPLESS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_mise_en_charge AS ENUM ('IMMEDIATE', 'PRECOCE', 'DIFFEREE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE position_implant AS ENUM ('CRESTAL', 'SOUS_CRESTAL', 'SUPRA_CRESTAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_os AS ENUM ('D1', 'D2', 'D3', 'D4'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE statut_implant AS ENUM ('EN_SUIVI', 'SUCCES', 'COMPLICATION', 'ECHEC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_radio AS ENUM ('PANORAMIQUE', 'CBCT', 'RETROALVEOLAIRE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE role AS ENUM ('CHIRURGIEN', 'ASSISTANT', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_prothese AS ENUM ('VISSEE', 'SCELLEE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_pilier AS ENUM ('DROIT', 'ANGULE', 'MULTI_UNIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE quantite_prothese AS ENUM ('UNITAIRE', 'PLURALE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mobilite_prothese AS ENUM ('AMOVIBLE', 'FIXE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_note_tag AS ENUM ('CONSULTATION', 'CHIRURGIE', 'SUIVI', 'COMPLICATION', 'ADMINISTRATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_rdv_tag AS ENUM ('CONSULTATION', 'SUIVI', 'CHIRURGIE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appointment_type AS ENUM ('CONSULTATION', 'SUIVI', 'CHIRURGIE', 'CONTROLE', 'URGENCE', 'AUTRE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appointment_status AS ENUM ('UPCOMING', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE google_event_status AS ENUM ('confirmed', 'tentative', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_conflict_status AS ENUM ('open', 'resolved', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_conflict_source AS ENUM ('local', 'remote'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_document_tag AS ENUM ('DEVIS', 'CONSENTEMENT', 'COMPTE_RENDU', 'ASSURANCE', 'AUTRE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE statut_patient AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE type_implant AS ENUM ('IMPLANT', 'MINI_IMPLANT', 'PROTHESE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE saved_filter_page_type AS ENUM ('patients', 'implants', 'actes'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE onboarding_status AS ENUM ('IN_PROGRESS', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE practice_type AS ENUM ('SOLO', 'CABINET'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE flag_level AS ENUM ('CRITICAL', 'WARNING', 'INFO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE flag_entity_type AS ENUM ('PATIENT', 'OPERATION', 'IMPLANT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE flag_type AS ENUM ('ISQ_LOW', 'ISQ_DECLINING', 'ISQ_CRITICAL', 'BONE_LOSS_HIGH', 'BONE_LOSS_CRITICAL', 'NO_RECENT_VISIT', 'COMPLICATION_REPORTED', 'IMPLANT_AT_RISK', 'FOLLOW_UP_OVERDUE', 'MISSING_DATA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_token_type AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_status AS ENUM ('PENDING', 'SENT', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_kind AS ENUM ('APPOINTMENT_REMINDER', 'FLAG_CREATED', 'PATIENT_CREATED', 'IMPLANT_PLACED', 'ISQ_RECORDED', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_severity AS ENUM ('INFO', 'WARNING', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_entity_type AS ENUM ('PATIENT', 'APPOINTMENT', 'IMPLANT', 'OPERATION', 'FLAG', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_category AS ENUM ('APPOINTMENTS', 'FLAGS', 'PATIENTS', 'IMPLANTS', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_frequency AS ENUM ('IMMEDIATE', 'DIGEST', 'NEVER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE digest_status AS ENUM ('PENDING', 'SENT', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE import_job_status AS ENUM ('pending', 'processing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE import_row_status AS ENUM ('ok', 'warning', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. COLONNES USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS was_invited boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

-- 3. COLONNES PATIENTS  
ALTER TABLE patients ADD COLUMN IF NOT EXISTS statut text DEFAULT 'ACTIF';

-- 4. COLONNES IMPLANTS (catalogue)
ALTER TABLE implants ADD COLUMN IF NOT EXISTS type_implant text DEFAULT 'IMPLANT';

-- 5. COLONNES SURGERY_IMPLANTS
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS bone_loss_score integer;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_2m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_3m real;
ALTER TABLE surgery_implants ADD COLUMN IF NOT EXISTS isq_6m real;

-- 6. COLONNES APPOINTMENTS
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'NONE';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_event_id text;

-- 7. COLONNES ORGANISATIONS
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- 8. COLONNES CALENDAR_INTEGRATIONS
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_error_count integer DEFAULT 0;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS target_calendar_id text;

-- 9. COLONNES NOTIFICATION_PREFERENCES
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS organisation_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS user_id varchar;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS in_app_enabled boolean DEFAULT true;

-- 10. COLONNES NOTIFICATIONS
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS digested_at timestamp;

-- 11. COLONNES FLAGS
ALTER TABLE flags ADD COLUMN IF NOT EXISTS entity_id varchar;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved_at timestamp;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved_by varchar;

-- VÉRIFICATION
SELECT 'Synchronisation terminée avec succès!' as result;
