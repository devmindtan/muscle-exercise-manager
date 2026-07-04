-- ============================================================
-- get_friend_activity_calendar(p_friend_user_id) — daily training volume
-- for an accepted friend (whose profile isn't private), for a GitHub-style
-- contribution heatmap. Same SECURITY DEFINER + authorization pattern as
-- get_shared_plan / get_friend_weekly_overview.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_friend_activity_calendar(p_friend_user_id uuid)
RETURNS TABLE (
  activity_date date,
  total_sets bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_friend boolean;
  v_is_private boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted' AND f.deleted_at IS NULL
      AND ((f.requester_id = auth.uid() AND f.addressee_id = p_friend_user_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = p_friend_user_id))
  ) INTO v_is_friend;

  IF NOT v_is_friend THEN
    RAISE EXCEPTION 'Not friends with this user';
  END IF;

  SELECT COALESCE(p.is_private, false) INTO v_is_private
  FROM public.profiles p WHERE p.user_id = p_friend_user_id;

  IF v_is_private THEN
    RAISE EXCEPTION 'This profile is private';
  END IF;

  RETURN QUERY
  SELECT
    wl.logged_at::date AS activity_date,
    SUM(wl.sets) AS total_sets
  FROM public.workout_logs wl
  WHERE wl.user_id = p_friend_user_id
    AND wl.deleted_at IS NULL
    AND wl.logged_at >= (now() - interval '371 days')
  GROUP BY wl.logged_at::date
  ORDER BY activity_date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_friend_activity_calendar(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_friend_activity_calendar(uuid) TO authenticated;
