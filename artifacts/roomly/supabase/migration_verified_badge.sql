-- ============================================================
-- MIGRATION: Auto-sync verification_badge from email + phone
-- Run this in Supabase SQL Editor
-- ============================================================

-- Function: sets verification_badge = 'Geverifieerd' only when
-- BOTH email_auto_verified AND phone_verified are true, otherwise NULL.
CREATE OR REPLACE FUNCTION public.sync_verification_badge()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email_auto_verified = TRUE AND NEW.phone_verified = TRUE THEN
    NEW.verification_badge := 'Geverifieerd';
  ELSE
    NEW.verification_badge := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: fires before INSERT or UPDATE of either verification column
DROP TRIGGER IF EXISTS sync_verification_badge_trigger ON public.profiles;
CREATE TRIGGER sync_verification_badge_trigger
  BEFORE INSERT OR UPDATE OF email_auto_verified, phone_verified ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_verification_badge();

-- Backfill all existing rows to enforce the new rule
UPDATE public.profiles
SET verification_badge = CASE
  WHEN email_auto_verified = TRUE AND phone_verified = TRUE THEN 'Geverifieerd'
  ELSE NULL
END;
