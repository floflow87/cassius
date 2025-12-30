-- Migration script: Convert visites to appointments
-- This script migrates existing data from the visites table to the new appointments table
-- Run this once to preserve existing data

-- Step 1: Insert visites as completed appointments
-- Use a subquery to get DISTINCT combinations and select the best matching surgery_implant
INSERT INTO appointments (
  id,
  organisation_id,
  patient_id,
  operation_id,
  surgery_implant_id,
  type,
  status,
  title,
  description,
  date_start,
  date_end,
  isq,
  radio_id,
  created_at,
  updated_at
)
SELECT DISTINCT ON (v.id)
  gen_random_uuid()::text as id,
  v.organisation_id,
  v.patient_id,
  si.surgery_id as operation_id,
  si.id as surgery_implant_id,
  'SUIVI'::appointment_type as type,
  'COMPLETED'::appointment_status as status,
  'Visite de suivi' as title,
  v.notes as description,
  (v.date || ' 09:00:00')::timestamp as date_start,
  (v.date || ' 09:30:00')::timestamp as date_end,
  v.isq,
  v.radio_id,
  NOW() as created_at,
  NOW() as updated_at
FROM visites v
LEFT JOIN surgery_implants si ON si.implant_id = v.implant_id 
  AND si.organisation_id = v.organisation_id
  AND si.id IN (
    -- Select the most relevant surgery implant (closest date before visit)
    SELECT si2.id FROM surgery_implants si2 
    WHERE si2.implant_id = v.implant_id 
      AND si2.organisation_id = v.organisation_id
      AND si2.date_pose <= v.date
    ORDER BY si2.date_pose DESC 
    LIMIT 1
  )
WHERE NOT EXISTS (
  -- Avoid duplicates: check if an appointment already exists for this visit date + patient + notes
  SELECT 1 FROM appointments a 
  WHERE a.date_start::date = v.date::date
    AND a.patient_id = v.patient_id
    AND a.type = 'SUIVI'
    AND a.status = 'COMPLETED'
)
ORDER BY v.id, si.date_pose DESC NULLS LAST;

-- Summary of migration
SELECT 
  'Migrated' as status,
  COUNT(*) as appointment_count
FROM appointments
WHERE type = 'SUIVI' AND status = 'COMPLETED';
