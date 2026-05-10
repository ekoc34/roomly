-- ============================================================
-- MIGRATION: Sync email verification status via magic link
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- This trigger fires whenever a row in auth.users is updated.
-- When email_confirmed_at changes from NULL to a timestamp,
-- it sets email_auto_verified = TRUE in public.profiles for that user.
-- The existing sync_verification_badge trigger (if present) will
-- then handle updating the verification_badge field automatically.
-- ============================================================

create or replace function public.sync_email_verified_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only act when email_confirmed_at transitions from NULL to a value
  if (old.email_confirmed_at is null and new.email_confirmed_at is not null) then
    update public.profiles
    set email_auto_verified = true
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute procedure public.sync_email_verified_from_auth();
