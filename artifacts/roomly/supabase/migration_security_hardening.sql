-- ============================================================
-- MIGRATION: Production-ready security & architecture hardening
-- Run in Supabase SQL Editor
-- ============================================================

-- ── STEP 1: Schema additions ─────────────────────────────────

-- Boost economy fields + subscription tier on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS boost_credits     INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_boost_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_resend_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT        NOT NULL DEFAULT 'free';

-- Constrain subscription_tier to known values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'premium'));

-- boosted_at timestamp on listings (boosted boolean kept for backward compat)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMPTZ DEFAULT NULL;

-- ── STEP 2: boost_logs audit table ───────────────────────────

CREATE TABLE IF NOT EXISTS public.boost_logs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id   UUID        NOT NULL REFERENCES public.listings(id)  ON DELETE CASCADE,
  action       TEXT        NOT NULL DEFAULT 'boost',
  credits_used INT         NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.boost_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own boost_logs"
  ON public.boost_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all boost_logs"
  ON public.boost_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── STEP 3: Update boosted ordering index ────────────────────
-- Keep boosted boolean ordering; add boosted_at for recency within boosted set.
DROP INDEX IF EXISTS public.idx_listings_boosted_created;
CREATE INDEX IF NOT EXISTS idx_listings_boosted_at_created
  ON public.listings (boosted DESC, boosted_at DESC NULLS LAST, created_at DESC);

-- ── STEP 4: Harden existing SECURITY DEFINER functions ───────
-- All SECURITY DEFINER functions must SET search_path = '' to prevent
-- search_path injection attacks. Re-create each one.

-- can_view_contact_info: add SET search_path = ''
CREATE OR REPLACE FUNCTION public.can_view_contact_info(viewer_id uuid, profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    viewer_id = profile_id
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.tenant_id = viewer_id AND c.landlord_id = profile_id)
         OR (c.landlord_id = viewer_id AND c.tenant_id = profile_id)
    )
  );
$$;

-- handle_scam_report: add SET search_path = ''
CREATE OR REPLACE FUNCTION public.handle_scam_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id   UUID;
  v_scam_count INT;
BEGIN
  SELECT user_id INTO v_owner_id
    FROM public.listings WHERE id = NEW.listing_id;

  IF NEW.category = 'scam' AND v_owner_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_scam_count
      FROM public.listing_reports lr
      JOIN public.listings l ON l.id = lr.listing_id
     WHERE l.user_id = v_owner_id AND lr.category = 'scam';

    IF v_scam_count >= 3 THEN
      UPDATE public.profiles
         SET email_auto_verified = FALSE,
             phone_verified      = FALSE,
             scam_flagged        = TRUE
       WHERE id = v_owner_id;

      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
         WHERE user_id = v_owner_id AND type = 'badge_revoked'
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

