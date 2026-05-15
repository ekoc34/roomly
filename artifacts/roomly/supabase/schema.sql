-- ============================================================
-- Roomly Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  name          text,
  avatar_url    text,
  bio           text,
  phone         text,
  role          text not null default 'student' check (role in ('student','landlord','admin')),
  user_type     text default null check (user_type in ('student','professional','alleenstaande','family','landlord')),
  phone_verified          boolean not null default false,
  email_auto_verified     boolean not null default false,
  student_verified        boolean not null default false,
  student_verification_requested_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, email_auto_verified, show_email, show_phone)
  values (
    new.id,
    new.email,
    false,
    false,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- LISTINGS
-- ============================================================
create table if not exists public.listings (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  title             text not null,
  description       text not null default '',
  price             numeric(10,2) not null check (price > 0),
  location          text not null default '',
  type              text not null default 'room_for_rent' check (type in ('room_for_rent','roommate_search','short_stay')),
  images            text[] not null default '{}',
  availability_date date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists listings_user_id_idx   on public.listings(user_id);
create index if not exists listings_type_idx      on public.listings(type);
create index if not exists listings_price_idx     on public.listings(price);
create index if not exists listings_created_at_idx on public.listings(created_at desc);

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
  before update on public.listings
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- FAVORITES
-- ============================================================
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table if not exists public.conversations (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid not null references public.listings(id) on delete cascade,
  tenant_id       uuid not null references public.profiles(id) on delete cascade,
  landlord_id     uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (listing_id, tenant_id)
);

create index if not exists conversations_tenant_id_idx   on public.conversations(tenant_id);
create index if not exists conversations_landlord_id_idx on public.conversations(landlord_id);
create index if not exists conversations_last_msg_idx    on public.conversations(last_message_at desc);

-- Auto-update last_message_at when a message is inserted
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_sender_id_idx       on public.messages(sender_id);
create index if not exists messages_created_at_idx      on public.messages(created_at asc);
create index if not exists messages_unread_idx          on public.messages(conversation_id, sender_id) where read_at is null;

drop trigger if exists messages_update_conversation on public.messages;
create trigger messages_update_conversation
  after insert on public.messages
  for each row execute procedure public.update_conversation_last_message();

-- ============================================================
-- APPLICATIONS
-- ============================================================
create table if not exists public.applications (
  id           uuid primary key default uuid_generate_v4(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  message      text not null check (char_length(message) between 1 and 500),
  budget       numeric(10,2) default null,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz not null default now(),
  unique (listing_id, applicant_id)
);

create index if not exists applications_listing_id_idx   on public.applications(listing_id);
create index if not exists applications_applicant_id_idx on public.applications(applicant_id);
create index if not exists applications_status_idx       on public.applications(status);

alter table public.applications enable row level security;

create policy "Applicants can view their own applications"
  on public.applications for select
  using (auth.uid() = applicant_id);

create policy "Landlords can view applications for their listings"
  on public.applications for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

create policy "Authenticated users can submit applications"
  on public.applications for insert
  with check (auth.uid() = applicant_id);

create policy "Landlords can update application status"
  on public.applications for update
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('new_application','application_accepted','application_rejected','new_message')),
  title      text not null,
  body       text default null,
  related_id uuid default null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx  on public.notifications(user_id);
create index if not exists notifications_read_idx     on public.notifications(user_id, read) where read = false;
create index if not exists notifications_created_idx  on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);

create policy "Users can mark their notifications as read"
  on public.notifications for update
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- LISTING REPORTS
-- ============================================================
create table if not exists public.listing_reports (
  id          uuid primary key default uuid_generate_v4(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category    text not null default 'other' check (category in ('scam','spam','inappropriate','fake_photos','duplicate','other')),
  reason      text not null check (char_length(reason) between 1 and 1000),
  created_at  timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

create index if not exists listing_reports_listing_id_idx on public.listing_reports(listing_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.listings        enable row level security;
alter table public.favorites       enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.listing_reports enable row level security;

-- PROFILES --
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- LISTINGS --
create policy "Listings are publicly readable"
  on public.listings for select using (true);

create policy "Authenticated users can create listings"
  on public.listings for insert
  with check (auth.uid() = user_id);

create policy "Owners can update their listings"
  on public.listings for update
  using (auth.uid() = user_id);

create policy "Owners can delete their listings"
  on public.listings for delete
  using (auth.uid() = user_id);

-- FAVORITES --
create policy "Users can view their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can add favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- CONVERSATIONS --
create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = tenant_id or auth.uid() = landlord_id);

create policy "Authenticated users can start conversations"
  on public.conversations for insert
  with check (auth.uid() = tenant_id);

-- MESSAGES --
create policy "Participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

create policy "Recipients can mark messages as read"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

-- LISTING REPORTS --
create policy "Authenticated users can report listings"
  on public.listing_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Only admins can view reports"
  on public.listing_reports for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- STORAGE: avatars bucket
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- REALTIME: enable for messages table
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ============================================================
-- MIGRATION: Advanced listing attributes + profile badges
-- Run this block in the Supabase SQL Editor after initial setup
-- ============================================================
alter table public.listings
  add column if not exists pets_allowed      boolean default null,
  add column if not exists smoking_allowed   boolean default null,
  add column if not exists gender_preference text check (gender_preference in ('vrouw','man','gemengd')) default null,
  add column if not exists rooms             integer default null,
  add column if not exists surface_area      integer default null;

alter table public.profiles
  add column if not exists verification_badge text default null;

-- ============================================================
-- MIGRATION: Privacy settings + contact reveal tracking
-- Run this block in the Supabase SQL Editor after initial setup
-- ============================================================

-- Privacy preferences on profiles
alter table public.profiles
  add column if not exists show_email boolean not null default false,
  add column if not exists show_phone boolean not null default false;

-- Track when landlord reveals applicant email
alter table public.applications
  add column if not exists contact_revealed boolean not null default false;

-- ============================================================
-- PRIVACY: Helper function to check contact info visibility
-- Returns TRUE if viewer_id is allowed to see profile_id's contact info:
--   1. viewer is the profile owner
--   2. viewer and profile share an active conversation
-- ============================================================
create or replace function public.can_view_contact_info(viewer_id uuid, profile_id uuid)
returns boolean language sql security definer as $$
  select (
    viewer_id = profile_id
    or exists (
      select 1 from public.conversations c
      where (c.tenant_id = viewer_id and c.landlord_id = profile_id)
         or (c.landlord_id = viewer_id and c.tenant_id = profile_id)
    )
  );
$$;

-- ============================================================
-- MIGRATION: Last active tracking
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- SAVED SEARCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Mijn zoekopdracht',
  filters       JSONB NOT NULL DEFAULT '{}',
  notify        BOOLEAN NOT NULL DEFAULT TRUE,
  last_matched_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS saved_searches_notify_idx  ON public.saved_searches(notify) WHERE notify = TRUE;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- MIGRATION: extend notifications type check to include new_matching_listing
-- Run in Supabase SQL Editor if the notifications table already exists
-- ============================================================
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_application','application_accepted','application_rejected','new_message','new_matching_listing'));

-- ============================================================
-- MIGRATION: landlord_reply on applications
-- ============================================================
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS landlord_reply TEXT DEFAULT NULL;

-- NOTE: Supabase does not support column-level security natively.
-- Email and phone privacy is enforced at the frontend layer:
--   - ProfilePage only renders the authenticated user's own profile.
--   - ApplicantProfilePanel masks email by default and requires explicit reveal.
--   - can_view_contact_info() can be used in future RPC calls for additional checks.

-- ============================================================
-- MIGRATION: notification preferences on profiles
-- Run in Supabase SQL Editor
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_new_message       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_application_update BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_matching_listing   BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- MIGRATION: Soft-delete support
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add deleted_at column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Update handle_new_user() so it never overwrites a soft-deleted profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If a soft-deleted profile already exists for this auth user, block the re-creation
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.id AND deleted_at IS NOT NULL
  ) THEN
    RETURN NEW; -- do nothing, leave the soft-deleted record intact
  END IF;

  INSERT INTO public.profiles (id, email, email_auto_verified, show_email, show_phone)
  VALUES (NEW.id, NEW.email, false, false, false)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- CONTACT MESSAGES
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  category    TEXT        NOT NULL CHECK (category IN ('suggestie', 'klacht', 'vraag', 'overig')),
  subject     TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) may INSERT a contact message
CREATE POLICY "public_insert_contact_messages"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins may SELECT contact messages
CREATE POLICY "admin_select_contact_messages"
  ON public.contact_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins may UPDATE contact messages (e.g. mark as read)
CREATE POLICY "admin_update_contact_messages"
  ON public.contact_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (true);

-- ============================================================
-- MIGRATION: hidden_by_landlord on applications
-- Run in Supabase SQL Editor to apply this migration
-- ============================================================
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS hidden_by_landlord BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- LISTING VIEWS: "Recent bekeken" tracking
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.listing_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id  UUID        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_views_user_listing_unique UNIQUE (user_id, listing_id)
);

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own listing_views"
  ON public.listing_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listing_views"
  ON public.listing_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listing_views"
  ON public.listing_views FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS listing_views_user_viewed_idx
  ON public.listing_views (user_id, viewed_at DESC);

