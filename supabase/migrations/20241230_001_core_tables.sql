-- Migration: Create all core tables missing on PROD
-- Version: 20241230_core_tables
-- Idempotent: Uses IF NOT EXISTS / DO blocks
-- Order: Enums first, then tables respecting FK dependencies

-- =====================================================
-- STEP 1: CREATE ALL ENUM TYPES
-- =====================================================

-- type_note_tag
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_note_tag') THEN
        CREATE TYPE public.type_note_tag AS ENUM ('CONSULTATION', 'CHIRURGIE', 'SUIVI', 'COMPLICATION', 'ADMINISTRATIVE');
    END IF;
END$$;

-- type_rdv_tag
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_rdv_tag') THEN
        CREATE TYPE public.type_rdv_tag AS ENUM ('CONSULTATION', 'SUIVI', 'CHIRURGIE');
    END IF;
END$$;

-- appointment_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
        CREATE TYPE public.appointment_type AS ENUM ('CONSULTATION', 'SUIVI', 'CHIRURGIE', 'CONTROLE', 'URGENCE', 'AUTRE');
    END IF;
END$$;

-- appointment_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE public.appointment_status AS ENUM ('UPCOMING', 'COMPLETED', 'CANCELLED');
    END IF;
END$$;

-- sync_status (may already exist from previous migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE public.sync_status AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR');
    END IF;
END$$;

-- type_document_tag
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'type_document_tag') THEN
        CREATE TYPE public.type_document_tag AS ENUM ('DEVIS', 'CONSENTEMENT', 'COMPTE_RENDU', 'ASSURANCE', 'AUTRE');
    END IF;
END$$;

-- saved_filter_page_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saved_filter_page_type') THEN
        CREATE TYPE public.saved_filter_page_type AS ENUM ('patients', 'implants', 'actes');
    END IF;
END$$;

-- flag_level
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_level') THEN
        CREATE TYPE public.flag_level AS ENUM ('CRITICAL', 'WARNING', 'INFO');
    END IF;
END$$;

-- flag_entity_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_entity_type') THEN
        CREATE TYPE public.flag_entity_type AS ENUM ('PATIENT', 'OPERATION', 'IMPLANT');
    END IF;
END$$;

-- flag_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_type') THEN
        CREATE TYPE public.flag_type AS ENUM (
            'ISQ_LOW',
            'ISQ_DECLINING',
            'LOW_SUCCESS_RATE',
            'NO_RECENT_ISQ',
            'NO_POSTOP_FOLLOWUP',
            'NO_RECENT_APPOINTMENT',
            'IMPLANT_NO_OPERATION',
            'MISSING_DOCUMENT',
            'INCOMPLETE_DATA'
        );
    END IF;
END$$;

-- =====================================================
-- STEP 2: CREATE TABLES (respecting FK order)
-- =====================================================

-- Table: notes
CREATE TABLE IF NOT EXISTS public.notes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    patient_id VARCHAR NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tag type_note_tag,
    contenu TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Table: rendez_vous
CREATE TABLE IF NOT EXISTS public.rendez_vous (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    patient_id VARCHAR NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    heure_debut TEXT NOT NULL,
    heure_fin TEXT NOT NULL,
    tag type_rdv_tag NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Table: appointments (depends on organisations, patients, operations, surgery_implants, radios)
CREATE TABLE IF NOT EXISTS public.appointments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    patient_id VARCHAR NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    operation_id VARCHAR REFERENCES public.operations(id) ON DELETE SET NULL,
    surgery_implant_id VARCHAR REFERENCES public.surgery_implants(id) ON DELETE SET NULL,
    type appointment_type NOT NULL,
    status appointment_status NOT NULL DEFAULT 'UPCOMING',
    title TEXT NOT NULL,
    description TEXT,
    date_start TIMESTAMP NOT NULL,
    date_end TIMESTAMP,
    isq REAL,
    radio_id VARCHAR REFERENCES public.radios(id) ON DELETE SET NULL,
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
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Table: documents
CREATE TABLE IF NOT EXISTS public.documents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    patient_id VARCHAR REFERENCES public.patients(id) ON DELETE CASCADE,
    operation_id VARCHAR REFERENCES public.operations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    file_name TEXT,
    tags TEXT[],
    created_by VARCHAR REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Table: flags
CREATE TABLE IF NOT EXISTS public.flags (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    level flag_level NOT NULL,
    type flag_type NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    entity_type flag_entity_type NOT NULL,
    entity_id VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP,
    resolved_by VARCHAR REFERENCES public.users(id) ON DELETE SET NULL
);

-- Table: saved_filters
CREATE TABLE IF NOT EXISTS public.saved_filters (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    page_type saved_filter_page_type NOT NULL,
    filter_data TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================
-- STEP 3: CREATE INDEXES
-- =====================================================

-- Appointments indexes
CREATE INDEX IF NOT EXISTS appointments_org_idx ON public.appointments (organisation_id);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON public.appointments (patient_id);
CREATE INDEX IF NOT EXISTS appointments_date_start_idx ON public.appointments (date_start);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments (status);
CREATE INDEX IF NOT EXISTS appointments_sync_status_idx ON public.appointments (sync_status);

-- Notes indexes
CREATE INDEX IF NOT EXISTS notes_org_idx ON public.notes (organisation_id);
CREATE INDEX IF NOT EXISTS notes_patient_idx ON public.notes (patient_id);

-- Documents indexes
CREATE INDEX IF NOT EXISTS documents_org_idx ON public.documents (organisation_id);
CREATE INDEX IF NOT EXISTS documents_patient_idx ON public.documents (patient_id);

-- Flags indexes
CREATE INDEX IF NOT EXISTS flags_org_idx ON public.flags (organisation_id);
CREATE INDEX IF NOT EXISTS flags_entity_idx ON public.flags (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS flags_level_idx ON public.flags (level);

-- Saved filters indexes
CREATE INDEX IF NOT EXISTS saved_filters_org_idx ON public.saved_filters (organisation_id);
CREATE INDEX IF NOT EXISTS saved_filters_page_type_idx ON public.saved_filters (page_type);

-- =====================================================
-- STEP 4: COMMENTS
-- =====================================================

COMMENT ON TABLE public.notes IS 'Clinical notes for patients';
COMMENT ON TABLE public.rendez_vous IS 'Legacy appointment table (use appointments instead)';
COMMENT ON TABLE public.appointments IS 'Unified appointment system with Google Calendar sync support';
COMMENT ON TABLE public.documents IS 'Patient documents (PDFs, etc.)';
COMMENT ON TABLE public.flags IS 'Clinical alerts and warnings';
COMMENT ON TABLE public.saved_filters IS 'Saved advanced filters per page type';
