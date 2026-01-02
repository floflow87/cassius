-- Migration: Add status tracking columns to appointments table
-- Version: 20241230_007
-- Idempotent: Uses column existence checks

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

-- Add comments
COMMENT ON COLUMN public.appointments.completed_at IS 'Timestamp when appointment was marked as completed';
COMMENT ON COLUMN public.appointments.cancelled_at IS 'Timestamp when appointment was cancelled';
COMMENT ON COLUMN public.appointments.cancel_reason IS 'Reason for cancellation';
