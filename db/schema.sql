-- Cassius Database Schema
-- This file is the source of truth for the database structure
-- Apply with: npm run db:dev:apply or npm run db:prod:apply

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE sexe AS ENUM ('HOMME', 'FEMME');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_intervention AS ENUM (
    'POSE_IMPLANT', 'GREFFE_OSSEUSE', 'SINUS_LIFT',
    'EXTRACTION_IMPLANT_IMMEDIATE', 'REPRISE_IMPLANT', 'CHIRURGIE_GUIDEE'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_chirurgie_temps AS ENUM ('UN_TEMPS', 'DEUX_TEMPS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_chirurgie_approche AS ENUM ('LAMBEAU', 'FLAPLESS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_mise_en_charge AS ENUM ('IMMEDIATE', 'PRECOCE', 'DIFFEREE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE position_implant AS ENUM ('CRESTAL', 'SOUS_CRESTAL', 'SUPRA_CRESTAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_os AS ENUM ('D1', 'D2', 'D3', 'D4');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE statut_implant AS ENUM ('EN_SUIVI', 'SUCCES', 'COMPLICATION', 'ECHEC');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_radio AS ENUM ('PANORAMIQUE', 'CBCT', 'RETROALVEOLAIRE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE role AS ENUM ('CHIRURGIEN', 'ASSISTANT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_prothese AS ENUM ('VISSEE', 'SCELLEE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE type_pilier AS ENUM ('DROIT', 'ANGULE', 'MULTI_UNIT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Organisations (multi-tenant)
CREATE TABLE IF NOT EXISTS organisations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nom TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR REFERENCES organisations(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role role NOT NULL DEFAULT 'ASSISTANT',
  nom TEXT,
  prenom TEXT
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  sexe sexe NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  pays TEXT,
  contexte_medical TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Operations
CREATE TABLE IF NOT EXISTS operations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date_operation DATE NOT NULL,
  type_intervention type_intervention NOT NULL,
  type_chirurgie_temps type_chirurgie_temps,
  type_chirurgie_approche type_chirurgie_approche,
  greffe_osseuse BOOLEAN DEFAULT FALSE,
  type_greffe TEXT,
  greffe_quantite TEXT,
  greffe_localisation TEXT,
  type_mise_en_charge type_mise_en_charge,
  conditions_medicales_preop TEXT,
  notes_perop TEXT,
  observations_postop TEXT
);

-- Implants
CREATE TABLE IF NOT EXISTS implants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  operation_id VARCHAR NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  marque TEXT NOT NULL,
  reference_fabricant TEXT,
  diametre REAL NOT NULL,
  longueur REAL NOT NULL,
  site_fdi TEXT NOT NULL,
  position_implant position_implant,
  type_os type_os,
  mise_en_charge_prevue type_mise_en_charge,
  isq_pose REAL,
  isq_2m REAL,
  isq_3m REAL,
  isq_6m REAL,
  statut statut_implant NOT NULL DEFAULT 'EN_SUIVI',
  date_pose DATE NOT NULL
);

-- Radios
CREATE TABLE IF NOT EXISTS radios (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  operation_id VARCHAR REFERENCES operations(id) ON DELETE SET NULL,
  implant_id VARCHAR REFERENCES implants(id) ON DELETE SET NULL,
  type type_radio NOT NULL,
  url TEXT NOT NULL,
  date DATE NOT NULL
);

-- Visites (follow-up visits)
CREATE TABLE IF NOT EXISTS visites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  implant_id VARCHAR NOT NULL REFERENCES implants(id) ON DELETE CASCADE,
  patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  isq REAL,
  notes TEXT,
  radio_id VARCHAR REFERENCES radios(id) ON DELETE SET NULL
);

-- Protheses (prosthetics)
CREATE TABLE IF NOT EXISTS protheses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  implant_id VARCHAR NOT NULL REFERENCES implants(id) ON DELETE CASCADE,
  prothese_unitaire BOOLEAN NOT NULL DEFAULT TRUE,
  type_prothese type_prothese NOT NULL,
  type_pilier type_pilier,
  date_pose DATE,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_organisation ON patients(organisation_id);
CREATE INDEX IF NOT EXISTS idx_patients_nom ON patients(nom);
CREATE INDEX IF NOT EXISTS idx_operations_patient ON operations(patient_id);
CREATE INDEX IF NOT EXISTS idx_operations_organisation ON operations(organisation_id);
CREATE INDEX IF NOT EXISTS idx_implants_patient ON implants(patient_id);
CREATE INDEX IF NOT EXISTS idx_implants_organisation ON implants(organisation_id);
CREATE INDEX IF NOT EXISTS idx_implants_operation ON implants(operation_id);
CREATE INDEX IF NOT EXISTS idx_visites_implant ON visites(implant_id);
CREATE INDEX IF NOT EXISTS idx_radios_patient ON radios(patient_id);
CREATE INDEX IF NOT EXISTS idx_users_organisation ON users(organisation_id);