-- ============================================================
-- MIGRATION: Allow user_type to be NULL (one-time selection)
-- Run this in the Supabase SQL Editor to apply to existing DB
-- ============================================================
-- Remove the NOT NULL constraint and default value so that
-- users who skip onboarding keep user_type = NULL until they
-- choose once from their profile page.
ALTER TABLE public.profiles
  ALTER COLUMN user_type DROP NOT NULL,
  ALTER COLUMN user_type DROP DEFAULT,
  ALTER COLUMN user_type SET DEFAULT NULL;

-- Optional: clear any existing 'tenant' defaults that were
-- set automatically on skip (makes existing test accounts neutral)
-- UPDATE public.profiles SET user_type = NULL WHERE user_type = 'tenant';
-- Uncomment the line above only if you want to reset existing accounts.

-- ============================================================
-- MIGRATION: Two-step persona — add 'alleenstaande', drop 'tenant'
-- Run this in the Supabase SQL Editor
-- ============================================================
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('student','professional','alleenstaande','family','landlord'));

-- Optional: migrate any existing 'tenant' rows to NULL so users
-- re-select their type via the new two-step flow on their profile page.
-- UPDATE public.profiles SET user_type = NULL WHERE user_type = 'tenant';
-- Uncomment the line above only if you want existing 'tenant' accounts to re-choose.

