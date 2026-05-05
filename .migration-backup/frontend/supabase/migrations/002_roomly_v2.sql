-- Roomly v2 migration: general audience + messaging + favorites + reports + profile enhancements
-- Apply in Supabase SQL editor AFTER 001_roomly_schema.sql

-- =========== Profile enhancements ===========
alter table public.profiles
  add column if not exists name text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists email_auto_verified boolean not null default false,
  add column if not exists user_type text not null default 'tenant'
    check (user_type in ('tenant', 'landlord', 'student', 'professional', 'family'));

-- Auto-verify known .edu / .nl university email domains on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
  is_edu boolean;
begin
  email_domain := lower(split_part(new.email, '@', 2));
  is_edu := email_domain like '%.edu'
    or email_domain in (
      'student.uva.nl','uva.nl','vu.nl','student.vu.nl',
      'tudelft.nl','student.tudelft.nl',
      'tue.nl','student.tue.nl',
      'utwente.nl','student.utwente.nl',
      'rug.nl','student.rug.nl',
      'ru.nl','student.ru.nl',
      'uu.nl','students.uu.nl',
      'eur.nl','student.eur.nl',
      'maastrichtuniversity.nl','student.maastrichtuniversity.nl',
      'wur.nl','student.wur.nl',
      'tilburguniversity.edu','tilburguniversity.nl',
      'hva.nl','student.hva.nl',
      'hu.nl','student.hu.nl',
      'saxion.nl','student.saxion.nl'
    );
  insert into public.profiles (id, email, email_auto_verified, student_verified)
  values (new.id, new.email, is_edu, is_edu);
  return new;
end;
$$;

-- =========== Favorites ===========
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists favorites_listing_id_idx on public.favorites (listing_id);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- =========== Conversations + Messages ===========
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  tenant_id uuid not null references auth.users (id) on delete cascade,
  landlord_id uuid not null references auth.users (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, tenant_id)
);

create index if not exists conversations_tenant_idx on public.conversations (tenant_id, last_message_at desc);
create index if not exists conversations_landlord_idx on public.conversations (landlord_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (conversation_id) where read_at is null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select_parties" on public.conversations;
create policy "conversations_select_parties"
  on public.conversations for select
  using (auth.uid() = tenant_id or auth.uid() = landlord_id);

drop policy if exists "conversations_insert_tenant" on public.conversations;
create policy "conversations_insert_tenant"
  on public.conversations for insert
  with check (
    auth.uid() = tenant_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = landlord_id and l.user_id <> auth.uid()
    )
  );

drop policy if exists "conversations_update_parties" on public.conversations;
create policy "conversations_update_parties"
  on public.conversations for update
  using (auth.uid() = tenant_id or auth.uid() = landlord_id);

drop policy if exists "messages_select_parties" on public.messages;
create policy "messages_select_parties"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

drop policy if exists "messages_insert_parties" on public.messages;
create policy "messages_insert_parties"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

drop policy if exists "messages_update_own_read" on public.messages;
create policy "messages_update_own_read"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

-- trigger: bump conversation.last_message_at when a message is inserted
create or replace function public.bump_conversation_timestamp()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_timestamp();

-- =========== Listing reports ===========
create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) > 0 and char_length(reason) <= 1000),
  category text not null default 'other'
    check (category in ('scam','spam','inappropriate','fake_photos','duplicate','other')),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

create index if not exists listing_reports_listing_idx on public.listing_reports (listing_id);

alter table public.listing_reports enable row level security;

drop policy if exists "listing_reports_insert_own" on public.listing_reports;
create policy "listing_reports_insert_own"
  on public.listing_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "listing_reports_select_own" on public.listing_reports;
create policy "listing_reports_select_own"
  on public.listing_reports for select
  using (auth.uid() = reporter_id);

-- =========== Public profile read (for listing detail owner info) ===========
drop policy if exists "profiles_select_public_basic" on public.profiles;
create policy "profiles_select_public_basic"
  on public.profiles for select
  using (true);

-- Avatar storage bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