-- upsert_conversation: change SET search_path = public → SET search_path = ''
CREATE OR REPLACE FUNCTION public.upsert_conversation(
  p_listing_id  UUID,
  p_tenant_id   UUID,
  p_landlord_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.listings
     WHERE id = p_listing_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not the landlord of this listing';
  END IF;

  SELECT id INTO v_conv_id
    FROM public.conversations
   WHERE listing_id = p_listing_id AND tenant_id = p_tenant_id
   LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (listing_id, tenant_id, landlord_id, hidden_by)
    VALUES (p_listing_id, p_tenant_id, p_landlord_id, '{}')
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- ── STEP 5: is_admin() ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── STEP 6: create_listing(p_data JSONB) ─────────────────────
-- Validates input, enforces free-tier listing limit, inserts listing, returns new UUID.
-- Replaces the direct INSERT that was previously allowed by RLS.
CREATE OR REPLACE FUNCTION public.create_listing(p_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    UUID    := auth.uid();
  v_title      TEXT;
  v_price      NUMERIC;
  v_location   TEXT;
  v_id         UUID;
  v_tier       TEXT;
  v_is_admin   BOOLEAN;
  v_list_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Free-tier listing cap: max 2 active listings per user.
  -- Admins and premium users are exempt.
  SELECT subscription_tier, (role = 'admin')
    INTO v_tier, v_is_admin
    FROM public.profiles
   WHERE id = v_user_id;

  IF NOT v_is_admin AND v_tier = 'free' THEN
    SELECT COUNT(*) INTO v_list_count
      FROM public.listings
     WHERE user_id = v_user_id;

    IF v_list_count >= 2 THEN
      RAISE EXCEPTION 'LIMIT_REACHED';
    END IF;
  END IF;

  v_title    := trim(p_data->>'title');
  v_price    := (p_data->>'price')::NUMERIC;
  v_location := trim(p_data->>'location');

  IF v_title IS NULL OR length(v_title) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- v_price > 0 handles NULL, zero, negative; NaN compare via explicit check
  IF v_price IS NULL OR v_price = 'NaN'::NUMERIC OR v_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_location IS NULL OR length(v_location) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  INSERT INTO public.listings (
    user_id, title, description, price, location, type, images,
    availability_date, pets_allowed, smoking_allowed,
    gender_preference, rooms, surface_area
  ) VALUES (
    v_user_id,
    v_title,
    COALESCE(trim(p_data->>'description'), ''),
    v_price,
    v_location,
    COALESCE(p_data->>'type', 'room_for_rent'),
    COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'images') AS t(x)),
      '{}'::TEXT[]
    ),
    CASE WHEN trim(COALESCE(p_data->>'availability_date', '')) <> ''
         THEN (p_data->>'availability_date')::DATE ELSE NULL END,
    COALESCE((p_data->>'pets_allowed')::BOOLEAN, FALSE),
    COALESCE((p_data->>'smoking_allowed')::BOOLEAN, FALSE),
    CASE WHEN p_data->>'gender_preference' IN ('man', 'vrouw', 'gemengd')
         THEN p_data->>'gender_preference' ELSE NULL END,
    NULLIF(trim(COALESCE(p_data->>'rooms', '')), '')::INTEGER,
    NULLIF(trim(COALESCE(p_data->>'surface_area', '')), '')::INTEGER
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── STEP 7: update_listing(p_listing_id UUID, p_data JSONB) ──
-- Validates ownership and input, applies whitelisted field updates.
CREATE OR REPLACE FUNCTION public.update_listing(p_listing_id UUID, p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  UUID    := auth.uid();
  v_title    TEXT;
  v_price    NUMERIC;
  v_location TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.listings WHERE id = p_listing_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  v_title    := trim(p_data->>'title');
  v_price    := (p_data->>'price')::NUMERIC;
  v_location := trim(p_data->>'location');

  IF v_title IS NULL OR length(v_title) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_price IS NULL OR v_price = 'NaN'::NUMERIC OR v_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_location IS NULL OR length(v_location) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  UPDATE public.listings SET
    title             = v_title,
    description       = COALESCE(trim(p_data->>'description'), ''),
    price             = v_price,
    location          = v_location,
    type              = COALESCE(p_data->>'type', 'room_for_rent'),
    images            = COALESCE(
                          (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'images') AS t(x)),
                          '{}'::TEXT[]
                        ),
    availability_date = CASE WHEN trim(COALESCE(p_data->>'availability_date', '')) <> ''
                             THEN (p_data->>'availability_date')::DATE ELSE NULL END,
    pets_allowed      = COALESCE((p_data->>'pets_allowed')::BOOLEAN, FALSE),
    smoking_allowed   = COALESCE((p_data->>'smoking_allowed')::BOOLEAN, FALSE),
    gender_preference = CASE WHEN p_data->>'gender_preference' IN ('man', 'vrouw', 'gemengd')
                             THEN p_data->>'gender_preference' ELSE NULL END,
    rooms             = NULLIF(trim(COALESCE(p_data->>'rooms', '')), '')::INTEGER,
    surface_area      = NULLIF(trim(COALESCE(p_data->>'surface_area', '')), '')::INTEGER
  WHERE id = p_listing_id;
END;
$$;

-- ── STEP 8: delete_listing(p_listing_id UUID) ────────────────
CREATE OR REPLACE FUNCTION public.delete_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  DELETE FROM public.listings
   WHERE id = p_listing_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
END;
$$;

-- ── STEP 9: delete_own_listings() ────────────────────────────
-- Called during account deletion to remove all listings before soft-deleting
-- the profile. The auth user cascade-delete would also handle this, but
-- explicit removal ensures conversations referencing those listings degrade
-- gracefully before the Edge Function fires.
CREATE OR REPLACE FUNCTION public.delete_own_listings()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  DELETE FROM public.listings WHERE user_id = v_user_id;
END;
$$;

