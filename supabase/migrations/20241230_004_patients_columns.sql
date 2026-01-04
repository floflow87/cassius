-- Migration: Add missing columns to patients table
-- This aligns PROD with DEV schema

-- Add organisation_id column (required for multi-tenancy)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS organisation_id VARCHAR(255);

-- Add medical information columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS traitement TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS conditions TEXT;

-- Add address columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS code_postal TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pays TEXT;

-- Add status column
DO $$ BEGIN
  CREATE TYPE patient_status AS ENUM ('ACTIF', 'INACTIF', 'ARCHIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS statut patient_status DEFAULT 'ACTIF';

-- Set default organisation_id for existing patients without one
UPDATE patients SET organisation_id = 'default-org-001' WHERE organisation_id IS NULL;

-- Make organisation_id NOT NULL after setting defaults
ALTER TABLE patients ALTER COLUMN organisation_id SET NOT NULL;

-- Add foreign key constraint if not exists
DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT patients_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES organisations(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add index on organisation_id for query performance
CREATE INDEX IF NOT EXISTS idx_patients_organisation_id ON patients(organisation_id);
