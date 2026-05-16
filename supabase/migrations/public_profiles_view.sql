-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: public.profiles privacy — anon key exposes sensitive columns
--
-- Problem:
--   "Profiles are publicly readable" allows the anon key (unauthenticated
--   requests) to SELECT every column in public.profiles, including:
--     email, phone, deleted_at, notify_*, scam_flagged, subscription_tier,
--     email_auto_verified, phone_verified, student_verified, etc.
--
-- Fix:
--   1. Drop the overly-broad anon-accessible policy.
--   2. Create a public_profiles VIEW containing only safe, display-only fields.
--   3. Grant SELECT on the VIEW to anon and authenticated.
--   4. Add an "own profile" SELECT policy on the table (auth.uid() = id).
--   5. Add an "authenticated can read any profile" policy so logged-in users
--      can still run business-logic queries (ApplicantProfilePanel, landlord
--      dashboard reading applicant verification flags, ConversationPage, etc.).
--      These features are auth-gated so only real accounts can access them.
--
-- Result:
--   • Unauthenticated callers using the anon key: view only — no email/phone.
--   • Authenticated users: full table access (required for in-app features).
--   • Public listing pages that load owner profile: use public_profiles view.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Remove the policy that granted anon full table read access
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;

-- Step 2: Create the safe public view
-- Includes all fields a display component legitimately needs (avatar, name,
-- verification badge, response time, active status, avatar privacy flag).
-- Excludes: email, phone, deleted_at, notify_*, scam_flagged,
--           subscription_tier, phone_verified, email_auto_verified,
--           student_verified, student_verification_requested_at, show_email,
--           show_phone.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  name,
  avatar_url,
  bio,
  role,
  user_type,
  verification_badge,
  created_at,
  avg_response_time_hours,
  last_active_at,
  show_avatar_in_listings
FROM public.profiles;

-- Step 3: Grant view access
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Step 4: Own-profile full access (in case it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'profiles'
       AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END;
$$;

-- Step 5: Authenticated users can read any profile
-- Required for auth-gated features: ApplicantProfilePanel (landlord viewing
-- applicant email/phone/verification), DashboardPage (reading applicant
-- notify_application_update), ConversationPage (other party's profile).
-- These routes are always behind auth in the frontend.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'profiles'
       AND policyname = 'Authenticated users can read any profile'
  ) THEN
    CREATE POLICY "Authenticated users can read any profile"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;
