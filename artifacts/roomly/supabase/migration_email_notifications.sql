-- ============================================================
-- MIGRATION: Transactional e-mail notifications
-- Run in Supabase SQL Editor AFTER deploying the two Edge
-- Functions (notify-message, notify-application).
--
-- Required once per project (run in SQL Editor or via CLI):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
--   SELECT pg_reload_conf();
-- ============================================================

-- ── 1. Enable pg_net ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 2. Email preference columns on profiles ──────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email_messages      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_email_applications  BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 3. email_notifications tracking table ────────────────────
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('message', 'application')),
  related_id  UUID        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error       TEXT        NULL
);

-- Unique per-event dedup (application emails): one email per (user, type, related_id)
CREATE UNIQUE INDEX IF NOT EXISTS email_notifications_application_dedup
  ON public.email_notifications (user_id, type, related_id)
  WHERE type = 'application';

-- Index for debounce query (message emails)
CREATE INDEX IF NOT EXISTS email_notifications_message_window_idx
  ON public.email_notifications (user_id, related_id, sent_at DESC)
  WHERE type = 'message';

CREATE INDEX IF NOT EXISTS email_notifications_user_id_idx
  ON public.email_notifications (user_id);

-- RLS: only the service role (bypasses RLS) writes; users cannot read/write directly
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct user access"
  ON public.email_notifications
  FOR ALL
  USING (false);

-- ── 4. Trigger: enqueue message email ────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_message_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url  TEXT;
  v_key  TEXT;
BEGIN
  v_url := current_setting('app.supabase_url',     true) || '/functions/v1/notify-message';
  v_key := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'message_id',      NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id',       NEW.sender_id,
      'body_preview',    left(NEW.body, 120)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_message_email ON public.messages;
CREATE TRIGGER trigger_enqueue_message_email
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.enqueue_message_email();

-- ── 5. Trigger: enqueue application email ────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_application_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url  TEXT;
  v_key  TEXT;
BEGIN
  v_url := current_setting('app.supabase_url',     true) || '/functions/v1/notify-application';
  v_key := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'application_id', NEW.id,
      'listing_id',     NEW.listing_id,
      'applicant_id',   NEW.applicant_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_application_email ON public.applications;
CREATE TRIGGER trigger_enqueue_application_email
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE PROCEDURE public.enqueue_application_email();
