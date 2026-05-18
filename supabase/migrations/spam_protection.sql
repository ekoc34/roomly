-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Spam & Abuse Protection — Welkthuis.nl
-- Idempotent — safe to re-run in the Supabase SQL Editor.
--
-- What this adds:
--   1. security_events   — audit log for every blocked/flagged action
--   2. auto_flags        — shadow-moderation flags on content/users
--   3. log_security_event     RPC  (authenticated, fire-and-forget logging)
--   4. auto_flag_content      RPC  (authenticated, idempotent shadow flag)
--   5. check_listing_allowed  RPC  (rate-limit + duplicate guard)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. security_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.security_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
    -- 'rate_limit' | 'spam_blocked' | 'auto_flag' | 'duplicate' | 'auth_limit'
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type TEXT,            -- 'message' | 'listing' | 'auth' | 'report'
  target_id   UUID,
  trigger     TEXT NOT NULL DEFAULT 'unknown',
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_events_user    ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sec_events_type    ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sec_events_created ON public.security_events(created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sec_events_admin_select" ON public.security_events;
CREATE POLICY "sec_events_admin_select"
  ON public.security_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ── 2. auto_flags ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auto_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL,   -- 'listing' | 'user' | 'conversation'
  target_id    UUID,
  trigger_type TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'low'
    CHECK (severity IN ('low', 'medium', 'high')),
  reason       TEXT NOT NULL DEFAULT '',
  details      JSONB,
  dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_flags_target   ON public.auto_flags(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_auto_flags_pending  ON public.auto_flags(dismissed) WHERE dismissed = FALSE;
CREATE INDEX IF NOT EXISTS idx_auto_flags_created  ON public.auto_flags(created_at DESC);

ALTER TABLE public.auto_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_flags_admin_select" ON public.auto_flags;
CREATE POLICY "auto_flags_admin_select"
  ON public.auto_flags FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "auto_flags_admin_update" ON public.auto_flags;
CREATE POLICY "auto_flags_admin_update"
  ON public.auto_flags FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ── 3. RPC: log_security_event ────────────────────────────────────────────────
-- Fire-and-forget logging called from authenticated client code.
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type  TEXT,
  p_target_type TEXT    DEFAULT NULL,
  p_target_id   UUID    DEFAULT NULL,
  p_trigger     TEXT    DEFAULT 'unknown',
  p_details     JSONB   DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_events
    (event_type, user_id, target_type, target_id, trigger, details)
  VALUES
    (p_event_type, auth.uid(), p_target_type, p_target_id, p_trigger, p_details);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;

-- ── 4. RPC: auto_flag_content ─────────────────────────────────────────────────
-- Idempotent: won't create a duplicate flag for the same target + trigger.
-- Also logs a security_event for each flag.
CREATE OR REPLACE FUNCTION public.auto_flag_content(
  p_target_type  TEXT,
  p_target_id    UUID    DEFAULT NULL,
  p_trigger_type TEXT    DEFAULT 'unknown',
  p_severity     TEXT    DEFAULT 'low',
  p_reason       TEXT    DEFAULT '',
  p_details      JSONB   DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Skip if already flagged for the same reason
  IF p_target_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.auto_flags
    WHERE  target_type  = p_target_type
      AND  target_id    = p_target_id
      AND  trigger_type = p_trigger_type
      AND  dismissed    = FALSE
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.auto_flags
    (target_type, target_id, trigger_type, severity, reason, details)
  VALUES
    (p_target_type, p_target_id, p_trigger_type, p_severity, p_reason, p_details);

  INSERT INTO public.security_events
    (event_type, user_id, target_type, target_id, trigger, details)
  VALUES
    ('auto_flag', auth.uid(), p_target_type, p_target_id, p_trigger_type, p_details);
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_flag_content(TEXT, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ── 5. RPC: check_listing_allowed ─────────────────────────────────────────────
-- Returns { allowed: boolean, reason: text | null }
-- Called client-side before create_listing to enforce rate-limits + duplicates.
CREATE OR REPLACE FUNCTION public.check_listing_allowed(
  p_title    TEXT,
  p_location TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_count_24h INT;
  v_duplicate INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  -- Max 5 new listings per 24 hours per user
  SELECT COUNT(*) INTO v_count_24h
  FROM   public.listings
  WHERE  user_id    = v_user_id
    AND  created_at > NOW() - INTERVAL '24 hours';

  IF v_count_24h >= 5 THEN
    INSERT INTO public.security_events
      (event_type, user_id, target_type, trigger, details)
    VALUES
      ('rate_limit', v_user_id, 'listing', 'listing_rate_24h',
       jsonb_build_object('count', v_count_24h));
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'LISTING_RATE_LIMIT');
  END IF;

  -- Duplicate: same title + same city in the last 7 days
  SELECT COUNT(*) INTO v_duplicate
  FROM   public.listings
  WHERE  user_id          = v_user_id
    AND  lower(trim(title))    = lower(trim(p_title))
    AND  lower(trim(location)) ILIKE lower(trim(p_location)) || '%'
    AND  created_at       > NOW() - INTERVAL '7 days';

  IF v_duplicate >= 1 THEN
    INSERT INTO public.security_events
      (event_type, user_id, target_type, trigger, details)
    VALUES
      ('spam_blocked', v_user_id, 'listing', 'duplicate_listing',
       jsonb_build_object('title', left(p_title, 80), 'location', p_location));

    INSERT INTO public.auto_flags
      (target_type, trigger_type, severity, reason, details)
    VALUES
      ('user', 'duplicate_listing', 'medium',
       'Gebruiker probeerde een duplicaat advertentie te plaatsen',
       jsonb_build_object('title', left(p_title, 80), 'location', p_location, 'user_id', v_user_id::TEXT));

    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'DUPLICATE_LISTING');
  END IF;

  RETURN jsonb_build_object('allowed', TRUE, 'reason', NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_listing_allowed(TEXT, TEXT) TO authenticated;