-- ============================================================
-- MIGRATION: Three-role system — verhuurder, huisgenoot_zoeker, woningzoekende subtypes
-- Run this in the Supabase SQL Editor
-- ============================================================
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('verhuurder','huisgenoot_zoeker','student','professional','alleenstaande','family'));

-- Optional: migrate any existing 'landlord' rows to 'verhuurder'
-- UPDATE public.profiles SET user_type = 'verhuurder' WHERE user_type = 'landlord';
-- Uncomment the line above to remap existing landlord accounts to the new role name.

-- ============================================================
-- MIGRATION: hidden_by column on conversations (soft-delete per user)
-- Run in Supabase SQL Editor
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS hidden_by TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================
-- MIGRATION: Fix conversations RLS — allow landlords to insert
-- The original policy only allowed auth.uid() = tenant_id, which
-- blocked landlords from creating conversations when accepting applications.
-- Run in Supabase SQL Editor
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can start conversations" ON public.conversations;
CREATE POLICY "Authenticated users can start conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    -- Tenant starts a conversation directly
    auth.uid() = tenant_id
    -- OR landlord creates it when accepting an application for their own listing
    OR (
      auth.uid() = landlord_id
      AND EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = listing_id AND l.user_id = auth.uid()
      )
    )
  );

-- Allow participants to update hidden_by (soft-delete)
DROP POLICY IF EXISTS "Participants can hide conversations" ON public.conversations;
CREATE POLICY "Participants can hide conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

-- ============================================================
-- MIGRATION: upsert_conversation RPC (security definer)
-- Allows a landlord to atomically find-or-create a conversation
-- without being blocked by the tenant-only INSERT RLS policy.
-- Run in Supabase SQL Editor
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_conversation(
  p_listing_id  UUID,
  p_tenant_id   UUID,
  p_landlord_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  -- Security: caller must be the landlord of the listing
  IF NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = p_listing_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not the landlord of this listing';
  END IF;

  -- Try to find an existing conversation for this listing+tenant pair
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE listing_id = p_listing_id
    AND tenant_id  = p_tenant_id
  LIMIT 1;

  -- Create one if none exists
  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (listing_id, tenant_id, landlord_id, hidden_by)
    VALUES (p_listing_id, p_tenant_id, p_landlord_id, '{}')
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- ============================================================
-- USER REPORTS (block / report another user from chat)
-- ============================================================
create table if not exists public.user_reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('blocked','reported')),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.user_reports enable row level security;

-- Any authenticated user can file a report
create policy "authenticated users can insert user_reports"
  on public.user_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Only admins can read all reports
create policy "admins can select user_reports"
  on public.user_reports for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- MIGRATION: avg_response_time_hours on profiles
-- Run in Supabase SQL Editor
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avg_response_time_hours NUMERIC DEFAULT NULL;

-- Only admins can update (mark resolved)
create policy "admins can update user_reports"
  on public.user_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (true);

-- Users can delete their own rows (e.g. remove a block they placed)
-- Without this policy, DELETE is silently ignored by RLS and returns no error.
create policy "users can delete their own user_reports"
  on public.user_reports for delete
  to authenticated
  using (auth.uid() = reporter_id);

-- ============================================================
-- delete_listing RPC
-- SECURITY DEFINER so that the cascade deletes on child tables
-- (applications, conversations, favorites, listing_views, etc.)
-- run as the function owner and bypass child-table RLS policies
-- that have no DELETE rule (which would otherwise block the cascade).
-- The function itself enforces ownership via auth.uid().
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify that the authenticated caller owns this listing
  IF NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = p_listing_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_owner: caller does not own listing %', p_listing_id;
  END IF;

  DELETE FROM public.listings WHERE id = p_listing_id;
END;
$$;
