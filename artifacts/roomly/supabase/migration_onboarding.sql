-- ============================================================
-- MIGRATION: onboarding_completed on profiles
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing users who have already set a user_type as onboarded
-- so they are not forced through the flow again.
UPDATE public.profiles
  SET onboarding_completed = TRUE
  WHERE user_type IS NOT NULL
    AND deleted_at IS NULL;
