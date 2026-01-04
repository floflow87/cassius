-- Migration: Add ALL missing columns to appointments table
-- Version: 20241230_007
-- Idempotent: Uses column existence checks

-- Create sync_status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE public.sync_status AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR');
    END IF;
END$$;

-- Add completed_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN completed_at TIMESTAMP;
    END IF;
END$$;

-- Add cancelled_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN cancelled_at TIMESTAMP;
    END IF;
END$$;

-- Add cancel_reason column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'cancel_reason'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN cancel_reason TEXT;
    END IF;
END$$;

-- Add external_provider column (Google Calendar sync)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'external_provider'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_provider TEXT;
    END IF;
END$$;

-- Add external_calendar_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'external_calendar_id'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_calendar_id TEXT;
    END IF;
END$$;

-- Add external_event_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'external_event_id'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_event_id TEXT;
    END IF;
END$$;

-- Add sync_status column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'sync_status'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN sync_status sync_status DEFAULT 'NONE' NOT NULL;
    END IF;
END$$;

-- Add last_synced_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'last_synced_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN last_synced_at TIMESTAMP;
    END IF;
END$$;

-- Add external_etag column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'external_etag'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_etag TEXT;
    END IF;
END$$;

-- Add sync_error column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'sync_error'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN sync_error TEXT;
    END IF;
END$$;

-- Add updated_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN updated_at TIMESTAMP DEFAULT now() NOT NULL;
    END IF;
END$$;
