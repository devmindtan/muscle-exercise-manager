CREATE TABLE IF NOT EXISTS public.cardio_logs (
  id text PRIMARY KEY,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  note text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  sync_status text DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cardio_logs_logged_at
ON public.cardio_logs(logged_at);

CREATE INDEX IF NOT EXISTS idx_cardio_logs_updated_at
ON public.cardio_logs(updated_at);

ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cardio_logs_updated_at ON public.cardio_logs;
CREATE TRIGGER trg_cardio_logs_updated_at
  BEFORE UPDATE ON public.cardio_logs
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own cardio logs" ON public.cardio_logs;
CREATE POLICY "Users can manage their own cardio logs"
ON public.cardio_logs
FOR ALL
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);