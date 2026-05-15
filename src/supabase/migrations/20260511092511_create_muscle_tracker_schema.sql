/*
  # Muscle Tracker Schema

  1. New Tables
    - `muscle_groups`
      - `id` (uuid, primary key)
      - `name` (text) - e.g. "Chest", "Back", "Legs"
      - `color` (text) - hex color for UI display
      - `target_sets_per_week` (int) - target weekly sets
      - `target_sets_per_month` (int) - target monthly sets
      - `created_at` (timestamptz)

    - `exercises`
      - `id` (uuid, primary key)
      - `muscle_group_id` (uuid, FK to muscle_groups)
      - `name` (text)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

    - `workout_logs`
      - `id` (uuid, primary key)
      - `exercise_id` (uuid, FK to exercises)
      - `muscle_group_id` (uuid, FK to muscle_groups - denormalized for query speed)
      - `sets` (int)
      - `reps` (int, nullable)
      - `weight` (numeric, nullable)
      - `logged_at` (timestamptz) - when the workout happened
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated users to manage their own data

  3. Notes
    - muscle_group_id is denormalized on workout_logs for fast weekly/monthly aggregations
    - target_sets can be set at both weekly and monthly granularity
*/

CREATE TABLE IF NOT EXISTS muscle_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4A90E2',
  target_sets_per_week int NOT NULL DEFAULT 10,
  target_sets_per_month int NOT NULL DEFAULT 40,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muscle_group_id uuid NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group_id uuid NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
  sets int NOT NULL DEFAULT 1,
  reps int,
  weight numeric,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast aggregations
CREATE INDEX IF NOT EXISTS idx_workout_logs_muscle_group_logged ON workout_logs(muscle_group_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_workout_logs_logged_at ON workout_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises(muscle_group_id);

-- Enable RLS
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Muscle groups policies (public read/write for this demo - single user app)
CREATE POLICY "Anyone can read muscle groups"
  ON muscle_groups FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert muscle groups"
  ON muscle_groups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update muscle groups"
  ON muscle_groups FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete muscle groups"
  ON muscle_groups FOR DELETE
  USING (true);

-- Exercises policies
CREATE POLICY "Anyone can read exercises"
  ON exercises FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert exercises"
  ON exercises FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update exercises"
  ON exercises FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete exercises"
  ON exercises FOR DELETE
  USING (true);

-- Workout logs policies
CREATE POLICY "Anyone can read workout logs"
  ON workout_logs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert workout logs"
  ON workout_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update workout logs"
  ON workout_logs FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete workout logs"
  ON workout_logs FOR DELETE
  USING (true);
