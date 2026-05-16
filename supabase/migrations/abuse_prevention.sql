-- ═════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Abuse prevention & rate limiting
-- Run in Supabase SQL Editor (fully idempotent — safe to re-run).
--
-- Issues fixed:
--   F-01 CRITICAL  Application/status notifications bypassing "own insert" policy
--   F-02 HIGH      Message spam — isLocked is client-side only, no server guard
--   F-03 HIGH      Conversation creation spam — direct INSERT, no RPC, no rate limit
--   F-04 HIGH      contact_messages: unauthenticated unlimited, no payload bounds
--   F-05 HIGH      notify_saved_search_matches: unbounded O(n) notification inserts
--   F-06 MEDIUM    listings.title / description: no DB-level length constraints
--   F-07 MEDIUM    profiles.bio: no DB-level length constraint
--   F-08 MEDIUM    notifications.title / body: no DB-level length constraints
--   F-09 MEDIUM    Realtime channel name timestamp causes channel accumulation
--   F-10 LOW       No per-user saved_search row cap
-- ═════════════════════════════════════════════════════════════════════════════

-- ── F-06: listings text field constraints ─────────────────────────────────────
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_title_length;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_title_length
  CHECK (char_length(title) BETWEEN 1 AND 200);

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_description_length;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_description_length
  CHECK (char_length(description) <= 5000);

-- ── F-07: profiles.bio constraint ────────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length
  CHECK (bio IS NULL OR char_length(bio) <= 500);

-- ── F-08: notifications text field constraints ────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_title_length;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_title_length
  CHECK (char_length(title) <= 200);

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_body_length;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_body_length
  CHECK (body IS NULL OR char_length(body) <= 500);

-- ── F-04: contact_messages payload bounds ────────────────────────────────────
ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_name_length;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_name_length
  CHECK (char_length(name) BETWEEN 1 AND 100);

ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_email_length;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_email_length
  CHECK (char_length(email) BETWEEN 1 AND 200);

ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_subject_length;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_subject_length
  CHECK (char_length(subject) BETWEEN 1 AND 200);

ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_message_length;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_message_length
  CHECK (char_length(message) BETWEEN 1 AND 2000);

-- ── F-10: saved_searches per-user row cap ────────────────────────────────────
-- Prevent a user from creating unlimited saved searches (each triggers a
-- notification loop on every new listing). Cap at 20 per user.
-- Enforced via a BEFORE INSERT trigger.

CREATE OR REPLACE FUNCTION public.check_saved_search_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.saved_searches
   WHERE user_id = NEW.user_id;

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'SAVED_SEARCH_LIMIT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_saved_search_limit ON public.saved_searches;
CREATE TRIGGER enforce_saved_search_limit
  BEFORE INSERT ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.check_saved_search_limit();

