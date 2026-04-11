-- Roomly: core schema + RLS + storage prep

create extension if not exists "pgcrypto";

do $$ begin
  create type public.listing_type as enum ('room_for_rent', 'roommate_search', 'short_stay');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.application_status as enum ('pending', 'accepted', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'student' check (role in ('student', 'landlord', 'admin')),
  student_verified boolean not null default false,
  student_verification_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  location text not null,
  type public.listing_type not null,
  images text[] not null default '{}',
  availability_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  budget numeric(10, 2),
  availability_text text not null,
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

create table if not exists public.listing_monetization (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  featured_until timestamptz,
  subscription_id uuid,
  boost_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists listings_user_id_idx on public.listings (user_id);
create index if not exists listings_created_at_idx on public.listings (created_at desc);
create index if not exists listings_location_idx on public.listings (location);
create index if not exists listings_type_idx on public.listings (type);
create index if not exists applications_listing_id_idx on public.applications (listing_id);
create index if not exists applications_user_id_idx on public.applications (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.applications enable row level security;
alter table public.listing_monetization enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public"
  on public.listings for select
  using (true);

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert
  with check (auth.uid() = user_id);

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings for delete
  using (auth.uid() = user_id);

drop policy if exists "applications_select_parties" on public.applications;
create policy "applications_select_parties"
  on public.applications for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.listings l
      where l.id = applications.listing_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "applications_insert_own_not_owner" on public.applications;
create policy "applications_insert_own_not_owner"
  on public.applications for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id <> auth.uid()
    )
  );

drop policy if exists "applications_update_owner" on public.applications;
create policy "applications_update_owner"
  on public.applications for update
  using (
    exists (
      select 1 from public.listings l
      where l.id = applications.listing_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = applications.listing_id and l.user_id = auth.uid()
    )
  );

drop policy if exists "listing_monetization_select_owner" on public.listing_monetization;
create policy "listing_monetization_select_owner"
  on public.listing_monetization for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "listing_images_public_read" on storage.objects;
create policy "listing_images_public_read"
  on storage.objects for select
  using (bucket_id = 'listing-images');

drop policy if exists "listing_images_insert_own_folder" on storage.objects;
create policy "listing_images_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_images_update_own_folder" on storage.objects;
create policy "listing_images_update_own_folder"
  on storage.objects for update
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_images_delete_own_folder" on storage.objects;
create policy "listing_images_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
