-- ============================================================
-- IMPACT TARGETS + INJURY-PRONE FLAG.
-- Additive only — all columns nullable, no change to existing data.
--
-- 1. muscle_groups.target_impact_sets_per_week / _per_month — separate
--    goal from the existing target_sets_per_week/_per_month ("isolation"
--    target: sets logged directly against this muscle group, unchanged
--    behavior). "Impact" target additionally counts sets from compound
--    exercises that list this muscle group as a secondary muscle
--    (exercise_secondary_muscles). Nullable — app falls back to the
--    isolation target when unset, same philosophy as rest_seconds/
--    prep_seconds in 20260709120000.
-- 2. exercises.is_injury_prone — user-set warning flag, display-only
--    (no behavior change elsewhere).
-- ============================================================

ALTER TABLE public.muscle_groups
  ADD COLUMN IF NOT EXISTS target_impact_sets_per_week integer,
  ADD COLUMN IF NOT EXISTS target_impact_sets_per_month integer;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_injury_prone boolean;
