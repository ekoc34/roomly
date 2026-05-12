-- ============================================================
-- MIGRATION: Admin Operations Cockpit
-- Run in Supabase SQL Editor AFTER migration_security_hardening.sql
-- ============================================================

-- ── STEP 1: admin_actions — append-only audit log ─────────────
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  target_type TEXT        NOT NULL,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Read-only for admins; no direct writes from any role
CREATE POLICY "Admins can read admin_actions"
  ON public.admin_actions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE INSERT, UPDATE, DELETE ON public.admin_actions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_actions FROM anon;

-- ── STEP 2: log_admin_action() — the only write path ─────────
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action      TEXT,
  p_target_type TEXT,
  p_target_id   TEXT  DEFAULT NULL,
  p_details     JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  INSERT INTO public.admin_actions (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ── STEP 3: admin_set_user_type() ────────────────────────────
-- Allows admins to change any user's user_type.
CREATE OR REPLACE FUNCTION public.admin_set_user_type(p_user_id UUID, p_user_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF p_user_type NOT IN ('verhuurder','huisgenoot_zoeker','student','professional','alleenstaande','family') THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  UPDATE public.profiles
     SET user_type = p_user_type
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_type(UUID, TEXT) TO authenticated;

-- ── STEP 4: admin_boost_listing() ────────────────────────────
-- Admins can boost any listing directly (bypasses ownership + credit check).
CREATE OR REPLACE FUNCTION public.admin_boost_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  UPDATE public.listings
     SET boosted_at = NOW()
   WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LISTING_NOT_FOUND';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_boost_listing(UUID) TO authenticated;

-- ── STEP 5: admin_delete_listing() ───────────────────────────
-- Admins can delete any listing (not restricted to owner).
CREATE OR REPLACE FUNCTION public.admin_delete_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  DELETE FROM public.listings WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LISTING_NOT_FOUND';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_listing(UUID) TO authenticated;

-- ── STEP 6: admin_add_boost_credits already exists ───────────
-- Defined in migration_security_hardening.sql — no change needed.

-- ── STEP 7: Index for fast admin_actions reads ───────────────
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at
  ON public.admin_actions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_actor
  ON public.admin_actions (actor_id);
