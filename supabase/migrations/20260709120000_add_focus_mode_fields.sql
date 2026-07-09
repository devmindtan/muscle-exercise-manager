-- ============================================================
-- FOCUS MODE FIELDS: target reps + sort order for plan entries,
-- rest/prep default seconds for exercises.
-- Additive only — all columns nullable, no change to existing data.
--
-- 1. weekly_plan_entries.reps — target reps for a specific exercise
--    entry (meaningless/unused when exercise_id IS NULL, enforced at
--    app layer only, same philosophy as parent_exercise_id).
-- 2. weekly_plan_entries.sort_order — explicit execution order for
--    Focus Mode (and display). created_at cannot be used for this:
--    entries created in the same batch share one timestamp (see
--    upsertWeeklyPlanEntries), so there was never a reliable order.
-- 3. exercises.rest_seconds / exercises.prep_seconds — default rest
--    (between sets of the same exercise) and prep (when moving to
--    the next exercise) timer durations for Focus Mode, reusable
--    across every plan. Nullable — UI falls back to a sane default
--    (90s / 120s) when unset.
-- ============================================================

ALTER TABLE public.weekly_plan_entries
  ADD COLUMN IF NOT EXISTS reps integer,
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS rest_seconds integer,
  ADD COLUMN IF NOT EXISTS prep_seconds integer;
