-- ============================================================
-- MIGRATION: Transactional e-mail notifications
--
-- ── BEFORE RUNNING: edit the two URL constants below ─────────
--
--   Replace YOUR_PROJECT_REF with your Supabase project reference.
--   Find it in: Supabase Dashboard → Settings → API → Project URL
--   Example: https://abcxyzabcxyzabcd.supabase.co
--
--   Search this file for "YOUR_PROJECT_REF" (2 occurrences) and
--   replace both with your actual project reference.
--
-- ── NO ALTER DATABASE COMMANDS NEEDED ────────────────────────
--   No PostgreSQL config variables are used.
--   No current_setting() calls. No app.* GUCs.
--   The project URL is stored directly in the trigger body.
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

DROP POLICY IF EXISTS "No direct user access" ON public.email_notifications;
CREATE POLICY "No direct user access"
  ON public.email_notifications
  FOR ALL
  USING (false);

-- ── 4. Trigger: enqueue message email ────────────────────────
--   The URL is a constant in the function body.
--   Replace YOUR_PROJECT_REF before running.
CREATE OR REPLACE FUNCTION public.enqueue_message_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url TEXT := 'https://gjjwctzgkujtlegcvxwy.supabase.co/functions/v1/notify-message';
BEGIN
  PERFORM net.http_post(
    url     := v_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'message_id',      NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id',       NEW.sender_id,
      'body_preview',    left(NEW.body, 120)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the user action if the HTTP call fails
  RAISE WARNING '[enqueue_message_email] pg_net error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_message_email ON public.messages;
CREATE TRIGGER trigger_enqueue_message_email
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.enqueue_message_email();

-- ── 5. Trigger: enqueue application email ────────────────────
--   Replace YOUR_PROJECT_REF before running.
CREATE OR REPLACE FUNCTION public.enqueue_application_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url TEXT := 'https://gjjwctzgkujtlegcvxwy.supabase.co.supabase.co/functions/v1/notify-application';
BEGIN
  PERFORM net.http_post(
    url     := v_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'application_id', NEW.id,
      'listing_id',     NEW.listing_id,
      'applicant_id',   NEW.applicant_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[enqueue_application_email] pg_net error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_application_email ON public.applications;
CREATE TRIGGER trigger_enqueue_application_email
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE PROCEDURE public.enqueue_application_email();
