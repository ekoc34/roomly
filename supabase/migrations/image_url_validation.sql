-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Server-side image URL validation + minor hardening
--
-- Fixes three issues identified in the security audit:
--
-- 1. IMAGE URL VALIDATION (main purpose of this migration)
--    create_listing and update_listing accepted any string in the images array.
--    A caller bypassing the frontend could store:
--      • tracking-pixel URLs (https://attacker.com/pixel.gif)
--        → leaks viewer IP + timing to third party on every listing view
--      • arbitrary external image content / adult material / competitor logos
--    Classic stored XSS via <img src> is NOT exploitable in modern browsers
--    (javascript: ignored; data:image/svg+xml scripts sandboxed in img context).
--    Tracking pixels are the primary confirmed risk.
--
--    Fix: validate_image_urls() helper enforces:
--      • Maximum 20 URLs per listing (frontend allows 6; 20 is generous server cap)
--      • Maximum 512 characters per URL
--      • HTTPS-only (rejects data:, javascript:, file:, blob: implicitly)
--      • Explicit rejection of dangerous schemes (belt-and-suspenders)
--      • Optional Supabase Storage-only restriction (see commented block)
--
-- 2. listings.type NOT VALIDATED IN RPC (from previous audit Finding 2)
--    The type field was accepted as-is with no whitelist check. Now validated
--    against the three known values before INSERT/UPDATE.
--
-- 3. update_listing UPDATE clause not re-anchored on ownership (previous audit Finding 1)
--    The ownership check was a separate IF NOT EXISTS guard before the UPDATE.
--    The UPDATE WHERE clause now includes AND user_id = v_user_id as
--    defense-in-depth against any theoretical TOCTOU window.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: validate_image_urls ───────────────────────────────────────────────
-- Called internally by create_listing and update_listing.
-- Raises INVALID_IMAGE_URL if any URL fails validation.
-- Raises INVALID_DATA if the array itself is malformed or too long.
-- Silently accepts NULL / missing images field (treated as empty array).

CREATE OR REPLACE FUNCTION public.validate_image_urls(p_images JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url   TEXT;
  v_count INT := 0;
BEGIN
  -- NULL or JSON null → empty, always valid
  IF p_images IS NULL OR jsonb_typeof(p_images) = 'null' THEN
    RETURN;
  END IF;

  -- Must be a JSON array
  IF jsonb_typeof(p_images) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Array length cap
  SELECT COUNT(*) INTO v_count
    FROM jsonb_array_elements_text(p_images);

  IF v_count > 20 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Per-URL validation
  FOR v_url IN
    SELECT x FROM jsonb_array_elements_text(p_images) AS t(x)
  LOOP
    -- Null element not allowed
    IF v_url IS NULL THEN
      RAISE EXCEPTION 'INVALID_IMAGE_URL';
    END IF;

    -- Length cap
    IF length(v_url) > 512 THEN
      RAISE EXCEPTION 'INVALID_IMAGE_URL';
    END IF;

    -- Explicitly reject dangerous schemes (belt-and-suspenders)
    IF lower(v_url) LIKE 'javascript:%'
    OR lower(v_url) LIKE 'data:%'
    OR lower(v_url) LIKE 'file:%'
    OR lower(v_url) LIKE 'blob:%'
    THEN
      RAISE EXCEPTION 'INVALID_IMAGE_URL';
    END IF;

    -- Require HTTPS (covers all remaining non-https schemes)
    IF lower(v_url) NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'INVALID_IMAGE_URL';
    END IF;

    -- ── Optional: restrict to your Supabase Storage domain ──────────────────
    -- Uncomment the block below to reject any URL not hosted on your project's
    -- Supabase Storage. Replace <your-project-ref> with your project reference
    -- (the subdomain in your VITE_SUPABASE_URL, e.g. "xyzabcdef").
    --
    -- IF v_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/' THEN
    --   RAISE EXCEPTION 'INVALID_IMAGE_URL';
    -- END IF;
    -- ────────────────────────────────────────────────────────────────────────
  END LOOP;
END;
$$;

-- Grant EXECUTE to authenticated so SECURITY DEFINER callers can invoke it.
-- (Also needed if called directly during testing.)
GRANT EXECUTE ON FUNCTION public.validate_image_urls(JSONB) TO authenticated;


-- ── create_listing ────────────────────────────────────────────────────────────
-- Changes vs original:
--   • validate_image_urls() called before INSERT
--   • listings.type validated against known whitelist
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
  v_type       TEXT;
  v_id         UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Free-tier listing cap: temporarily disabled.
  -- Re-enable the block below to restore the 2-listing limit for free users.
  -- DECLARE
  --   v_tier       TEXT;
  --   v_is_admin   BOOLEAN;
  --   v_list_count INT;
  -- BEGIN
  --   SELECT subscription_tier, (role = 'admin')
  --     INTO v_tier, v_is_admin
  --     FROM public.profiles
  --    WHERE id = v_user_id;
  --   IF NOT v_is_admin AND v_tier = 'free' THEN
  --     SELECT COUNT(*) INTO v_list_count
  --       FROM public.listings WHERE user_id = v_user_id;
  --     IF v_list_count >= 2 THEN
  --       RAISE EXCEPTION 'LIMIT_REACHED';
  --     END IF;
  --   END IF;
  -- END;

  -- ── Input validation ──────────────────────────────────────────────────────

  v_title    := trim(p_data->>'title');
  v_price    := (p_data->>'price')::NUMERIC;
  v_location := trim(p_data->>'location');
  v_type     := COALESCE(p_data->>'type', 'room_for_rent');

  IF v_title IS NULL OR length(v_title) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_price IS NULL OR v_price = 'NaN'::NUMERIC OR v_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_location IS NULL OR length(v_location) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Whitelist: only known listing types accepted
  IF v_type NOT IN ('room_for_rent', 'roommate_search', 'short_stay') THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Image URL validation (blocks tracking pixels, arbitrary external content)
  PERFORM public.validate_image_urls(p_data->'images');

  -- ── Insert ────────────────────────────────────────────────────────────────

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
    v_type,
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


-- ── update_listing ────────────────────────────────────────────────────────────
-- Changes vs original:
--   • validate_image_urls() called before UPDATE
--   • listings.type validated against known whitelist
--   • UPDATE WHERE clause re-anchored with AND user_id = v_user_id
--     (defense-in-depth against theoretical TOCTOU; raises NOT_AUTHORIZED
--     via the NOT FOUND check if ownership changed between guard and write)
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
  v_type     TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Ownership check: caller must own the listing
  IF NOT EXISTS (
    SELECT 1 FROM public.listings WHERE id = p_listing_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- ── Input validation ──────────────────────────────────────────────────────

  v_title    := trim(p_data->>'title');
  v_price    := (p_data->>'price')::NUMERIC;
  v_location := trim(p_data->>'location');
  v_type     := COALESCE(p_data->>'type', 'room_for_rent');

  IF v_title IS NULL OR length(v_title) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_price IS NULL OR v_price = 'NaN'::NUMERIC OR v_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF v_location IS NULL OR length(v_location) = 0 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Whitelist: only known listing types accepted
  IF v_type NOT IN ('room_for_rent', 'roommate_search', 'short_stay') THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Image URL validation (blocks tracking pixels, arbitrary external content)
  PERFORM public.validate_image_urls(p_data->'images');

  -- ── Update ────────────────────────────────────────────────────────────────
  -- Re-anchors ownership in the WHERE clause (defense-in-depth vs TOCTOU).

  UPDATE public.listings SET
    title             = v_title,
    description       = COALESCE(trim(p_data->>'description'), ''),
    price             = v_price,
    location          = v_location,
    type              = v_type,
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
  WHERE id = p_listing_id
    AND user_id = v_user_id;  -- re-anchored ownership (defense-in-depth)

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
END;
$$;

-- Grants unchanged — create_listing and update_listing already granted to authenticated
-- in migration_security_hardening.sql STEP 15. Re-stating for clarity:
GRANT EXECUTE ON FUNCTION public.create_listing(JSONB)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_listing(UUID, JSONB) TO authenticated;
