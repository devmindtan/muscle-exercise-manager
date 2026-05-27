-- Create weekly_plan_entries table for planning-only schedule sync.
-- This table is informational and does not enforce workout behavior.

CREATE TABLE IF NOT EXISTS public.weekly_plan_entries (
  id text PRIMARY KEY,
  day_key text NOT NULL,
  muscle_group_id uuid NOT NULL REFERENCES public.muscle_groups(id) ON DELETE CASCADE,
  sets integer NOT NULL CHECK (sets > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  sync_status text DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_entries_day_key
ON public.weekly_plan_entries(day_key);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_entries_muscle_group_id
ON public.weekly_plan_entries(muscle_group_id);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_entries_updated_at
ON public.weekly_plan_entries(updated_at);

ALTER TABLE public.weekly_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weekly_plan_entries_updated_at ON public.weekly_plan_entries;
CREATE TRIGGER trg_weekly_plan_entries_updated_at
  BEFORE UPDATE ON public.weekly_plan_entries
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own weekly plan entries" ON public.weekly_plan_entries;
CREATE POLICY "Users can manage their own weekly plan entries"
ON public.weekly_plan_entries
FOR ALL
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
