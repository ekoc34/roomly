-- ============================================================
-- MIGRATION: Auto badge revocation on scam report threshold
-- Run this in Supabase SQL Editor after schema.sql
-- ============================================================

-- Step 1: Add scam_flagged column to profiles
-- Tracks whether a landlord was ever flagged by the scam threshold.
-- Remains TRUE even after badge is re-earned, as a persistent signal.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scam_flagged BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Extend notifications type check to allow 'badge_revoked'
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_application',
    'application_accepted',
    'application_rejected',
    'new_message',
    'new_matching_listing',
    'badge_revoked'
  ));

-- Step 3: Trigger function — fires after every new listing_reports row
-- Counts scam reports across ALL of the listing owner's listings.
-- When the count reaches 3 or more:
--   • Revokes email_auto_verified and phone_verified (badge follows via sync trigger)
--   • Sets scam_flagged = TRUE on the profile
--   • Inserts a 'badge_revoked' notification to the landlord
CREATE OR REPLACE FUNCTION public.handle_scam_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id   UUID;
  v_scam_count INT;
BEGIN
  -- Resolve listing owner
  SELECT user_id INTO v_owner_id
  FROM public.listings
  WHERE id = NEW.listing_id;

  -- Only act on scam reports
  IF NEW.category = 'scam' AND v_owner_id IS NOT NULL THEN

    -- Count all scam reports across all listings owned by this user
    SELECT COUNT(*) INTO v_scam_count
    FROM public.listing_reports lr
    JOIN public.listings l ON l.id = lr.listing_id
    WHERE l.user_id = v_owner_id
      AND lr.category = 'scam';

    IF v_scam_count >= 3 THEN
      -- Revoke verification flags and set the scam flag.
      -- The sync_verification_badge_trigger will automatically clear
      -- verification_badge when email_auto_verified / phone_verified change.
      UPDATE public.profiles
      SET
        email_auto_verified = FALSE,
        phone_verified      = FALSE,
        scam_flagged        = TRUE
      WHERE id = v_owner_id;

      -- Notify the landlord only if they haven't already been notified
      -- (avoid duplicate notifications if badge was already revoked)
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_owner_id
          AND type = 'badge_revoked'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (
          v_owner_id,
          'badge_revoked',
          'Verificatiebadge ingetrokken',
          'Je ''Geverifieerd'' badge is ingetrokken vanwege meerdere scam-meldingen. Neem contact op met support.'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 4: Attach the trigger to listing_reports
DROP TRIGGER IF EXISTS handle_scam_report_trigger ON public.listing_reports;
CREATE TRIGGER handle_scam_report_trigger
  AFTER INSERT ON public.listing_reports
  FOR EACH ROW EXECUTE PROCEDURE public.handle_scam_report();

-- Step 5: Backfill scam_flagged for any owners already over the threshold
UPDATE public.profiles p
SET scam_flagged = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.listing_reports lr
  JOIN public.listings l ON l.id = lr.listing_id
  WHERE l.user_id = p.id
    AND lr.category = 'scam'
  GROUP BY l.user_id
  HAVING COUNT(*) >= 3
);
