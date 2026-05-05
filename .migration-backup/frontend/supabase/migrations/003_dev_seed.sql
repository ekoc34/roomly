-- Roomly: seed listings + auto-confirm test users (for dev/testing)
-- Run AFTER 001 + 002. This is OPTIONAL — only for development testing.

-- 1) Auto-confirm any existing test users so they can log in without email click-through
update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmed_at = coalesce(confirmed_at, now())
  where email like '%@roomly-test.nl'
     or email like '%@uva.nl'
     or email like '%@vu.nl'
     or email like '%@tudelft.nl';

-- 2) Seed: insert sample listings owned by the FIRST user in the system
-- (typically your own test landlord account). Adjust the WHERE clause if needed.
do $$
declare
  owner uuid;
begin
  select id into owner from auth.users order by created_at asc limit 1;
  if owner is null then
    raise notice 'No auth.users present yet — register at least one account, then re-run this.';
    return;
  end if;

  -- Only insert if this owner has no listings yet (idempotent-ish)
  if not exists (select 1 from public.listings where user_id = owner) then
    insert into public.listings (user_id, title, description, price, location, type, images, availability_date)
    values
      (owner,
       'Lichte studio in De Pijp',
       'Volledig gemeubileerde studio op de tweede verdieping, met eigen badkamer en keuken. Op loopafstand van Albert Cuypmarkt en metro.',
       1100, 'De Pijp', 'room_for_rent', '{}', current_date + interval '14 days'),
      (owner,
       'Kamer in studentenhuis Oost',
       'Gezellige kamer (14m²) in een woning met 4 medebewoners. Gedeelde keuken en woonkamer. Studenten welkom.',
       650, 'Oost', 'room_for_rent', '{}', current_date + interval '30 days'),
      (owner,
       'Mede-huurder gezocht — Jordaan',
       'We zoeken een chille mede-huurder voor ons appartement (2 slaapkamers) in de Jordaan. Ideaal voor young professionals.',
       850, 'Jordaan', 'roommate_search', '{}', current_date + interval '7 days'),
      (owner,
       'Kort verblijf — gemeubileerd appartement IJburg',
       'Gemeubileerd 1-slaapkamer appartement met balkon, beschikbaar voor 1-3 maanden. Ideaal voor expats.',
       1450, 'IJburg', 'short_stay', '{}', current_date + interval '3 days'),
      (owner,
       'Ruime kamer in Noord met eigen balkon',
       'Heldere 18m² kamer met eigen balkon en uitzicht op het IJ. Pont naar Centraal in 5 minuten. Inclusief energie en wifi.',
       780, 'Noord', 'room_for_rent', '{}', current_date + interval '21 days'),
      (owner,
       'Compact studio Zuid - dichtbij metro',
       'Compacte gemeubileerde studio (22m²) op steenworp afstand van metro Zuid en de Zuidas. Perfect voor professionals.',
       1250, 'Zuid', 'short_stay', '{}', current_date + interval '10 days');
  end if;
end $$;
