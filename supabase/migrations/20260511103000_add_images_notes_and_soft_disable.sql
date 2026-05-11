/*
  # Add image support, exercise soft-disable, and workout notes

  1. muscle_groups
    - add image_uri (text, nullable)

  2. exercises
    - add image_uri (text, nullable)
    - add is_active (boolean, default true)

  3. workout_logs
    - add note (text, nullable)
*/

ALTER TABLE muscle_groups
  ADD COLUMN IF NOT EXISTS image_uri text;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS image_uri text;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS note text;

CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group_active
  ON exercises(muscle_group_id, is_active);
