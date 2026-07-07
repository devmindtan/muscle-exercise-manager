-- ============================================================
-- TIGHTEN LEGACY RLS POLICIES — muscle_groups, exercises, workout_logs
--
-- The policies created in 20260511200000_add_sync_columns.sql predate
-- multi-user/social features and have two problems:
--   1. `user_id IS NULL OR user_id = auth.uid()` bypasses ownership checks
--      entirely for any row where user_id is NULL.
--   2. No `TO authenticated` clause — policies default to role `public`,
--      so even an unauthenticated request (anon key only) could match
--      rows with user_id = NULL.
--
-- No legitimate app flow ever writes user_id = NULL to these tables:
-- every write path (native + web) attaches the authenticated user's id,
-- and guest mode never pushes to Supabase at all. Safe to remove the
-- bypass — this brings these 3 tables in line with the stricter pattern
-- already used by body_measurements/muscle_goals since 20260523100000.
-- ============================================================

DROP POLICY IF EXISTS "mg_select" ON muscle_groups;
DROP POLICY IF EXISTS "mg_insert" ON muscle_groups;
DROP POLICY IF EXISTS "mg_update" ON muscle_groups;
DROP POLICY IF EXISTS "mg_delete" ON muscle_groups;

CREATE POLICY "Users can manage their own muscle groups"
  ON muscle_groups
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ex_select" ON exercises;
DROP POLICY IF EXISTS "ex_insert" ON exercises;
DROP POLICY IF EXISTS "ex_update" ON exercises;
DROP POLICY IF EXISTS "ex_delete" ON exercises;

CREATE POLICY "Users can manage their own exercises"
  ON exercises
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "wl_select" ON workout_logs;
DROP POLICY IF EXISTS "wl_insert" ON workout_logs;
DROP POLICY IF EXISTS "wl_update" ON workout_logs;
DROP POLICY IF EXISTS "wl_delete" ON workout_logs;

CREATE POLICY "Users can manage their own workout logs"
  ON workout_logs
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
