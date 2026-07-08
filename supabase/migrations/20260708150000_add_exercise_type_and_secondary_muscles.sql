-- ============================================================
-- EXERCISE TYPE (compound/isolation) + SECONDARY MUSCLE GROUPS
-- Additive: 1 cột mới (nullable) trên exercises + 1 bảng junction mới.
-- Không đổi hành vi/dữ liệu cũ — bài tập hiện có giữ exercise_type NULL
-- cho tới khi người dùng tự phân loại lại.
--
-- 1. exercises.exercise_type — 'compound' | 'isolation', kiểm soát hợp
--    lệ bằng CHECK, không ép NOT NULL để tránh phá dữ liệu cũ.
-- 2. exercise_secondary_muscles — nhóm cơ phụ mà 1 bài Compound tác
--    động tới, ngoài nhóm cơ chính (exercises.muscle_group_id). Bảng
--    junction đơn giản, không cần sync_status/dirty phức tạp — ghi đè
--    toàn bộ (xoá hết + insert lại) mỗi khi lưu, theo đúng triết lý
--    "đơn giản cho 1 dev duy nhất maintain" đã dùng ở migration biến
--    thể bài tập (20260706100000).
-- ============================================================

-- ------------------------------------------------------------
-- 1. exercises.exercise_type
-- ------------------------------------------------------------
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS exercise_type text CHECK (exercise_type IN ('compound', 'isolation'));

-- ------------------------------------------------------------
-- 2. exercise_secondary_muscles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_secondary_muscles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  muscle_group_id uuid NOT NULL REFERENCES public.muscle_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, muscle_group_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_secondary_muscles_exercise_id
  ON public.exercise_secondary_muscles(exercise_id);

ALTER TABLE public.exercise_secondary_muscles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exercise secondary muscles"
  ON public.exercise_secondary_muscles
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
