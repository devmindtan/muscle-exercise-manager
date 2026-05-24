-- Add JSONB structure for storing one InBody report per row.
ALTER TABLE public.body_measurements
ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'single_metric';

ALTER TABLE public.body_measurements
ADD COLUMN IF NOT EXISTS metrics_json jsonb;

-- Ensure one active JSON InBody row per user + measured_at.
CREATE UNIQUE INDEX IF NOT EXISTS idx_body_measurements_inbody_json_unique
ON public.body_measurements(user_id, measured_at, record_type)
WHERE record_type = 'inbody_json' AND deleted_at IS NULL;

-- Backfill old manual_inbody metric rows into one JSON row per report.
INSERT INTO public.body_measurements (
  id,
  metric_key,
  value,
  unit,
  note,
  source,
  measured_at,
  created_at,
  updated_at,
  deleted_at,
  sync_status,
  user_id,
  record_type,
  metrics_json
)
SELECT
  gen_random_uuid(),
  'inbody_json',
  0,
  'jsonb',
  MAX(note),
  'manual_inbody_json',
  measured_at,
  MIN(created_at),
  MAX(updated_at),
  NULL,
  'pending',
  user_id,
  'inbody_json',
  jsonb_object_agg(
    metric_key,
    jsonb_build_object('value', value, 'unit', unit)
  )
FROM public.body_measurements
WHERE deleted_at IS NULL
  AND source = 'manual_inbody'
  AND metric_key IS NOT NULL
GROUP BY user_id, measured_at
ON CONFLICT (user_id, measured_at, record_type)
WHERE record_type = 'inbody_json' AND deleted_at IS NULL
DO NOTHING;

-- Keep old rows for audit/history but hide them from active reads.
UPDATE public.body_measurements legacy
SET
  deleted_at = COALESCE(legacy.deleted_at, now()),
  updated_at = now(),
  sync_status = COALESCE(legacy.sync_status, 'pending')
WHERE legacy.deleted_at IS NULL
  AND legacy.source = 'manual_inbody'
  AND legacy.record_type = 'single_metric'
  AND EXISTS (
    SELECT 1
    FROM public.body_measurements json_row
    WHERE json_row.user_id = legacy.user_id
      AND json_row.measured_at = legacy.measured_at
      AND json_row.record_type = 'inbody_json'
      AND json_row.deleted_at IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_body_measurements_record_type
ON public.body_measurements(record_type);