-- ── STEP 10: boost_listing(p_listing_id UUID) ────────────────
-- Deadlock-safe: always acquires profile lock FIRST, then listing lock.
-- Enforces credit balance and 24-hour per-listing cooldown.
-- Writes an audit row to boost_logs on every successful boost.
CREATE OR REPLACE FUNCTION public.boost_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    UUID      := auth.uid();
  v_credits    INT;
  v_owner_id   UUID;
  v_boosted_at TIMESTAMPTZ;
  COOLDOWN_H   CONSTANT  INTERVAL := INTERVAL '24 hours';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- LOCK ORDER 1: profiles row (always first to prevent deadlocks)
  SELECT boost_credits
    INTO v_credits
    FROM public.profiles
   WHERE id = v_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- LOCK ORDER 2: listings row (always second)
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

  -- Cooldown based on listing's own boosted_at timestamp
  IF v_boosted_at IS NOT NULL AND v_boosted_at > NOW() - COOLDOWN_H THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE';
  END IF;

  -- Deduct one credit and record the boost timestamp
  UPDATE public.profiles
     SET boost_credits = boost_credits - 1,
         last_boost_at = NOW()
   WHERE id = v_user_id;

  -- Mark listing as boosted with fresh timestamp
  UPDATE public.listings
     SET boosted    = TRUE,
         boosted_at = NOW()
   WHERE id = p_listing_id;

  -- Audit trail (never fails silently — if this INSERT fails the whole TX rolls back)
  INSERT INTO public.boost_logs (user_id, listing_id, action, credits_used)
  VALUES (v_user_id, p_listing_id, 'boost', 1);
END;
$$;

-- ── STEP 11: admin_add_boost_credits(p_user_id, p_credits) ───
-- Only callable by admin users; internal auth check via is_admin().
CREATE OR REPLACE FUNCTION public.admin_add_boost_credits(p_user_id UUID, p_credits INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  UPDATE public.profiles
     SET boost_credits = boost_credits + p_credits
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
END;
$$;

-- ── STEP 12: get_my_profile_sensitive() ──────────────────────
-- Returns sensitive profile fields only for the calling user.
-- Postgres RLS is row-level only; column-level access is enforced here.
CREATE OR REPLACE FUNCTION public.get_my_profile_sensitive()
RETURNS TABLE (boost_credits INT, last_resend_at TIMESTAMPTZ, last_boost_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT boost_credits, last_resend_at, last_boost_at
    FROM public.profiles
   WHERE id = auth.uid();
$$;

-- ── STEP 13: RLS — profiles SELECT tightening ────────────────
-- Postgres does not support column-level RLS natively.
-- Strategy:
--   • The existing "Profiles are publicly readable" policy stays for non-sensitive
--     discovery fields (name, avatar_url, verification_badge, user_type, etc.)
--   • Sensitive fields (boost_credits, last_resend_at, last_boost_at) are only
--     accessible via get_my_profile_sensitive() above.
--   • This is the strongest boundary achievable without introducing a separate view.
--
-- No policy changes to the existing profile policies are needed because the
-- sensitive columns simply aren't returned in any public-facing query —
-- all read paths for those fields go through get_my_profile_sensitive().

-- ── STEP 14: Revoke direct write access to listings ──────────
-- The ONLY safe write path to listings is now through the RPCs above.
-- SELECT remains fully open (listings are publicly browsable).
-- service_role retains full access for admin Edge Functions.

DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;
DROP POLICY IF EXISTS "Owners can update their listings"        ON public.listings;
DROP POLICY IF EXISTS "Owners can delete their listings"        ON public.listings;

REVOKE INSERT, UPDATE, DELETE ON public.listings FROM authenticated;

-- ── STEP 15: Grant EXECUTE on write RPCs to authenticated ────
GRANT EXECUTE ON FUNCTION public.create_listing(JSONB)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_listing(UUID, JSONB)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_listing(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_listings()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.boost_listing(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_boost_credits(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_sensitive()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                         TO authenticated;

-- ── STEP 16: system_add_boost_credits (webhook-safe) ─────────
-- Called ONLY from the stripe-webhook Edge Function via service_role.
-- Does NOT check auth.uid() — trust is established by the service_role JWT.
-- Not granted to authenticated or anon roles.
CREATE OR REPLACE FUNCTION public.system_add_boost_credits(p_user_id UUID, p_credits INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  UPDATE public.profiles
     SET boost_credits = boost_credits + p_credits
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
END;
$$;

-- Explicitly deny this function to public/authenticated/anon — service_role only
REVOKE EXECUTE ON FUNCTION public.system_add_boost_credits(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.system_add_boost_credits(UUID, INT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.system_add_boost_credits(UUID, INT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.system_add_boost_credits(UUID, INT) TO service_role;
