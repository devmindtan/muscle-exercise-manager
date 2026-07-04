-- ============================================================
-- MULTI-PLAN SUPPORT — workout_plans + weekly_plan_entries.plan_id
-- Additive: không xoá/sửa dữ liệu cũ. weekly_plan_entries.plan_id
-- là cột nullable mới; các dòng cũ được backfill vào 1 plan mặc định
-- tên "Kế hoạch của tôi" ngay trong migration này.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_plans (
  id           text        PRIMARY KEY,
  name         text        NOT NULL,
  is_active    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  sync_status  text                 DEFAULT 'pending',
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id
  ON public.workout_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_workout_plans_updated_at
  ON public.workout_plans(updated_at);

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_workout_plans_updated_at ON public.workout_plans;
CREATE TRIGGER trg_workout_plans_updated_at
  BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own workout plans" ON public.workout_plans;
CREATE POLICY "Users can manage their own workout plans"
  ON public.workout_plans
  FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- weekly_plan_entries.plan_id — nullable FK, additive column.
-- ------------------------------------------------------------
ALTER TABLE public.weekly_plan_entries
  ADD COLUMN IF NOT EXISTS plan_id text REFERENCES public.workout_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_plan_entries_plan_id
  ON public.weekly_plan_entries(plan_id);

-- ------------------------------------------------------------
-- Backfill: mỗi user có weekly_plan_entries chưa gán plan_id sẽ
-- được tạo 1 workout_plans "Kế hoạch của tôi" và gán vào đó.
-- Idempotent — chỉ chạy cho các dòng còn plan_id IS NULL.
-- ------------------------------------------------------------
DO $$
DECLARE
  affected_user RECORD;
  new_plan_id text;
BEGIN
  FOR affected_user IN
    SELECT DISTINCT user_id FROM public.weekly_plan_entries
    WHERE plan_id IS NULL AND user_id IS NOT NULL
  LOOP
    new_plan_id := gen_random_uuid()::text;

    INSERT INTO public.workout_plans (id, user_id, name, is_active, sync_status)
    VALUES (new_plan_id, affected_user.user_id, 'Kế hoạch của tôi', true, 'synced');

    UPDATE public.weekly_plan_entries
    SET plan_id = new_plan_id
    WHERE user_id = affected_user.user_id AND plan_id IS NULL;
  END LOOP;
END $$;
