-- Migration: Allow users to read their own rows from user_reports
-- Run this in the Supabase SQL Editor.
--
-- This policy is required for two reasons:
-- 1. The on-mount block status fetch (reporter_id = me OR reported_id = me)
--    must return rows for regular users, not just admins.
-- 2. Supabase realtime uses RLS to decide which INSERT/DELETE events to
--    deliver. Without a SELECT policy covering the affected user, realtime
--    events for user_reports are silently dropped — so blockedByOther would
--    never update live without a page refresh.

create policy "users can select their own user_reports"
  on public.user_reports for select
  to authenticated
  using (auth.uid() = reporter_id or auth.uid() = reported_id);
