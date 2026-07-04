-- ============================================================
-- FRIENDSHIPS + PLAN_SHARES — sharing/social feature (Phase 4)
-- Additive: 2 bảng mới + 1 function mới, không đụng bảng cũ.
--
-- ĐÂY LÀ PHẦN CÓ RỦI RO BẢO MẬT CAO NHẤT TRONG TOÀN BỘ UPDATE.
-- Vui lòng tự review kỹ trước khi chạy, đặc biệt là hàm get_shared_plan()
-- ở cuối file — đây là nơi duy nhất một user có thể đọc được dữ liệu
-- (tên nhóm cơ + lịch tập) thuộc về người khác, và chỉ khi:
--   - share_code hợp lệ và chưa bị thu hồi, VÀ
--   - visibility = 'link' (ai có mã cũng xem được), HOẶC
--   - visibility = 'friends' VÀ người gọi đã là bạn bè (status='accepted')
--     với chủ sở hữu.
-- Thiết kế dùng 1 function SECURITY DEFINER thay vì mở rộng RLS trực
-- tiếp trên workout_plans/weekly_plan_entries/muscle_groups — cách này
-- gói toàn bộ logic phân quyền vào 1 chỗ duy nhất, dễ audit hơn là rải
-- điều kiện ở nhiều policy khác nhau. workout_plans/weekly_plan_entries/
-- muscle_groups của một user vẫn KHÔNG lộ ra ngoài theo bất kỳ cách nào khác.
-- ============================================================

-- ------------------------------------------------------------
-- 1. friendships
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id            text        PRIMARY KEY,
  requester_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  sync_status   text                 DEFAULT 'pending',
  CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON public.friendships(addressee_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_friendships_updated_at ON public.friendships;
CREATE TRIGGER trg_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- Either party can see/update the friendship row (accept/decline/unfriend).
DROP POLICY IF EXISTS "Participants can view their friendships" ON public.friendships;
CREATE POLICY "Participants can view their friendships"
  ON public.friendships
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "Requester can create friend requests" ON public.friendships;
CREATE POLICY "Requester can create friend requests"
  ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

DROP POLICY IF EXISTS "Participants can update their friendships" ON public.friendships;
CREATE POLICY "Participants can update their friendships"
  ON public.friendships
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id))
  WITH CHECK ((select auth.uid()) IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "Participants can delete their friendships" ON public.friendships;
CREATE POLICY "Participants can delete their friendships"
  ON public.friendships
  FOR DELETE TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));

-- ------------------------------------------------------------
-- 2. plan_shares — owner-only in RLS. Cross-user reads happen
--    exclusively through get_shared_plan() below, never directly.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_shares (
  id           text        PRIMARY KEY,
  plan_id      text        NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  owner_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code   text        NOT NULL UNIQUE,
  visibility   text        NOT NULL DEFAULT 'link', -- 'link' | 'friends'
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  sync_status  text                 DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_plan_shares_owner_id ON public.plan_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_plan_shares_plan_id ON public.plan_shares(plan_id);

ALTER TABLE public.plan_shares ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_plan_shares_updated_at ON public.plan_shares;
CREATE TRIGGER trg_plan_shares_updated_at
  BEFORE UPDATE ON public.plan_shares
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Owners can manage their own plan shares" ON public.plan_shares;
CREATE POLICY "Owners can manage their own plan shares"
  ON public.plan_shares
  FOR ALL TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- ------------------------------------------------------------
-- 3. get_shared_plan(p_share_code) — the only cross-user read path.
--    SECURITY DEFINER: runs with elevated privilege so it can read the
--    owner's workout_plans/weekly_plan_entries/muscle_groups rows, but
--    does its own authorization check first and returns only the
--    denormalized fields the importer's client needs (never raw IDs
--    belonging to the owner, so there's no FK leakage to build on).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shared_plan(p_share_code text)
RETURNS TABLE (
  plan_name text,
  day_key text,
  muscle_group_name text,
  muscle_group_category text,
  muscle_group_color text,
  sets integer,
  note text
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

  IF v_share.visibility = 'friends' THEN
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
  SELECT wp.name, wpe.day_key, mg.name, mg.category, mg.color, wpe.sets, wpe.note
  FROM public.weekly_plan_entries wpe
  JOIN public.workout_plans wp ON wp.id = wpe.plan_id
  JOIN public.muscle_groups mg ON mg.id = wpe.muscle_group_id
  WHERE wpe.plan_id = v_share.plan_id AND wpe.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_plan(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_plan(text) TO authenticated;
