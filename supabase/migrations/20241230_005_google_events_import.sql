-- Migration: Create google_calendar_events and sync_conflicts tables for V2 (Google -> Cassius)
-- Version: 20241230_005
-- Idempotent: Uses IF NOT EXISTS

-- Create google_event_status enum type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'google_event_status') THEN
        CREATE TYPE public.google_event_status AS ENUM ('confirmed', 'tentative', 'cancelled');
    END IF;
END$$;

-- Create sync_conflict_status enum type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_conflict_status') THEN
        CREATE TYPE public.sync_conflict_status AS ENUM ('open', 'resolved', 'ignored');
    END IF;
END$$;

-- Create sync_conflict_source enum type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_conflict_source') THEN
        CREATE TYPE public.sync_conflict_source AS ENUM ('google', 'cassius');
    END IF;
END$$;

-- Create google_calendar_events table - Idempotent mapping of Google events
CREATE TABLE IF NOT EXISTS public.google_calendar_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id VARCHAR REFERENCES public.users(id) ON DELETE SET NULL,
    integration_id VARCHAR REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
    google_calendar_id TEXT NOT NULL,
    google_event_id TEXT NOT NULL,
    etag TEXT,
    status google_event_status DEFAULT 'confirmed',
    summary TEXT,
    description TEXT,
    location TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT false,
    attendees JSONB,
    html_link TEXT,
    updated_at_google TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    cassius_appointment_id VARCHAR REFERENCES public.appointments(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create unique index for idempotent upsert: (org, calendar, event)
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_events_unique_idx 
    ON public.google_calendar_events (organisation_id, google_calendar_id, google_event_id);

-- Create index for efficient time-range queries
CREATE INDEX IF NOT EXISTS google_calendar_events_org_time_idx 
    ON public.google_calendar_events (organisation_id, start_at, end_at);

-- Create sync_conflicts table - Track and manage import conflicts
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id VARCHAR REFERENCES public.users(id) ON DELETE SET NULL,
    source sync_conflict_source NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'event',
    external_id TEXT,
    internal_id VARCHAR,
    reason TEXT NOT NULL,
    payload JSONB,
    status sync_conflict_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP,
    resolved_by VARCHAR REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create index for efficient conflict listing
CREATE INDEX IF NOT EXISTS sync_conflicts_org_status_idx 
    ON public.sync_conflicts (organisation_id, status);

-- Add import settings columns to calendar_integrations
DO $$
BEGIN
    -- Import source calendar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_integrations' AND column_name = 'source_calendar_id'
    ) THEN
        ALTER TABLE public.calendar_integrations ADD COLUMN source_calendar_id TEXT;
    END IF;

    -- Import source calendar name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_integrations' AND column_name = 'source_calendar_name'
    ) THEN
        ALTER TABLE public.calendar_integrations ADD COLUMN source_calendar_name TEXT;
    END IF;

    -- Import enabled toggle
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_integrations' AND column_name = 'import_enabled'
    ) THEN
        ALTER TABLE public.calendar_integrations ADD COLUMN import_enabled BOOLEAN DEFAULT false;
    END IF;

    -- Last import timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_integrations' AND column_name = 'last_import_at'
    ) THEN
        ALTER TABLE public.calendar_integrations ADD COLUMN last_import_at TIMESTAMP;
    END IF;

    -- Sync token for incremental sync
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_integrations' AND column_name = 'sync_token'
    ) THEN
        ALTER TABLE public.calendar_integrations ADD COLUMN sync_token TEXT;
    END IF;
END$$;

-- Add comments for documentation
COMMENT ON TABLE public.google_calendar_events IS 'Imported Google Calendar events for V2 bidirectional sync';
COMMENT ON TABLE public.sync_conflicts IS 'Tracks conflicts between Cassius and Google Calendar events';
COMMENT ON COLUMN public.google_calendar_events.google_event_id IS 'Google Calendar event ID, unique per calendar';
COMMENT ON COLUMN public.google_calendar_events.etag IS 'Google etag for change detection';
COMMENT ON COLUMN public.google_calendar_events.cassius_appointment_id IS 'Link to corresponding Cassius appointment if created';
