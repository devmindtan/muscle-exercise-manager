-- ============================================================
-- PROFILES — public-facing profile data (display name, avatar, bio, privacy)
-- Additive: bảng hoàn toàn mới, không đụng tới bảng/dữ liệu hiện có.
--
-- LƯU Ý QUAN TRỌNG (khác các bảng nutrition/workout_plans khác):
-- Đây là bảng ĐẦU TIÊN cho phép người dùng khác SELECT được (cần cho
-- tính năng tìm bạn / khám phá ở Phase 4). Vui lòng tự review kỹ policy
-- SELECT bên dưới trước khi chạy — INSERT/UPDATE/DELETE vẫn chỉ giới
-- hạn cho chủ sở hữu.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id            text        PRIMARY KEY,
  display_name  text,
  avatar_url    text,
  bio           text,
  is_private    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  sync_status   text                 DEFAULT 'pending',
  user_id       uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- Any authenticated user can look up basic profile info (needed for
-- friend search / viewing a friend's shared plan owner). This is the
-- deliberate exception to the "owner-only" pattern used everywhere else.
DROP POLICY IF EXISTS "Any authenticated user can view profiles" ON public.profiles;
CREATE POLICY "Any authenticated user can view profiles"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile"
  ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