-- ── F-05: notify_saved_search_matches — cap at 100 notifications ──────────────
-- Without a cap, a single generic listing ("room in Amsterdam") can trigger
-- tens of thousands of notification inserts, timing out create_listing flow.
CREATE OR REPLACE FUNCTION public.notify_saved_search_matches(p_listing_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_search  RECORD;
  v_wants   BOOLEAN;
  v_body    TEXT;
  v_notified INT := 0;
  MAX_NOTIFY CONSTANT INT := 100;
BEGIN
  SELECT id, title, description, price, location, type,
         pets_allowed, smoking_allowed, gender_preference, rooms, surface_area
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_owner: caller does not own listing %', p_listing_id;
  END IF;

  FOR v_search IN
    SELECT ss.id, ss.user_id, ss.name, ss.filters
    FROM public.saved_searches ss
    WHERE ss.notify = true
      AND ss.user_id != auth.uid()
    LIMIT 500  -- fetch cap to prevent runaway cursor scan
  LOOP
    EXIT WHEN v_notified >= MAX_NOTIFY;

    CONTINUE WHEN
      (
        (v_search.filters->>'q') IS NOT NULL AND (v_search.filters->>'q') <> '' AND
        NOT (
          v_listing.title || ' ' || COALESCE(v_listing.description, '') || ' ' || v_listing.location
          ILIKE '%' || (v_search.filters->>'q') || '%'
        )
      ) OR
      (
        (v_search.filters->>'city') IS NOT NULL AND (v_search.filters->>'city') <> '' AND
        NOT v_listing.location ILIKE '%' || (v_search.filters->>'city') || '%'
      ) OR
      (
        (v_search.filters->>'district') IS NOT NULL AND (v_search.filters->>'district') <> '' AND
        NOT v_listing.location ILIKE '%' || (v_search.filters->>'district') || '%'
      ) OR
      (
        (v_search.filters->>'type') IS NOT NULL AND (v_search.filters->>'type') <> '' AND
        v_listing.type <> (v_search.filters->>'type')
      ) OR
      (
        (v_search.filters->>'min') IS NOT NULL AND
        (v_search.filters->>'min')::numeric > 0 AND
        v_listing.price < (v_search.filters->>'min')::numeric
      ) OR
      (
        (v_search.filters->>'max') IS NOT NULL AND
        (v_search.filters->>'max')::numeric < 10000 AND
        v_listing.price > (v_search.filters->>'max')::numeric
      ) OR
      (v_search.filters->>'pets' = '1' AND NOT COALESCE(v_listing.pets_allowed, false)) OR
      (v_search.filters->>'smoking' = '1' AND NOT COALESCE(v_listing.smoking_allowed, false)) OR
      (
        (v_search.filters->>'gender') IS NOT NULL AND (v_search.filters->>'gender') <> '' AND
        v_listing.gender_preference IS DISTINCT FROM (v_search.filters->>'gender')
      ) OR
      (
        (v_search.filters->>'rooms') IS NOT NULL AND (v_search.filters->>'rooms') <> '' AND
        (v_listing.rooms IS NULL OR v_listing.rooms < (v_search.filters->>'rooms')::integer)
      ) OR
      (
        (v_search.filters->>'min_surface') IS NOT NULL AND (v_search.filters->>'min_surface') <> '' AND
        (v_listing.surface_area IS NULL OR v_listing.surface_area < (v_search.filters->>'min_surface')::integer)
      );

    SELECT COALESCE(notify_matching_listing, true) INTO v_wants
    FROM public.profiles WHERE id = v_search.user_id;

    IF v_wants THEN
      v_body := '"' || v_listing.title || '" in ' || v_listing.location
             || ' matcht met je opgeslagen zoekopdracht "' || v_search.name || '".';

      INSERT INTO public.notifications (user_id, type, title, body, related_id)
      VALUES (
        v_search.user_id,
        'new_matching_listing',
        'Nieuwe woning gevonden!',
        v_body,
        p_listing_id
      )
      ON CONFLICT DO NOTHING;

      v_notified := v_notified + 1;
    END IF;

    UPDATE public.saved_searches SET last_matched_at = NOW() WHERE id = v_search.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_saved_search_matches(UUID) TO authenticated;

-- ── F-01: notify_application_event — safe cross-user notification RPC ─────────
-- Replaces the direct client-side INSERT to notifications for application events.
-- Validates that:
--   • new_application: caller is the applicant
--   • application_accepted/rejected: caller is the listing owner (landlord)
-- All cross-user notification inserts happen here only. The RLS policy
-- "Users can insert own notifications" (auth.uid() = user_id) blocks direct
-- cross-user inserts from the client.

CREATE OR REPLACE FUNCTION public.notify_application_event(
  p_application_id UUID,
  p_event          TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_app        RECORD;
  v_target_uid UUID;
  v_title      TEXT;
  v_body       TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_event NOT IN ('new_application', 'application_accepted', 'application_rejected') THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  SELECT a.id,
         a.applicant_id,
         a.listing_id,
         l.user_id    AS landlord_id,
         l.title      AS listing_title
    INTO v_app
    FROM public.applications a
    JOIN public.listings l ON l.id = a.listing_id
   WHERE a.id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF p_event = 'new_application' THEN
    IF v_user_id <> v_app.applicant_id THEN
      RAISE EXCEPTION 'NOT_AUTHORIZED';
    END IF;
    v_target_uid := v_app.landlord_id;
    v_title      := 'Nieuwe aanvraag ontvangen';
    v_body       := 'Je hebt een nieuwe reactie op "' || v_app.listing_title || '". Bekijk de aanvraag in je dashboard.';
  ELSE
    IF v_user_id <> v_app.landlord_id THEN
      RAISE EXCEPTION 'NOT_AUTHORIZED';
    END IF;
    v_target_uid := v_app.applicant_id;
    IF p_event = 'application_accepted' THEN
      v_title := 'Aanvraag geaccepteerd';
      v_body  := 'Je aanvraag voor "' || v_app.listing_title || '" is geaccepteerd.';
    ELSE
      v_title := 'Aanvraag afgewezen';
      v_body  := 'Je aanvraag voor "' || v_app.listing_title || '" is afgewezen.';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, related_id)
  VALUES (v_target_uid, p_event, v_title, v_body, v_app.listing_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_application_event(UUID, TEXT) TO authenticated;

-- ── F-02: send_message — rate-limited message insert RPC ─────────────────────
-- Replaces the direct INSERT to messages from the client.
-- Enforces:
--   • Caller must be a conversation participant
--   • body 1–4000 chars (mirrors DB CHECK)
--   • Max 20 messages per user per conversation per 60 seconds
-- Returns the new message UUID.

CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id UUID,
  p_body            TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_msg_id  UUID;
  v_count   INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Participant check
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
     WHERE id = p_conversation_id
       AND (tenant_id = v_user_id OR landlord_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- Payload validation (mirrors DB CHECK, explicit error for client)
  IF p_body IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  IF char_length(p_body) > 4000 THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;

  -- Rate limit: max 20 messages per user per conversation per 60 seconds
  SELECT COUNT(*) INTO v_count
    FROM public.messages
   WHERE conversation_id = p_conversation_id
     AND sender_id       = v_user_id
     AND created_at      > NOW() - INTERVAL '60 seconds';

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_user_id, trim(p_body))
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

-- Revoke direct INSERT on messages from authenticated users.
-- The ONLY write path is now send_message() above.
-- Triggers (messages_update_conversation) still fire because they run as the
-- table owner (postgres), not as the authenticated role.
REVOKE INSERT ON public.messages FROM authenticated;

GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;

-- ── F-03: start_conversation — rate-limited conversation creation RPC ──────────
-- Replaces the direct INSERT from ContactButton.tsx.
-- Enforces:
--   • Caller cannot start a conversation with themselves
--   • Returns existing conversation if one already exists (idempotent)
--   • Max 10 new conversations per user per 24 hours
-- Returns the conversation UUID.

CREATE OR REPLACE FUNCTION public.start_conversation(p_listing_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_listing   RECORD;
  v_conv_id   UUID;
  v_new_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT id, user_id INTO v_listing
    FROM public.listings
   WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  -- Cannot message your own listing
  IF v_listing.user_id = v_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- Return existing conversation (idempotent)
  SELECT id INTO v_conv_id
    FROM public.conversations
   WHERE listing_id = p_listing_id
     AND tenant_id  = v_user_id;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Rate limit: max 10 new conversations per user per 24 hours
  SELECT COUNT(*) INTO v_new_count
    FROM public.conversations
   WHERE tenant_id  = v_user_id
     AND created_at > NOW() - INTERVAL '24 hours';

  IF v_new_count >= 10 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO public.conversations (listing_id, tenant_id, landlord_id, hidden_by)
  VALUES (p_listing_id, v_user_id, v_listing.user_id, '{}')
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;

-- Drop the direct INSERT policy on conversations and revoke INSERT privilege.
-- Both the tenant path (ContactButton) and the landlord path (upsert_conversation)
-- now go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Authenticated users can start conversations" ON public.conversations;
REVOKE INSERT ON public.conversations FROM authenticated;

GRANT EXECUTE ON FUNCTION public.start_conversation(UUID) TO authenticated;
