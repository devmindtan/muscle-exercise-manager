-- ============================================================
-- Phase 4+5: Add columns required for multi-device sync
-- ============================================================

-- 1. updated_at — used for incremental pull and conflict resolution
ALTER TABLE muscle_groups  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE exercises      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE workout_logs   ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows
UPDATE muscle_groups SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE exercises     SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE workout_logs  SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. deleted_at — soft-delete flag (hard deletes replaced by setting this)
ALTER TABLE muscle_groups  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE exercises      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE workout_logs   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. user_id — bind data to Supabase Auth user for multi-device isolation
ALTER TABLE muscle_groups  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE exercises      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE workout_logs   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 4. Indexes for efficient incremental sync queries
CREATE INDEX IF NOT EXISTS idx_mg_updated_at  ON muscle_groups(updated_at);
CREATE INDEX IF NOT EXISTS idx_ex_updated_at  ON exercises(updated_at);
CREATE INDEX IF NOT EXISTS idx_wl_updated_at  ON workout_logs(updated_at);

-- 5. Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mg_updated_at ON muscle_groups;
CREATE TRIGGER trg_mg_updated_at
  BEFORE UPDATE ON muscle_groups
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP TRIGGER IF EXISTS trg_ex_updated_at ON exercises;
CREATE TRIGGER trg_ex_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP TRIGGER IF EXISTS trg_wl_updated_at ON workout_logs;
CREATE TRIGGER trg_wl_updated_at
  BEFORE UPDATE ON workout_logs
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- 6. Update RLS policies to scope data per user when authenticated
--    (falls back to open access when user_id IS NULL for anonymous use)
DROP POLICY IF EXISTS "Anyone can read muscle groups"    ON muscle_groups;
DROP POLICY IF EXISTS "Anyone can insert muscle groups"  ON muscle_groups;
DROP POLICY IF EXISTS "Anyone can update muscle groups"  ON muscle_groups;
DROP POLICY IF EXISTS "Anyone can delete muscle groups"  ON muscle_groups;
DROP POLICY IF EXISTS "Anyone can read exercises"        ON exercises;
DROP POLICY IF EXISTS "Anyone can insert exercises"      ON exercises;
DROP POLICY IF EXISTS "Anyone can update exercises"      ON exercises;
DROP POLICY IF EXISTS "Anyone can delete exercises"      ON exercises;
DROP POLICY IF EXISTS "Anyone can read workout logs"     ON workout_logs;
DROP POLICY IF EXISTS "Anyone can insert workout logs"   ON workout_logs;
DROP POLICY IF EXISTS "Anyone can update workout logs"   ON workout_logs;
DROP POLICY IF EXISTS "Anyone can delete workout logs"   ON workout_logs;

-- Muscle groups
CREATE POLICY "mg_select" ON muscle_groups FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "mg_insert" ON muscle_groups FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "mg_update" ON muscle_groups FOR UPDATE
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "mg_delete" ON muscle_groups FOR DELETE
  USING (user_id IS NULL OR user_id = auth.uid());

-- Exercises
CREATE POLICY "ex_select" ON exercises FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "ex_insert" ON exercises FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "ex_update" ON exercises FOR UPDATE
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "ex_delete" ON exercises FOR DELETE
  USING (user_id IS NULL OR user_id = auth.uid());

-- Workout logs
CREATE POLICY "wl_select" ON workout_logs FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "wl_insert" ON workout_logs FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "wl_update" ON workout_logs FOR UPDATE
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "wl_delete" ON workout_logs FOR DELETE
  USING (user_id IS NULL OR user_id = auth.uid());
