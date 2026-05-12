-- ============================================================
-- MIGRATION: Boost Credits v2 — production-grade improvements
-- Run in Supabase SQL Editor AFTER migration_security_hardening.sql
-- ============================================================

-- ── STEP 1: Remove boosted boolean from listings ─────────────
-- Active boost status is now derived:
--   boosted_at IS NOT NULL AND boosted_at > NOW() - INTERVAL '1 hour'
-- Drop the column and any dependent index that referenced it.

DROP INDEX IF EXISTS public.idx_listings_boosted_created;
DROP INDEX IF EXISTS public.idx_listings_boosted_at_created;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS boosted;

-- ── STEP 2: Add credit_before / credit_after to boost_logs ───
ALTER TABLE public.boost_logs
  ADD COLUMN IF NOT EXISTS credit_before INT,
  ADD COLUMN IF NOT EXISTS credit_after  INT;

-- ── STEP 3: Rebuild ordering index on boosted_at ─────────────
-- Listings with a boosted_at within the last hour float to the top.
-- After the hour expires they drop back naturally — no cleanup job needed.
CREATE INDEX IF NOT EXISTS idx_listings_boosted_at_created
  ON public.listings (boosted_at DESC NULLS LAST, created_at DESC);

-- ── STEP 4: Rewrite boost_listing() ──────────────────────────
-- Changes vs. v1:
--   • No longer writes boosted boolean (column removed).
--   • Boost window / cooldown is 1 hour (was 24 h).
--   • boost_logs INSERT now records credit_before and credit_after.
--   • Entire body already executes inside one implicit transaction
--     (PL/pgSQL functions are atomic); SELECT … FOR UPDATE on both
--     rows in a fixed order prevents deadlocks.
CREATE OR REPLACE FUNCTION public.boost_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id      UUID        := auth.uid();
  v_credits      INT;
  v_owner_id     UUID;
  v_boosted_at   TIMESTAMPTZ;
  BOOST_WINDOW   CONSTANT    INTERVAL := INTERVAL '1 hour';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── Lock order 1: profiles (always first → no deadlocks) ──────────────
  SELECT boost_credits
    INTO v_credits
    FROM public.profiles
   WHERE id = v_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- ── Lock order 2: listings (always second) ─────────────────────────────
  SELECT user_id, boosted_at
    INTO v_owner_id, v_boosted_at
    FROM public.listings
   WHERE id = p_listing_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LISTING_NOT_FOUND';
  END IF;

  IF v_owner_id <> v_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF v_credits < 1 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- A boost is active for 1 hour. Block re-boost while one is still active.
  IF v_boosted_at IS NOT NULL AND v_boosted_at > NOW() - BOOST_WINDOW THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE';
  END IF;

  -- ── Deduct credit atomically ───────────────────────────────────────────
  UPDATE public.profiles
     SET boost_credits = boost_credits - 1,
         last_boost_at = NOW()
   WHERE id = v_user_id;

  -- ── Stamp listing with fresh boost timestamp ───────────────────────────
  -- Active status is derived client-side and in queries as:
  --   boosted_at IS NOT NULL AND boosted_at > NOW() - INTERVAL '1 hour'
  UPDATE public.listings
     SET boosted_at = NOW()
   WHERE id = p_listing_id;

  -- ── Audit row with full credit snapshot ───────────────────────────────
  -- If this INSERT fails the whole transaction rolls back automatically.
  INSERT INTO public.boost_logs
    (user_id, listing_id, action, credits_used, credit_before, credit_after)
  VALUES
    (v_user_id, p_listing_id, 'boost', 1, v_credits, v_credits - 1);
END;
$$;

-- Re-grant execute (idempotent — safe to run again)
GRANT EXECUTE ON FUNCTION public.boost_listing(UUID) TO authenticated;
