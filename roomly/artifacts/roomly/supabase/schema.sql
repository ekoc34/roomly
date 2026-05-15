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
  user_type     text not null default 'tenant' check (user_type in ('tenant','landlord','student','professional','family')),
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
  insert into public.profiles (id, email, email_auto_verified)
  values (
    new.id,
    new.email,
    new.email like '%@%.edu' or new.email like '%@%.ac.nl' or new.email like '%@student.%'
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
-- STORAGE: listings bucket
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listings', 'listings', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Listing images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'listings');

create policy "Authenticated users can upload listing images"
  on storage.objects for insert
  with check (
    bucket_id = 'listings'
    and auth.uid() is not null
  );

create policy "Authenticated users can update listing images"
  on storage.objects for update
  with check (
    bucket_id = 'listings'
    and auth.uid() is not null
  );

create policy "Authenticated users can delete listing images"
  on storage.objects for delete
  with check (
    bucket_id = 'listings'
    and auth.uid() is not null
  );

-- ============================================================
-- REALTIME: enable for messages table
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ============================================================
-- MIGRATION: Advanced listing attributes (run in Supabase SQL Editor)
-- ============================================================
alter table public.listings
  add column if not exists pets_allowed    boolean default null,
  add column if not exists smoking_allowed boolean default null,
  add column if not exists gender_preference text check (gender_preference in ('vrouw','man','gemengd')) default null,
  add column if not exists rooms           integer default null,
  add column if not exists surface_area    integer default null;

-- ============================================================
-- SECURITY MIGRATION: Prevent client-side role escalation
-- Run in Supabase SQL Editor
-- ============================================================
-- This trigger fires BEFORE every UPDATE on profiles.
-- If the role column is being changed, it checks whether the
-- caller (auth.uid()) is already an admin. Non-admins have
-- their role silently reset to the existing value — no error,
-- no hint to the attacker that the attempt was blocked.
-- SECURITY DEFINER lets the inner SELECT bypass RLS so it
-- always reads the authoritative role from the database.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_role_escalation();

-- ============================================================
-- SECURITY MIGRATION: Fix notification open INSERT (CRITICAL-1)
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add 'new_matching_listing' to the notifications type constraint.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_application',
      'application_accepted',
      'application_rejected',
      'new_message',
      'new_matching_listing'
    ));

-- 2. Replace the open INSERT policy.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Server-side saved-search notification function.
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
  LOOP
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
    END IF;

    UPDATE public.saved_searches SET last_matched_at = NOW() WHERE id = v_search.id;
  END LOOP;
END;
$$;
