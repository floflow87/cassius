-- Migration script for Supabase database to sync with new schema
-- Run this in Supabase SQL Editor

-- Create type_implant enum if not exists
DO $$ BEGIN
    CREATE TYPE type_implant AS ENUM ('IMPLANT', 'MINI_IMPLANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add type_implant column to implants if not exists
DO $$ BEGIN
    ALTER TABLE implants ADD COLUMN type_implant type_implant NOT NULL DEFAULT 'IMPLANT';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create surgery_implants table if not exists
CREATE TABLE IF NOT EXISTS surgery_implants (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    surgery_id VARCHAR NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    implant_id VARCHAR NOT NULL REFERENCES implants(id) ON DELETE CASCADE,
    site_fdi TEXT NOT NULL,
    position_implant position_implant DEFAULT 'CRESTAL',
    type_os type_os,
    mise_en_charge type_mise_en_charge,
    greffe BOOLEAN DEFAULT false,
    isq_pose REAL,
    isq_2m REAL,
    isq_3m REAL,
    isq_6m REAL,
    statut statut_implant DEFAULT 'EN_SUIVI',
    date_pose DATE,
    notes TEXT
);

-- Create indexes for surgery_implants
CREATE INDEX IF NOT EXISTS idx_surgery_implants_organisation ON surgery_implants(organisation_id);
CREATE INDEX IF NOT EXISTS idx_surgery_implants_surgery ON surgery_implants(surgery_id);
CREATE INDEX IF NOT EXISTS idx_surgery_implants_implant ON surgery_implants(implant_id);

-- Migrate data from old implants columns to surgery_implants if data exists
-- Only run if old columns exist and surgery_implants is empty
DO $$ 
DECLARE
    old_columns_exist BOOLEAN;
    surgery_implants_empty BOOLEAN;
BEGIN
    -- Check if old columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'implants' AND column_name = 'operation_id'
    ) INTO old_columns_exist;
    
    -- Check if surgery_implants is empty
    SELECT NOT EXISTS (SELECT 1 FROM surgery_implants LIMIT 1) INTO surgery_implants_empty;
    
    -- Only migrate if old columns exist and target is empty
    IF old_columns_exist AND surgery_implants_empty THEN
        INSERT INTO surgery_implants (
            id, organisation_id, surgery_id, implant_id, site_fdi, 
            position_implant, type_os, mise_en_charge, greffe,
            isq_pose, isq_2m, isq_3m, isq_6m, statut, date_pose, notes
        )
        SELECT 
            gen_random_uuid()::text,
            i.organisation_id,
            i.operation_id,
            i.id,
            COALESCE(i.site_fdi, '00'),
            i.position_implant,
            i.type_os,
            i.mise_en_charge_prevue,
            false,
            i.isq_pose,
            i.isq_2m,
            i.isq_3m,
            i.isq_6m,
            i.statut,
            i.date_pose,
            NULL
        FROM implants i
        WHERE i.operation_id IS NOT NULL;
        
        RAISE NOTICE 'Migrated % rows from implants to surgery_implants', (SELECT COUNT(*) FROM surgery_implants);
    END IF;
END $$;

-- Drop old columns from implants (optional - run separately after verification)
-- ALTER TABLE implants DROP COLUMN IF EXISTS operation_id;
-- ALTER TABLE implants DROP COLUMN IF EXISTS patient_id;
-- ALTER TABLE implants DROP COLUMN IF EXISTS site_fdi;
-- ALTER TABLE implants DROP COLUMN IF EXISTS position_implant;
-- ALTER TABLE implants DROP COLUMN IF EXISTS type_os;
-- ALTER TABLE implants DROP COLUMN IF EXISTS mise_en_charge_prevue;
-- ALTER TABLE implants DROP COLUMN IF EXISTS isq_pose;
-- ALTER TABLE implants DROP COLUMN IF EXISTS isq_2m;
-- ALTER TABLE implants DROP COLUMN IF EXISTS isq_3m;
-- ALTER TABLE implants DROP COLUMN IF EXISTS isq_6m;
-- ALTER TABLE implants DROP COLUMN IF EXISTS statut;
-- ALTER TABLE implants DROP COLUMN IF EXISTS date_pose;

-- ============================================
-- Performance Indexes (added December 2025)
-- ============================================
-- Multi-column indexes for optimized JOIN queries

-- Index on surgery_implants for queries by organisation and surgery
CREATE INDEX IF NOT EXISTS idx_surgery_implants_org_surgery 
ON surgery_implants(organisation_id, surgery_id);

-- Index on surgery_implants for queries by organisation and implant
CREATE INDEX IF NOT EXISTS idx_surgery_implants_org_implant 
ON surgery_implants(organisation_id, implant_id);

-- Index on operations for queries by organisation and patient
CREATE INDEX IF NOT EXISTS idx_operations_org_patient 
ON operations(organisation_id, patient_id);

-- Index on radios for queries by organisation and patient
CREATE INDEX IF NOT EXISTS idx_radios_org_patient 
ON radios(organisation_id, patient_id);

-- Index on patients for queries by organisation
CREATE INDEX IF NOT EXISTS idx_patients_org 
ON patients(organisation_id);

-- Index on visites for queries by organisation and implant
CREATE INDEX IF NOT EXISTS idx_visites_org_implant 
ON visites(organisation_id, implant_id);

-- Index on documents for queries by organisation and patient
CREATE INDEX IF NOT EXISTS idx_documents_org_patient 
ON documents(organisation_id, patient_id);

-- ============================================
-- Saved Filters Table (added December 2025)
-- ============================================
-- Create saved_filter_page_type enum if not exists
DO $$ BEGIN
    CREATE TYPE saved_filter_page_type AS ENUM ('patients', 'implants', 'actes');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create saved_filters table if not exists
CREATE TABLE IF NOT EXISTS saved_filters (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    page_type saved_filter_page_type NOT NULL,
    filter_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index on saved_filters for queries by organisation and page_type
CREATE INDEX IF NOT EXISTS idx_saved_filters_org_page 
ON saved_filters(organisation_id, page_type);
