-- Migration: Create calendar_integrations and appointment_external_links tables
-- Version: 20241230
-- Idempotent: Uses IF NOT EXISTS

-- Create sync_status enum type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE public.sync_status AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR');
    END IF;
END$$;

-- Create calendar_integrations table
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id VARCHAR REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    target_calendar_id TEXT,
    target_calendar_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    scope TEXT,
    provider_user_email TEXT,
    last_sync_at TIMESTAMP,
    sync_error_count INTEGER NOT NULL DEFAULT 0,
    last_sync_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create unique index for org+provider+user combination
CREATE UNIQUE INDEX IF NOT EXISTS calendar_integrations_org_provider_user_idx 
    ON public.calendar_integrations (organisation_id, provider, user_id);

-- Create appointment_external_links table for V2 multi-calendar support
CREATE TABLE IF NOT EXISTS public.appointment_external_links (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id VARCHAR NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    integration_id VARCHAR NOT NULL REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google',
    external_calendar_id TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    etag TEXT,
    sync_status sync_status NOT NULL DEFAULT 'NONE',
    last_synced_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create unique index for appointment+integration combination
CREATE UNIQUE INDEX IF NOT EXISTS appointment_external_links_appt_integration_idx 
    ON public.appointment_external_links (appointment_id, integration_id);

-- Add comment for documentation
COMMENT ON TABLE public.calendar_integrations IS 'OAuth tokens and settings for Google Calendar integration per organization or user';
COMMENT ON TABLE public.appointment_external_links IS 'Maps Cassius appointments to external calendar events (V2 multi-calendar support)';
