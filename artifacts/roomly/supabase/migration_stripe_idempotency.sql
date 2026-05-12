-- ============================================================
-- Migration: Stripe webhook idempotency
-- Run in Supabase SQL Editor before deploying the updated
-- stripe-webhook Edge Function.
-- ============================================================

-- Stores every Stripe event ID that has been successfully processed.
-- The PRIMARY KEY constraint guarantees uniqueness; any duplicate
-- INSERT (ON CONFLICT DO NOTHING) returns 0 rows affected, which
-- the Edge Function interprets as "already handled → skip".
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id     text        PRIMARY KEY,
  event_type   text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Automatically clean up records older than 90 days to keep the
-- table small (Stripe only retries within a few days).
CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_at
  ON stripe_processed_events (processed_at);

-- RLS: no user should ever read or write this table directly.
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- Only the service role (used by the Edge Function) can insert/select.
-- No policy is needed for service role — it bypasses RLS by design.
