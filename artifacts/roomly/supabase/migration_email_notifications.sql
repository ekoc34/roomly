-- ============================================================
-- MIGRATION: Transactional e-mail notifications
-- Run in Supabase SQL Editor AFTER deploying the two Edge
-- Functions (notify-message, notify-application).
--
-- ── MANUAL SETUP REQUIRED (run once in SQL Editor) ───────────
--
--   1. Generate a secure random secret, e.g.:
--        openssl rand -hex 32
--
--   2. Store it as a database setting:
--        ALTER DATABASE postgres
--          SET app.email_webhook_secret = 'YOUR_GENERATED_SECRET';
--        SELECT pg_reload_conf();
--
--   3. Set the same value as the edge function secret
--      EMAIL_WEBHOOK_SECRET in Supabase → Edge Functions → Secrets.
--
--   The Supabase project URL is read from the auto-provided
--   setting app.settings.supabase_url (set by Supabase on all
--   managed instances). If your project does not expose that
--   setting, run the optional fallback below:
--
--   [optional fallback — only needed if the trigger logs "no url"]
--        ALTER DATABASE postgres
--          SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
--        SELECT pg_reload_conf();
--
-- ── SECRETS NEVER STORED IN DATABASE CONFIG ──────────────────
--   The Supabase service role key is NOT stored here.
--   The edge functions use SUPABASE_SERVICE_ROLE_KEY from
--   their own auto-provided environment variables internally.
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

-- ── 4. Helper: resolve Supabase project base URL ─────────────
--  Reads from app.settings.supabase_url (auto-set by Supabase)
--  then falls back to the user-settable app.supabase_url.
CREATE OR REPLACE FUNCTION private.get_supabase_url()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    current_setting('app.settings.supabase_url', true),
    current_setting('app.supabase_url',          true)
  );
$$;

-- ── 5. Trigger: enqueue message email ────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_message_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_base_url TEXT;
  v_secret   TEXT;
BEGIN
  v_base_url := private.get_supabase_url();
  v_secret   := current_setting('app.email_webhook_secret', true);

  -- Bail silently if configuration is missing; email is best-effort
  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE WARNING '[enqueue_message_email] app.supabase_url not configured — skipping';
    RETURN NEW;
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING '[enqueue_message_email] app.email_webhook_secret not configured — skipping';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_base_url || '/functions/v1/notify-message',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
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

-- ── 6. Trigger: enqueue application email ────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_application_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_base_url TEXT;
  v_secret   TEXT;
BEGIN
  v_base_url := private.get_supabase_url();
  v_secret   := current_setting('app.email_webhook_secret', true);

  IF v_base_url IS NULL OR v_base_url = '' THEN
    RAISE WARNING '[enqueue_application_email] app.supabase_url not configured — skipping';
    RETURN NEW;
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING '[enqueue_application_email] app.email_webhook_secret not configured — skipping';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_base_url || '/functions/v1/notify-application',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
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
