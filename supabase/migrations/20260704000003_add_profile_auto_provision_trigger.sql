-- ============================================================
-- AUTO-PROVISION PROFILES — trigger + one-time backfill
--
-- Vấn đề: profiles trước đây chỉ được tạo khi chính tài khoản đó mở app
-- và chạy đồng bộ (client-side, trong syncService.ts). Tài khoản đã đăng
-- ký nhưng không mở lại app (hoặc mở trước khi có code auto-provision)
-- sẽ mãi mãi không có profile, không hiện trong "Khám phá".
--
-- Fix: 1 trigger AFTER INSERT trên auth.users, tự tạo profiles ngay khi
-- signup — không phụ thuộc client nữa. Kèm theo backfill 1 lần cho các
-- tài khoản đã tồn tại từ trước.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Người dùng'
  );

  INSERT INTO public.profiles (id, user_id, display_name, avatar_url, bio, is_private)
  VALUES (
    NEW.id::text,
    NEW.id,
    v_display_name,
    NEW.raw_user_meta_data->>'picture',
    NULL,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- One-time backfill for accounts that already existed before this
-- trigger — safe to re-run (ON CONFLICT DO NOTHING).
-- ------------------------------------------------------------
INSERT INTO public.profiles (id, user_id, display_name, avatar_url, bio, is_private)
SELECT
  u.id::text,
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Người dùng'),
  u.raw_user_meta_data->>'picture',
  NULL,
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
