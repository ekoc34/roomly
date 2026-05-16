-- ═════════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-01 — email_auto_verified set server-side only
-- Run in Supabase SQL Editor (fully idempotent — safe to re-run).
--
-- Previously email_auto_verified was written from the client after calling
-- supabase.auth.setSession(), which allowed any authenticated user to mark
-- themselves as verified without actually clicking the confirmation link.
--
-- Fix: a trigger on auth.users fires whenever email_confirmed_at is set (or
-- updated to a non-NULL value) and syncs it to profiles.email_auto_verified.
-- The column is no longer written from application code.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  THEN
    UPDATE public.profiles
    SET email_auto_verified = TRUE
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Attach trigger to auth.users ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_email_verified ON auth.users;

CREATE TRIGGER trg_sync_email_verified
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_email_verified();

-- ── Backfill: mark already-confirmed users ───────────────────────────────────
UPDATE public.profiles p
SET email_auto_verified = TRUE
FROM auth.users u
WHERE p.id = u.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_auto_verified IS DISTINCT FROM TRUE;
