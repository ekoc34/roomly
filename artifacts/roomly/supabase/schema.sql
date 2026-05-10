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
