-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Moderation & admin tooling — Welkthuis.nl
-- Idempotent — safe to re-run in the Supabase SQL Editor.
--
-- What this adds:
--   1. listings.hidden / hidden_reason         (soft-hide by admin)
--   2. profiles.suspended_until / ban_reason   (suspension / permanent ban)
--   3. listing_reports: status + resolution fields
--   4. user_reports:    status + resolution fields
--   5. conversation_reports table (new)
--   6. Performance indexes
--   7. RPCs: submit_report, admin_hide/unhide_listing, admin_suspend/ban/unsuspend_user,
--            admin_resolve_*_report, admin_inspect_conversation
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extend listings: soft-hide support ────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS hidden         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_reason  TEXT;

-- ── 2. Extend profiles: suspension / ban ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason       TEXT;

-- ── 3. Extend listing_reports: resolution tracking ───────────────────────────
ALTER TABLE public.listing_reports
  ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note  TEXT;

DO $$
BEGIN
  ALTER TABLE public.listing_reports
    ADD CONSTRAINT listing_reports_status_check
    CHECK (status IN ('pending', 'resolved', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Extend user_reports: resolution tracking ──────────────────────────────
ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note  TEXT;

DO $$
BEGIN
  ALTER TABLE public.user_reports
    ADD CONSTRAINT user_reports_status_check
    CHECK (status IN ('pending', 'resolved', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. New: conversation_reports ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('scam','fake_listing','spam','harassment','inappropriate','duplicate','other')),
  reason          TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reporter_id, conversation_id)
);

ALTER TABLE public.conversation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_reports_insert_own"    ON public.conversation_reports;
CREATE POLICY "conv_reports_insert_own"
  ON public.conversation_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "conv_reports_admin_select"  ON public.conversation_reports;
CREATE POLICY "conv_reports_admin_select"
  ON public.conversation_reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "conv_reports_admin_update"  ON public.conversation_reports;
CREATE POLICY "conv_reports_admin_update"
  ON public.conversation_reports FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ── 6. Performance indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listing_reports_status
  ON public.listing_reports (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_user_reports_status
  ON public.user_reports (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_conv_reports_status
  ON public.conversation_reports (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_listings_hidden
  ON public.listings (hidden) WHERE hidden = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_suspended
  ON public.profiles (suspended_until) WHERE suspended_until IS NOT NULL;

-- ── 7a. RPC: submit_report (unified, rate-limited) ────────────────────────────
-- Handles listing, user, and conversation reports.
-- Rate limit: max 5 reports per user per 60 minutes.
CREATE OR REPLACE FUNCTION public.submit_report(
  p_target_type TEXT,
  p_target_id   UUID,
  p_category    TEXT,
  p_reason      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count   INT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  IF p_target_type NOT IN ('listing','user','conversation') THEN
    RAISE EXCEPTION 'INVALID_TARGET_TYPE';
  END IF;
  IF p_category NOT IN ('scam','fake_listing','spam','harassment','inappropriate','duplicate','other') THEN
    RAISE EXCEPTION 'INVALID_CATEGORY';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' OR char_length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Rate limit: max 5 reports per hour across all types
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.listing_reports
              WHERE reporter_id = v_user_id AND created_at > NOW() - INTERVAL '1 hour'), 0)
  + COALESCE((SELECT COUNT(*) FROM public.user_reports
              WHERE reporter_id = v_user_id AND reason <> 'blocked'
                AND created_at > NOW() - INTERVAL '1 hour'), 0)
  + COALESCE((SELECT COUNT(*) FROM public.conversation_reports
              WHERE reporter_id = v_user_id AND created_at > NOW() - INTERVAL '1 hour'), 0)
  INTO v_count;

  IF v_count >= 5 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;

  IF p_target_type = 'listing' THEN
    BEGIN
      INSERT INTO public.listing_reports (listing_id, reporter_id, reason, category)
      VALUES (p_target_id, v_user_id, trim(p_reason), p_category);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'DUPLICATE_REPORT';
    END;

  ELSIF p_target_type = 'user' THEN
    IF p_target_id = v_user_id THEN RAISE EXCEPTION 'INVALID_DATA'; END IF;
    INSERT INTO public.user_reports (reporter_id, reported_id, reason)
    VALUES (v_user_id, p_target_id, p_category || ': ' || trim(p_reason));

  ELSIF p_target_type = 'conversation' THEN
    BEGIN
      INSERT INTO public.conversation_reports (reporter_id, conversation_id, category, reason)
      VALUES (v_user_id, p_target_id, p_category, trim(p_reason));
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'DUPLICATE_REPORT';
    END;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_report(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ── 7b. RPC: admin_hide_listing ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_hide_listing(
  p_listing_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.listings SET hidden = TRUE, hidden_reason = p_reason WHERE id = p_listing_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'hide_listing', 'listing', p_listing_id,
    jsonb_build_object('reason', p_reason));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_hide_listing(UUID, TEXT) TO authenticated;

-- ── 7c. RPC: admin_unhide_listing ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unhide_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.listings SET hidden = FALSE, hidden_reason = NULL WHERE id = p_listing_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'unhide_listing', 'listing', p_listing_id, NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unhide_listing(UUID) TO authenticated;

-- ── 7d. RPC: admin_suspend_user ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id UUID,
  p_days    INT DEFAULT 7,
  p_reason  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'CANNOT_SUSPEND_ADMIN';
  END IF;
  UPDATE public.profiles
    SET suspended_until = NOW() + (p_days || ' days')::INTERVAL,
        ban_reason = p_reason
  WHERE id = p_user_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'suspend_user', 'user', p_user_id,
    jsonb_build_object('days', p_days, 'reason', p_reason));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(UUID, INT, TEXT) TO authenticated;

-- ── 7e. RPC: admin_ban_user ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'CANNOT_BAN_ADMIN';
  END IF;
  UPDATE public.profiles
    SET suspended_until = '9999-12-31 23:59:59+00'::TIMESTAMPTZ,
        ban_reason = p_reason
  WHERE id = p_user_id;
  UPDATE public.listings
    SET hidden = TRUE, hidden_reason = 'Eigenaar verbannen'
  WHERE user_id = p_user_id AND hidden = FALSE;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'ban_user', 'user', p_user_id,
    jsonb_build_object('reason', p_reason));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID, TEXT) TO authenticated;

-- ── 7f. RPC: admin_unsuspend_user ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.profiles SET suspended_until = NULL, ban_reason = NULL WHERE id = p_user_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'unsuspend_user', 'user', p_user_id, NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_user(UUID) TO authenticated;

-- ── 7g. RPC: admin_resolve_listing_report ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_listing_report(
  p_report_id UUID,
  p_status    TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF p_status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.listing_reports
    SET status = p_status, resolved_by = auth.uid(), resolved_at = NOW(), resolution_note = p_note
  WHERE id = p_report_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'resolve_listing_report', 'listing_report', p_report_id,
    jsonb_build_object('status', p_status, 'note', p_note));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resolve_listing_report(UUID, TEXT, TEXT) TO authenticated;

-- ── 7h. RPC: admin_resolve_user_report ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_user_report(
  p_report_id UUID,
  p_status    TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF p_status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.user_reports
    SET status = p_status, resolved_by = auth.uid(), resolved_at = NOW(), resolution_note = p_note
  WHERE id = p_report_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'resolve_user_report', 'user_report', p_report_id,
    jsonb_build_object('status', p_status, 'note', p_note));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resolve_user_report(UUID, TEXT, TEXT) TO authenticated;

-- ── 7i. RPC: admin_resolve_conversation_report ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_conversation_report(
  p_report_id UUID,
  p_status    TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF p_status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.conversation_reports
    SET status = p_status, resolved_by = auth.uid(), resolved_at = NOW(), resolution_note = p_note
  WHERE id = p_report_id;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'resolve_conversation_report', 'conversation_report', p_report_id,
    jsonb_build_object('status', p_status, 'note', p_note));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resolve_conversation_report(UUID, TEXT, TEXT) TO authenticated;

-- ── 7j. RPC: admin_inspect_conversation ──────────────────────────────────────
-- Returns up to 100 messages for a reported conversation (admin only).
-- Every call is logged for audit purposes.
CREATE OR REPLACE FUNCTION public.admin_inspect_conversation(p_conversation_id UUID)
RETURNS TABLE (
  id          UUID,
  sender_id   UUID,
  sender_name TEXT,
  body        TEXT,
  created_at  TIMESTAMPTZ,
  read_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'inspect_conversation', 'conversation', p_conversation_id, NULL);
  RETURN QUERY
    SELECT m.id, m.sender_id,
           COALESCE(p.name, p.email, 'Onbekend')::TEXT AS sender_name,
           m.body, m.created_at, m.read_at
    FROM   public.messages m
    LEFT JOIN public.profiles p ON p.id = m.sender_id
    WHERE  m.conversation_id = p_conversation_id
    ORDER  BY m.created_at ASC
    LIMIT  100;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_inspect_conversation(UUID) TO authenticated;
