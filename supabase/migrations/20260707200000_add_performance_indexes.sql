-- ============================================================
-- PERFORMANCE INDEXES + SCHEMA DRIFT CLEANUP
--
-- Phát hiện qua `supabase db dump --schema public` (export schema thật từ
-- production, không có trong bất kỳ migration cũ nào review lại cách này):
--
-- 1. Nhiều bảng thiếu index trên user_id — vì mọi bảng đều bật RLS với
--    policy `auth.uid() = user_id`, MỌI query (kể cả lọc theo cột khác)
--    đều bị lọc thêm theo user_id. Không có index, Postgres phải seq-scan
--    để áp điều kiện này khi bảng lớn dần.
-- 2. workout_logs — bảng lớn nhất, tăng nhanh nhất — hoàn toàn không có
--    index nào bắt đầu bằng user_id, trong khi code thực tế luôn query
--    theo (user_id, logged_at range) và (user_id, updated_at > cutoff)
--    (sync incremental). Đây là composite quan trọng nhất cần thêm.
-- 3. nutrition_logs có index rời user_id + logged_at nhưng code luôn dùng
--    cả 2 cùng lúc (getNutritionLogsForDateRange) — gộp composite hiệu quả
--    hơn 2 index rời phải AND lại.
-- 4. idx_profiles_user_id trùng với UNIQUE constraint profiles_user_id_key
--    (constraint này đã tự tạo index) — xóa để giảm chi phí ghi.
-- 5. get_friend_weekly_overview tồn tại trên production nhưng không có
--    trong migration nào và không được app gọi ở đâu (đã grep xác nhận) —
--    khả năng cao là hàm cũ, tiền thân của get_friend_activity_calendar,
--    bị bỏ lại. Xóa để dọn sạch schema drift.
--
-- Bảng hiện còn nhỏ (workout_logs ~1200 dòng) nên CREATE INDEX thường
-- (không cần CONCURRENTLY) là đủ an toàn, không khóa bảng đáng kể.
-- ============================================================

-- 1. Index user_id còn thiếu
CREATE INDEX IF NOT EXISTS idx_cardio_logs_user_id ON public.cardio_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON public.exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_muscle_goals_user_id ON public.muscle_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_muscle_groups_user_id ON public.muscle_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_entries_user_id ON public.weekly_plan_entries(user_id);

-- 2. Composite cho workout_logs — khớp đúng pattern query thật của app
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id_logged_at
  ON public.workout_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id_updated_at
  ON public.workout_logs(user_id, updated_at);

-- 3. Composite cho nutrition_logs — khớp getNutritionLogsForDateRange
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_id_logged_at
  ON public.nutrition_logs(user_id, logged_at);

-- 4. Xóa index trùng lặp với UNIQUE constraint profiles_user_id_key
DROP INDEX IF EXISTS public.idx_profiles_user_id;

-- 5. Dọn function mồ côi không còn migration/app nào tham chiếu
DROP FUNCTION IF EXISTS public.get_friend_weekly_overview(uuid);
