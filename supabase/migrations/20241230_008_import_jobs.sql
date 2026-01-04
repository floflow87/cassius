-- Migration: Create import_jobs and import_job_rows tables for CSV import
-- Version: 20241230_008
-- Idempotent: Uses IF NOT EXISTS

-- Create import_job_status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_job_status') THEN
        CREATE TYPE public.import_job_status AS ENUM ('pending', 'validating', 'validated', 'running', 'completed', 'failed');
    END IF;
END$$;

-- Create import_row_status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_row_status') THEN
        CREATE TYPE public.import_row_status AS ENUM ('ok', 'warning', 'error', 'collision', 'skipped');
    END IF;
END$$;

-- Create import_jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id VARCHAR REFERENCES public.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'patients_csv',
    status import_job_status NOT NULL DEFAULT 'pending',
    file_name TEXT,
    file_path TEXT,
    file_hash TEXT,
    total_rows INTEGER DEFAULT 0,
    stats JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    validated_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create index for import_jobs
CREATE INDEX IF NOT EXISTS import_jobs_org_idx ON public.import_jobs (organisation_id, created_at DESC);

-- Create import_job_rows table
CREATE TABLE IF NOT EXISTS public.import_job_rows (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    normalized_data JSONB,
    status import_row_status NOT NULL DEFAULT 'ok',
    errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    matched_patient_id VARCHAR REFERENCES public.patients(id) ON DELETE SET NULL,
    match_type TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for import_job_rows
CREATE INDEX IF NOT EXISTS import_job_rows_job_idx ON public.import_job_rows (job_id, row_index);
CREATE INDEX IF NOT EXISTS import_job_rows_status_idx ON public.import_job_rows (job_id, status);

-- Add comments
COMMENT ON TABLE public.import_jobs IS 'Tracks CSV import jobs with status and statistics';
COMMENT ON TABLE public.import_job_rows IS 'Individual rows from CSV imports with validation results';
COMMENT ON COLUMN public.import_jobs.stats IS 'JSON with counts: created, updated, collisions, errors, warnings';
COMMENT ON COLUMN public.import_job_rows.match_type IS 'How patient was matched: file_number, name_dob, email, or null for new';
