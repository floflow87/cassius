-- Migration: Add columns for CSV patient import
-- Version: 20241230_006
-- Idempotent: Uses IF NOT EXISTS and column existence checks

-- Add file_number column (Numéro de dossier)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'file_number'
    ) THEN
        ALTER TABLE public.patients ADD COLUMN file_number TEXT;
    END IF;
END$$;

-- Add ssn column (Numéro de sécurité sociale)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'ssn'
    ) THEN
        ALTER TABLE public.patients ADD COLUMN ssn TEXT;
    END IF;
END$$;

-- Add address_full column (adresse brute importée du CSV)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'address_full'
    ) THEN
        ALTER TABLE public.patients ADD COLUMN address_full TEXT;
    END IF;
END$$;

-- Note: code_postal, ville, pays columns already exist in patients table
-- Mapping: code_postal = postal_code, ville = city, pays = country
-- Update pays default to 'France' if column exists and has no default
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'pays'
    ) THEN
        ALTER TABLE public.patients ALTER COLUMN pays SET DEFAULT 'France';
    END IF;
END$$;

-- Add unique constraint on (organisation_id, file_number) allowing NULL file_number
-- Using a partial unique index to allow multiple NULL values
CREATE UNIQUE INDEX IF NOT EXISTS patients_org_file_number_unique_idx 
    ON public.patients (organisation_id, file_number) 
    WHERE file_number IS NOT NULL;

-- Add index for file_number lookups
CREATE INDEX IF NOT EXISTS patients_org_file_number_idx 
    ON public.patients (organisation_id, file_number);

-- Add composite index for patient matching (nom, prenom, date_naissance)
CREATE INDEX IF NOT EXISTS patients_org_name_dob_idx 
    ON public.patients (organisation_id, nom, prenom, date_naissance);

-- Add index for SSN lookups
CREATE INDEX IF NOT EXISTS patients_org_ssn_idx 
    ON public.patients (organisation_id, ssn) 
    WHERE ssn IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.patients.file_number IS 'Numéro de dossier patient (unique par organisation)';
COMMENT ON COLUMN public.patients.ssn IS 'Numéro de sécurité sociale (format normalisé sans espaces)';
COMMENT ON COLUMN public.patients.address_full IS 'Adresse brute importée du CSV (rue + CP + ville)';
