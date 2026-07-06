-- ============================================================
-- EXERCISE VARIANTS + EXERCISE-LEVEL PLANNING + PUBLIC PLAN SHARES
-- Additive: 3 cột mới (nullable / default false) trên bảng đã có,
-- không đổi ý nghĩa dữ liệu cũ. Không có bảng mới.
--
-- 1. exercises.parent_exercise_id — biến thể bài tập, tự tham chiếu,
--    1 cấp lồng duy nhất (không ép ràng buộc DB, kiểm soát ở app layer
--    để đơn giản cho 1 dev duy nhất maintain).
-- 2. weekly_plan_entries.exercise_id — kế hoạch có thể chọn bài tập cụ
--    thể (hoặc biến thể) thay vì chỉ nhóm cơ. NULL = giữ nguyên hành vi
--    cũ (chỉ theo nhóm cơ).
-- 3. plan_shares.is_public — chia sẻ công khai, ai cũng thấy trong danh
--    sách mà không cần biết mã trước.
--
-- get_shared_plan() phải DROP rồi CREATE lại vì đổi số cột trả về
-- (CREATE OR REPLACE không cho đổi return type). Đây vẫn là điểm nhạy
-- cảm bảo mật nhất — SECURITY DEFINER, đọc chéo dữ liệu user khác.
-- Hành vi phân quyền cũ (link/friends) giữ nguyên, chỉ thêm nhánh
-- is_public để bỏ qua kiểm tra bạn bè khi share đã được chủ đánh dấu
-- công khai. list_public_plan_shares() là function mới, chỉ trả về
-- share_code + tên kế hoạch + tên tác giả (không lộ owner_id/plan_id
-- thật) cho các share có is_public = true.
-- ============================================================

-- ------------------------------------------------------------
-- 1. exercises.parent_exercise_id
-- ------------------------------------------------------------
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS parent_exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_parent_exercise_id ON public.exercises(parent_exercise_id);

-- ------------------------------------------------------------
-- 2. weekly_plan_entries.exercise_id
-- ------------------------------------------------------------
ALTER TABLE public.weekly_plan_entries
  ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_plan_entries_exercise_id ON public.weekly_plan_entries(exercise_id);

-- ------------------------------------------------------------
-- 3. plan_shares.is_public
-- ------------------------------------------------------------
ALTER TABLE public.plan_shares
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_plan_shares_is_public ON public.plan_shares(is_public) WHERE is_public = true;

-- ------------------------------------------------------------
-- 4. get_shared_plan() — mở rộng để mang theo bài tập/biến thể/ảnh
--    + tên tác giả (bắt buộc, không có cờ ẩn). Public share bỏ qua
--    kiểm tra bạn bè bất kể người gọi có qua danh sách khám phá hay
--    tự nhập mã.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_shared_plan(text);

CREATE FUNCTION public.get_shared_plan(p_share_code text)
RETURNS TABLE (
  plan_name text,
  day_key text,
  muscle_group_name text,
  muscle_group_category text,
  muscle_group_color text,
  sets integer,
  note text,
  exercise_name text,
  exercise_notes text,
  exercise_image_uri text,
  parent_exercise_name text,
  owner_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share record;
  v_is_friend boolean;
BEGIN
  SELECT * INTO v_share
  FROM public.plan_shares
  WHERE share_code = p_share_code AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share code not found or revoked';
  END IF;

  IF NOT v_share.is_public AND v_share.visibility = 'friends' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted' AND f.deleted_at IS NULL
        AND ((f.requester_id = auth.uid() AND f.addressee_id = v_share.owner_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = v_share.owner_id))
    ) INTO v_is_friend;

    IF NOT COALESCE(v_is_friend, false) THEN
      RAISE EXCEPTION 'Not authorized to view this shared plan';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    wp.name, wpe.day_key, mg.name, mg.category, mg.color, wpe.sets, wpe.note,
    e.name, e.notes, e.image_uri,
    pe.name,
    COALESCE(pr.display_name, 'Người dùng')
  FROM public.weekly_plan_entries wpe
  JOIN public.workout_plans wp ON wp.id = wpe.plan_id
  JOIN public.muscle_groups mg ON mg.id = wpe.muscle_group_id
  LEFT JOIN public.exercises e ON e.id = wpe.exercise_id
  LEFT JOIN public.exercises pe ON pe.id = e.parent_exercise_id
  LEFT JOIN public.profiles pr ON pr.user_id = v_share.owner_id
  WHERE wpe.plan_id = v_share.plan_id AND wpe.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_plan(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_plan(text) TO authenticated;

-- ------------------------------------------------------------
-- 5. list_public_plan_shares() — danh sách khám phá, không cần mã.
--    Chỉ trả share_code (không phải plan_id/owner_id thật) — chi tiết
--    đầy đủ vẫn phải đi qua get_shared_plan(share_code) như bình thường,
--    giữ đúng nguyên tắc chỉ 1 chỗ kiểm soát quyền đọc chéo user.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_public_plan_shares()
RETURNS TABLE (
  share_code text,
  plan_name text,
  owner_display_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ps.share_code, wp.name, COALESCE(pr.display_name, 'Người dùng'), ps.created_at
  FROM public.plan_shares ps
  JOIN public.workout_plans wp ON wp.id = ps.plan_id AND wp.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.user_id = ps.owner_id
  WHERE ps.is_public = true AND ps.deleted_at IS NULL
  ORDER BY ps.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_plan_shares() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_plan_shares() TO authenticated;
