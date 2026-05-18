-- ============================================================
-- MIGRATION: Demo Seed Ecosystem — Welkthuis.nl  (v3)
-- Run in Supabase SQL Editor (after schema.sql and migrations)
-- Safe to re-run: all DDL is idempotent via IF NOT EXISTS / OR REPLACE.
-- To refresh seed data: Admin Dashboard → Demo-inhoud → Verwijder → Genereer
-- ============================================================

-- ── STEP 1: Add is_demo and view_count columns to listings ────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_demo     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count  integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_is_demo
  ON public.listings (is_demo)
  WHERE is_demo = true;

-- ── STEP 2: admin_seed_demo_listings() ───────────────────────
-- IMAGE STRATEGY
--   • Every listing has a unique lead image (first in array)
--   • Student rooms: warm, simple, lived-in bedrooms
--   • Studios: open-plan, modern, clean interiors
--   • Shared houses: living rooms, kitchens, outdoor spaces
--   • Premium/expat: high-end living rooms, bright open kitchens
--   • Penthouses: dramatic views, luxury finishes
--   • Secondary images are thematically appropriate for each type
--   • No two adjacent listings share a visual style
--   • All URLs: Unsplash CDN, 800 px wide, quality 80
CREATE OR REPLACE FUNCTION public.admin_seed_demo_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      UUID    := auth.uid();
  v_count    INTEGER;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.listings WHERE is_demo = true;
  IF v_count > 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.listings (
    user_id, title, description, price, location, type, images,
    availability_date, rooms, surface_area,
    pets_allowed, smoking_allowed, gender_preference,
    is_demo, view_count, boosted_at, created_at
  ) VALUES

  -- ═══════════════════════════════════════════════════════════
  -- AMSTERDAM (12)
  -- ═══════════════════════════════════════════════════════════

  -- 1. Jordaan — student room
  (v_uid,
   'Kamer vlak bij de grachten, Jordaan',
   'Mooie kamer op de eerste etage in een klassiek grachtenpand. Het pand heeft hoge plafonds en originele details die je nergens anders vindt. De kamer is licht, heeft een eigen bureau en een flink bed. Keuken en badkamer deel je met twee andere rustige bewoners. Op loopafstand: Albert Heijn, de Negen Straatjes en tram 13 en 17. Beschikbaar per 1 van de maand.',
   825, 'Jordaan, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 16,
   false, false, 'gemengd',
   true, 47 + floor(random()*180)::int, NULL,
   NOW() - INTERVAL '6 days'),

  -- 2. De Pijp — studio (open-plan studio)
  (v_uid,
   'Rustige studio in De Pijp, alle kosten inbegrepen',
   'Zelfstandige studio op de tweede etage met uitzicht op een binnenplaats. Open keuken met inductiekookplaat en vaatwasser, eigen douche en een ruime slaaphoek met rolluiken. De Pijp bruist buiten de deur, maar binnen is het verrassend stil. Albert Cuyp op loopafstand, metro Vijzelgracht om de hoek. Inclusief gas, water, licht en glasvezel. Direct beschikbaar.',
   1095, 'De Pijp, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1584466977764-c4e0f2f4f898?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 32,
   true, false, NULL,
   true, 89 + floor(random()*140)::int, NOW() - INTERVAL '20 minutes',
   NOW() - INTERVAL '3 days'),

  -- 3. Oud-West — expat apartment
  (v_uid,
   'Gemeubileerd appartement voor expats in Oud-West',
   'Ruim en sfeervol appartement op een van de fijnste straten van Oud-West. Hoge plafonds, stucwerk en moderne meubels vormen een prettige combinatie. De woonkamer heeft veel lichtval, de keuken is volledig uitgerust. Twee slaapkamers, waarvan één met ingebouwde kastruimte. Wifi en wekelijkse schoonmaak zijn inbegrepen. Ideaal voor internationale professionals die direct willen kunnen intrekken. Beschikbaar voor minimaal zes maanden.',
   1650, 'Oud-West, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556910107-5ad8dc45e6d3?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 2, 68,
   false, false, NULL,
   true, 112 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '12 hours'),

  -- 4. Bos en Lommer — budget student room
  (v_uid,
   'Studentenkamer in rustig huis, Bos en Lommer',
   'Beschikbare kamer van 14 m² in een goed onderhouden studentenhuis. We wonen hier met vier mensen; de sfeer is rustig en vriendelijk. Gedeelde woonkamer, moderne keuken en één badkamer. Alle kosten inclusief. Tramhalte voor de deur, metro op vijf minuten lopen. Perfect voor iemand die een betaalbare plek zoekt zonder gedoe.',
   625, 'Bos en Lommer, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522252234503-e356d0b58374?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '3 days')::date, 1, 14,
   false, false, NULL,
   true, 28 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '2 days'),

  -- 5. Centrum — premium canal apartment
  (v_uid,
   'Stijlvol grachtenpand met hoge plafonds, Centrum',
   'Uitzonderlijk appartement aan een van de rustigste grachten van Amsterdam. De woonkamer heeft een open haard, originele balken en uitzicht op het water. De keuken is recent volledig gerenoveerd met Miele-apparatuur. Ensuite slaapkamer met aangrenzende badkamer. Derde slaapkamer geschikt als thuiskantoor. Eigen parkeerplaats in de straat mogelijk. Beschikbaar voor lange termijn bij betrouwbare huurder.',
   2250, 'Centrum, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1633110186-3c62e97c8f39?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1616137884-71ea00ab9ea7?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 3, 105,
   false, false, NULL,
   true, 198 + floor(random()*80)::int, NOW() - INTERVAL '45 minutes',
   NOW() - INTERVAL '1 day'),

  -- 6. Amsterdam-Noord — roommate search
  (v_uid,
   'Huisgenoot gezocht — groot huis met tuin, Noord',
   'We zijn met twee — een grafisch ontwerper en een verpleegkundige — en zoeken een derde huisgenoot voor ons ruime huis in Amsterdam-Noord. Eigen slaapkamer van 18 m², grote woonkamer en een achtertuin waar we in de zomer regelmatig iets eten. Gezellig maar ook rustig genoeg als je even wil afschakelen. Huisdieren zijn welkom. GWE inbegrepen in de huurprijs.',
   745, 'Amsterdam-Noord, Amsterdam', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1586190848816-788462504855?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1524758631624-e2822132143f?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1591825729538-b18f2a1a3de3?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 18,
   true, false, 'gemengd',
   true, 53 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '4 days'),

  -- 7. Oost — student studio
  (v_uid,
   'Zelfstandige studio dicht bij UvA, Amsterdam Oost',
   'Studio van 26 m² op de begane grond in een rustige straat in Oost. Eigen keuken met inductiekookplaat en koelkast, eigen douche en toilet. Veel daglicht door de grote ramen aan de tuinzijde. Goed verbonden: tram 3 en 7 voor de deur, UvA Science Park op de fiets bereikbaar. Geschikt voor student of young professional. Exclusief GWE.',
   895, 'Oost, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1553444836-bc0c1f5c7ab1?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1505873242700-f6dff42bdb47?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 26,
   false, false, NULL,
   true, 34 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '5 days'),

  -- 8. Oud-Zuid — short stay near Museumplein
  (v_uid,
   'Short stay appartement nabij Vondelpark — 1 t/m 6 mnd',
   'Volledig ingericht appartement op loopafstand van het Vondelpark en Museumplein. De woning is compact maar goed ingedeeld: een open woonkeuken, comfortabele slaapkamer en een nette badkamer. Alle meubels, beddengoed, handdoeken en keukengerei aanwezig. Wifi en alle vaste lasten inbegrepen. Beschikbaar voor verblijven van één tot zes maanden. Ideaal voor internationale bezoekers en expats op tijdelijk contract.',
   1850, 'Oud-Zuid, Amsterdam', 'short_stay',
   ARRAY[
     'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1615874959474-d609be05944d?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 72,
   false, false, NULL,
   true, 145 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '8 hours'),

  -- 9. Westerpark — unfurnished apartment with balcony
  (v_uid,
   'Licht 3-kamer appartement met balkon, Westerpark',
   'Ruim appartement op de tweede etage met een zonnig balkon op het westen. De open woonkeuken loopt over in een gezellige eethoek. Twee slaapkamers — één met openslaande deuren naar het balkon. Ongemeubileerd zodat je het helemaal naar je eigen smaak kunt inrichten. Westergas om de hoek, veel goede cafés en restaurants in de buurt. Huurprijs exclusief GWE.',
   1395, 'Westerpark, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1519710164239-da1a0e65c4e0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1554995207-c5c7de50e9c0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '21 days')::date, 3, 85,
   false, false, NULL,
   true, 67 + floor(random()*120)::int, NULL,
   NOW() - INTERVAL '9 days'),

  -- 10. Indische Buurt — furnished studio for expats
  (v_uid,
   'Gemeubileerde studio in de Indische Buurt, direct in te trekken',
   'Volledig ingerichte studio van 30 m² in de sfeervolle Indische Buurt. Alles wat je nodig hebt is aanwezig: bed, bureau, bank, eettafel, en een complete keuken. Eigen badkamer met inloopdouche. Gas, water, licht en glasvezel zijn inbegrepen. Op de fiets ben je in twintig minuten in het centrum. Tramhalte Javaplein op twee minuten loopafstand.',
   975, 'Indische Buurt, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1513694203232-719a6ca23e9b?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 30,
   false, false, NULL,
   true, 41 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '11 days'),

  -- 11. IJburg — waterfront roommate search
  (v_uid,
   'Mede-bewoner gezocht, modern waterfronthuis IJburg',
   'Zoek jij rust, ruimte én uitzicht op het water? Ons huis op IJburg heeft dat allemaal. We zoeken één nieuwe bewoner voor de vrijgekomen slaapkamer van 22 m². De woonkamer heeft een grote terrasdeur die uitkomt op het houten dek aan het water. Moderne keuken, inpandige berging en parkeerplaats beschikbaar. GWE exclusief, nader overeen te komen. Voorkeur voor iemand die zelfstandig is maar ook van samenzijn houdt.',
   820, 'IJburg, Amsterdam', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1558618047-9d0e3c01b65e?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1552321554-3ceeff8c5c73?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 1, 22,
   true, false, NULL,
   true, 38 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '13 days'),

  -- 12. Zuidas — penthouse
  (v_uid,
   'Penthouse op de 14e etage, panoramisch uitzicht, Zuidas',
   'Weinig woningen in Amsterdam bieden dit soort uitzicht. Op de veertiende verdieping aan de Zuidas ligt dit penthouse van 130 m² met een ruim dakterras en een onbelemmerd uitzicht over de stad. De woonkamer is licht en groot, de keuken is voorzien van premium apparatuur, en de badkamer heeft een vrijstaand bad en regendouche. Drie slaapkamers, inpandige garage en portiersdienst. Beschikbaar voor de langere termijn bij een solvabele huurder.',
   2850, 'Zuidas, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600607687939-9bbc18e7e3d0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 3, 130,
   false, false, NULL,
   true, 210 + floor(random()*60)::int, NOW() - INTERVAL '10 minutes',
   NOW() - INTERVAL '2 days'),

  -- ═══════════════════════════════════════════════════════════
  -- UTRECHT (8)
  -- ═══════════════════════════════════════════════════════════

  -- 13. Binnenstad — student room
  (v_uid,
   'Kamer in klassiek pand, loopafstand Domtoren',
   'Beschikbare kamer van 15 m² in een oud Utrechts pand op de binnenstad. Hoge plafonds, originele vloeren en genoeg kastruimte. Je deelt de woonkamer, keuken en badkamer met drie medestudenten. De sfeer in huis is open en vriendelijk — we eten soms samen, maar niemand verwacht dat. Alle kosten inclusief. Beschikbaar per 1 september, maar eerder kan ook in overleg.',
   595, 'Binnenstad, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1522252234503-e356d0b58374?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '45 days')::date, 1, 15,
   false, false, 'gemengd',
   true, 62 + floor(random()*120)::int, NULL,
   NOW() - INTERVAL '2 days'),

  -- 14. Lombok — studio
  (v_uid,
   'Moderne studio in trendy Lombok, Utrecht',
   'Studio van 34 m² in een recent gerenoveerd pand midden in Lombok. De indeling is goed: open keuken met bar, ruime slaaphoek en een eigen badkamer met inloopdouche. Nog niet gemeubileerd, dus jij bepaalt hoe je het inricht. Lombok heeft een prettige buurtsfeer met diverse markten, internationale restaurants en goede koffietentjes. Op de fiets naar het centrum in tien minuten. Huisdieren in overleg.',
   950, 'Lombok, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556910107-5ad8dc45e6d3?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 34,
   true, false, NULL,
   true, 45 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '6 days'),

  -- 15. Wittevrouwen — apartment with south-facing balcony
  (v_uid,
   'Appartement met zonnig balkon op het zuiden, Wittevrouwen',
   'Fijn driekamerappartement op de derde etage in de populaire wijk Wittevrouwen. Lichte woonkamer met schuifdeuren naar het balkon, twee slaapkamers en een moderne badkamer. De buurt heeft karakter: veel groene straten, leuke cafés en het Wilhelminapark op loopafstand. Huurprijs exclusief GWE. Beschikbaar per midden van de maand.',
   1225, 'Wittevrouwen, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 2, 78,
   false, false, NULL,
   true, 78 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '4 days'),

  -- 16. Lunetten — shared house roommate
  (v_uid,
   'Medebewoner gevraagd voor groot gezinshuis, Lunetten',
   'Ruim vrijstaand huis in Lunetten zoekt een volwassen bewoner. Eigen slaapkamer van 20 m², grote gedeelde woonkamer en een tuin die in de zomer veel gebruikt wordt. We zijn twee werkende twintigers en hechten aan zowel gezelligheid als rust. Goede bereikbaarheid via de A27. Garage voor fiets of auto beschikbaar. GWE wordt gedeeld en eerlijk verdeeld.',
   700, 'Lunetten, Utrecht', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1554995207-c5c7de50e9c0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1586190848816-788462504855?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1591825729538-b18f2a1a3de3?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 20,
   true, false, NULL,
   true, 29 + floor(random()*60)::int, NULL,
   NOW() - INTERVAL '8 days'),

  -- 17. Overvecht — budget room
  (v_uid,
   'Betaalbare kamer in schoon studentenhuis, Overvecht',
   'Kamer van 12 m² in een rustig huis in Overvecht. Gedeelde keuken, badkamer en woonkamer. Alle kosten inclusief gas, water, licht en internet. Buslijn 3 brengt je in twintig minuten naar Utrecht Centraal. Geschikt voor studenten of starters die een betaalbare en nette plek zoeken zonder extra poespas.',
   565, 'Overvecht, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1513694203232-719a6ca23e9b?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 12,
   false, false, 'gemengd',
   true, 18 + floor(random()*50)::int, NULL,
   NOW() - INTERVAL '15 days'),

  -- 18. Leidsche Rijn — new-build studio
  (v_uid,
   'Gloednieuwe studio in nieuwbouw, Leidsche Rijn',
   'Nooit eerder bewoond. Studio van 38 m² in een modern nieuwbouwproject in Leidsche Rijn met energielabel A. Vloerverwarming door de hele woning, inloopdouche, nieuw keukenblok en veel opbergruimte. Inpandige fietsenstalling en privéberging. Rustige wijk met goede verbinding naar Utrecht Centraal via de sneltram. Lage energiekosten door de duurzame installaties.',
   1050, 'Leidsche Rijn, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1615874959474-d609be05944d?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '21 days')::date, 1, 38,
   false, false, NULL,
   true, 56 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '3 days'),

  -- 19. Utrecht Centrum — expat short-stay
  (v_uid,
   'Volledig ingericht expat appartement aan de Oudegracht',
   'Prachtig appartement direct aan de Oudegracht, het mooiste stukje van Utrecht. Twee kamers, volledig gemeubileerd met alles wat je nodig hebt: meubels, wit- en bruingoed, beddengoed en keukengerei. Wifi, tv en alle kosten inbegrepen. Uitzicht op de gracht vanuit de woonkamer. Beschikbaar voor een minimum van drie maanden. Ideaal voor expats of professionals die tijdelijk in Utrecht werken.',
   1525, 'Centrum, Utrecht', 'short_stay',
   ARRAY[
     'https://images.unsplash.com/photo-1616137884-71ea00ab9ea7?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1633110186-3c62e97c8f39?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 62,
   false, false, NULL,
   true, 93 + floor(random()*110)::int, NOW() - INTERVAL '30 minutes',
   NOW() - INTERVAL '1 day'),

  -- 20. Oudegracht — short stay canal apartment
  (v_uid,
   'Uniek grachtenappartement voor kort verblijf, Utrecht',
   'Er zijn niet veel plekken in Utrecht waar je zo direct aan het water woont. Dit appartement heeft een eigen terras op de werf — in de zomer is dat onbetaalbaar. Beschikbaar voor verblijven van twee weken tot drie maanden. Volledig ingericht, alle kosten inbegrepen. De wijk barst van de fijne terrassen en winkels. Een plek om Utrecht echt te leren kennen.',
   1375, 'Oudegracht, Utrecht', 'short_stay',
   ARRAY[
     'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 58,
   false, false, NULL,
   true, 121 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '5 days'),

  -- ═══════════════════════════════════════════════════════════
  -- ROTTERDAM (8)
  -- ═══════════════════════════════════════════════════════════

  -- 21. Kralingen — student room near Erasmus
  (v_uid,
   'Studentenkamer vlak bij Erasmus Universiteit, Kralingen',
   'Kamer van 17 m² in een gezellig studentenhuis op loopafstand van de Erasmus Universiteit en het Kralingse Bos. We wonen hier met vijf studenten; er is altijd iets te beleven maar niemand bemoeit zich met je. Grote gedeelde keuken, eigen woonkamer en een tuin. GWE inclusief. Beschikbaar per einde van de maand.',
   715, 'Kralingen, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1524758631624-e2822132143f?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 1, 17,
   false, false, NULL,
   true, 44 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '7 days'),

  -- 22. Rotterdam Centrum — studio near station
  (v_uid,
   'Compacte studio in het centrum, alles op loopafstand',
   'Studio van 30 m² op de derde etage in het hart van Rotterdam. Volledig uitgerust: inductiekookplaat, koelkast, vaatwasser en eigen badkamer. Liftgebouw. Rotterdam Centraal, de Markthal en de Binnenrotte zijn op vijf minuten loopafstand. Inclusief glasvezel internet. Ideaal als je elke dag vanuit Rotterdam reist of weinig tijd wil verliezen aan het woon-werktraject.',
   1025, 'Centrum, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 30,
   false, false, NULL,
   true, 72 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '10 days'),

  -- 23. Hillegersberg — premium villa apartment
  (v_uid,
   'Ruim villa-appartement in het groene Hillegersberg',
   'Exclusief appartement van 120 m² in een statige villa in Hillegersberg. Riante woonkamer met openhaard, drie slaapkamers, twee badkamers en een groot terras dat grenst aan de tuin. De keuken is recent vernieuwd met Siemens-apparatuur. Ongemeubileerd — ideaal voor een gezin of twee professionals die samen willen wonen in een hoogwaardig pand. Huurprijs exclusief GWE.',
   1950, 'Hillegersberg, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600607687939-9bbc18e7e3d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 4, 120,
   false, false, NULL,
   true, 163 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '3 days'),

  -- 24. Delfshaven — international roommate search
  (v_uid,
   'Internationaal huis zoekt nieuwe huisgenoot, Delfshaven',
   'Ons huis in Delfshaven is een mix van nationaliteiten — momenteel wonen hier mensen uit Nederland, Spanje en Brazilië. We zoeken een vierde bewoner voor de beschikbare kamer van 16 m². Gedeelde woonkamer, grote keuken en een tuin die we in de zomer goed gebruiken. Internationale en sociale sfeer. GWE apart. Voorkeur voor iemand die open is en af en toe meedoet.',
   685, 'Delfshaven, Rotterdam', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1591825729538-b18f2a1a3de3?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1586190848816-788462504855?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1524758631624-e2822132143f?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '3 days')::date, 1, 16,
   false, false, NULL,
   true, 35 + floor(random()*70)::int, NULL,
   NOW() - INTERVAL '6 days'),

  -- 25. IJsselmonde — budget room with garden
  (v_uid,
   'Betaalbare kamer met gebruik van grote tuin, IJsselmonde',
   'Rustige kamer van 13 m² in een woonhuis in IJsselmonde. De achtertuin is groot en wordt door alle bewoners gebruikt. Je deelt de keuken en badkamer met twee anderen. Kosten inclusief GWE. Metrostation Slinge is op vijf minuten lopen. Een goede plek voor iemand die weinig budget heeft maar toch zijn eigen plek wil.',
   575, 'IJsselmonde, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1574691250077-03a929faece5?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '5 days')::date, 1, 13,
   false, false, NULL,
   true, 21 + floor(random()*50)::int, NULL,
   NOW() - INTERVAL '14 days'),

  -- 26. Katendrecht — expat apartment with harbour view
  (v_uid,
   'Gerenoveerd appartement met havenzicht, Katendrecht',
   'Katendrecht is de leukste plek van Rotterdam en dit appartement bewijst dat. Volledig gerenoveerd, twee kamers, grote open keuken en een eigen balkon met zicht op de haven. Modern meubilair aanwezig. Fenix Food Factory en diverse terrasjes op loopafstand. Alle kosten inclusief. Ideaal voor expats of internationals die Rotterdam snel willen leren kennen.',
   1375, 'Katendrecht, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1616137884-71ea00ab9ea7?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 2, 65,
   false, false, NULL,
   true, 87 + floor(random()*110)::int, NOW() - INTERVAL '55 minutes',
   NOW() - INTERVAL '2 days'),

  -- 27. Blijdorp — student studio near zoo
  (v_uid,
   'Studio voor student of starter, Blijdorp Rotterdam',
   'Compacte maar goed ingedeelde studio van 24 m² in Blijdorp, vlakbij Diergaarde Blijdorp. Eigen keuken, eigen badkamer en veel daglicht. Energiezuinig pand. Metrostation Blijdorp op drie minuten. Kosten exclusief GWE. Een fijne uitvalsbasis in een rustige straat, met het centrum op tien minuten fietsen.',
   865, 'Blijdorp, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1553444836-bc0c1f5c7ab1?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 24,
   false, false, NULL,
   true, 49 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '11 days'),

  -- 28. Rotterdam-Zuid — penthouse with Maas view
  (v_uid,
   'Exclusief penthouse met Maas-uitzicht, 12e verdieping',
   'Uitzonderlijk penthouse van 140 m² met een wraparound terras en een 360°-uitzicht over de Maas en de skyline van Rotterdam. Drie slaapkamers, twee badkamers, een chef-keuken en een stoel om gewoon te zitten kijken naar de stad. Parkeerplaats en opslagruimte inbegrepen. Beschikbaar voor lange termijn. Interesse? Neem contact op voor een bezichtiging.',
   2550, 'Rotterdam-Zuid, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1519710164239-da1a0e65c4e0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1615874959474-d609be05944d?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 3, 140,
   false, false, NULL,
   true, 187 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '1 day'),

  -- ═══════════════════════════════════════════════════════════
  -- EINDHOVEN (7)
  -- ═══════════════════════════════════════════════════════════

  -- 29. Stratum — student room near TU/e
  (v_uid,
   'Kamer op fietsafstand van TU/e en Fontys, Stratum',
   'Kamer van 14 m² in een gezellig studentenhuis in Stratum. We zijn met drie studenten, allemaal van de TU/e of Fontys. Keuken, woonkamer en badkamer gedeeld. Meubels aanwezig. Alle kosten inclusief. Op de fiets ben je in tien minuten op beide campussen. Beschikbaar per direct.',
   545, 'Stratum, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1593696140826-24b07bce6b27?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 14,
   false, false, 'gemengd',
   true, 33 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '9 days'),

  -- 30. Strijp-S — creative studio
  (v_uid,
   'Loftstudio in creatief Strijp-S, Eindhoven',
   'Sfeervolle studio van 35 m² in het hart van Strijp-S, het creatieve district van Eindhoven. Het pand heeft een industrieel karakter: hoge ramen, betonnen vloer en een mezzanine slaapverdieping. Eigen keuken en badkamer. Omgeven door designstudio''s, ateliers en innovatieve bedrijven. Perfect voor ontwerpers, techneuten of creatieven die inspiratie willen inademen waar ze wonen.',
   855, 'Strijp-S, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1556910107-5ad8dc45e6d3?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 35,
   false, false, NULL,
   true, 58 + floor(random()*100)::int, NOW() - INTERVAL '40 minutes',
   NOW() - INTERVAL '4 days'),

  -- 31. Woensel — expat apartment for ASML/Philips
  (v_uid,
   'Gemeubileerd appartement voor tech-professionals, Woensel',
   'Modern en volledig ingericht tweekkamerappartement in Woensel, direct beschikbaar. Specifiek aantrekkelijk voor medewerkers van ASML, NXP of Philips. Open woonkeuken, slaapkamer met ingebouwde kast, eigen badkamer en balkon. Glasvezel internet en alle kosten inbegrepen. Parkeerplaats beschikbaar. Zowel korte als lange termijn mogelijk — bespreekbaar bij bezichtiging.',
   1175, 'Woensel, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1558618047-9d0e3c01b65e?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 60,
   false, false, NULL,
   true, 75 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '5 days'),

  -- 32. Tongelre — budget room
  (v_uid,
   'Kamer in rustige woonwijk, lage kosten, Tongelre',
   'Kamer van 12 m² in een nette woning in Tongelre. Je woont hier met één andere bewoner — rustig en praktisch. Gedeelde keuken en badkamer. Alle kosten inclusief gas, water en licht. Buslijn naar het centrum. Ideaal als je het rustig wil aandoen en weinig budget hebt.',
   490, 'Tongelre, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1552321554-3ceeff8c5c73?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '10 days')::date, 1, 12,
   false, false, NULL,
   true, 14 + floor(random()*40)::int, NULL,
   NOW() - INTERVAL '16 days'),

  -- 33. Gestel — roommate search
  (v_uid,
   'Tweede huisgenoot gezocht voor groen huis, Gestel',
   'We zijn met één — een werkende dertiger — en zoeken een tweede bewoner voor ons huis in Gestel. Ruime slaapkamer van 19 m², grote woonkamer, moderne keuken en een zonnige achtertuin. Rustige wijk, goed bereikbaar via de ring. We hechten aan gezelligheid maar respecteren ook elkaars privacy. Huisdieren in overleg bespreekbaar.',
   625, 'Gestel, Eindhoven', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1584466977764-c4e0f2f4f898?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1586190848816-788462504855?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1574691250077-03a929faece5?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '21 days')::date, 1, 19,
   true, false, NULL,
   true, 27 + floor(random()*60)::int, NULL,
   NOW() - INTERVAL '12 days'),

  -- 34. Centrum Eindhoven — modern studio
  (v_uid,
   'Stijlvolle studio centraal in Eindhoven, energielabel B',
   'Eigentijdse studio van 32 m² in het centrum van Eindhoven, op loopafstand van het station en de Heuvelgalerie. Modern keukenblok, nette badkamer en veel opbergruimte. Energielabel B. Ideaal voor een young professional of internationale medewerker die elke dag het stadscentrum als achtertuin heeft. Inclusief glasvezel.',
   895, 'Centrum, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 32,
   false, false, NULL,
   true, 64 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '3 days'),

  -- 35. Meerhoven — premium apartment with garage
  (v_uid,
   'Luxe 3-kamer appartement met garage, Meerhoven',
   'Ruim en duurzaam appartement in het groene en rustige Meerhoven. Drie kamers, vloerverwarming, zonnepanelen, eigen garage en een royaal terras. Hoogwaardige afwerking en energielabel A++. De wijk is groen en rustig maar toch goed verbonden. Geschikt voor een gezin of professionals die kwaliteit, comfort en rust belangrijk vinden.',
   1425, 'Meerhoven, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1600607687939-9bbc18e7e3d0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1633110186-3c62e97c8f39?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 3, 95,
   false, false, NULL,
   true, 102 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '2 days');

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_seed_demo_listings() TO authenticated;

-- ── STEP 3: admin_delete_demo_listings() ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_demo_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  DELETE FROM public.listings WHERE is_demo = true;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_demo_listings() TO authenticated;

-- ── STEP 4: admin_demo_listing_count() ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_demo_listing_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.listings WHERE is_demo = true;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_demo_listing_count() TO authenticated;
