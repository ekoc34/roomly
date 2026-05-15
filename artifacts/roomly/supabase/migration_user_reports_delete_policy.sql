-- Migration: Allow users to delete their own block rows from user_reports
-- Run this in the Supabase SQL Editor.
--
-- Root cause: the user_reports table had INSERT/SELECT/UPDATE policies but
-- no DELETE policy. Without a DELETE policy, Supabase RLS silently ignores
-- the DELETE and returns no error — so the block row was never removed and
-- "blockedByMe" stayed true even after the user clicked "Blokkade opheffen".

create policy "users can delete their own user_reports"
  on public.user_reports for delete
  to authenticated
  using (auth.uid() = reporter_id);
