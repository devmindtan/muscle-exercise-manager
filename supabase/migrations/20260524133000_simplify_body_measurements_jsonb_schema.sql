-- Simplify body_measurements for JSONB-per-InBody-record storage.
-- Safe now because legacy data was cleared by user.

-- Remove legacy index that depends on record_type (if present).
DROP INDEX IF EXISTS public.idx_body_measurements_inbody_json_unique;

-- Ensure one active InBody record per user and measured_at.
CREATE UNIQUE INDEX IF NOT EXISTS idx_body_measurements_user_measured_at_unique
ON public.body_measurements(user_id, measured_at)
WHERE deleted_at IS NULL;

-- Legacy scalar columns are no longer needed after JSONB migration.
ALTER TABLE public.body_measurements
  DROP COLUMN IF EXISTS metric_key,
  DROP COLUMN IF EXISTS value,
  DROP COLUMN IF EXISTS unit,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS record_type;

-- Keep metrics_json as primary payload.
ALTER TABLE public.body_measurements
  ALTER COLUMN metrics_json SET NOT NULL,
  ALTER COLUMN metrics_json SET DEFAULT '{}'::jsonb;

-- Drop obsolete index from scalar model.
DROP INDEX IF EXISTS public.idx_body_measurements_metric_key;
