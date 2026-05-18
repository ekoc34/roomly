-- ============================================================
-- MIGRATION: Demo Seed Ecosystem — Welkthuis.nl  (v2)
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
--   • Images are grouped by type: student/studio/apartment/shared/premium
--   • City-adjacent listings use visually distinct lead images
--   • Secondary images are thematically appropriate for each type
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
  -- lead images: all visually distinct; warm/urban/residential palette
  -- ═══════════════════════════════════════════════════════════

  -- 1. Jordaan — student room (minimalist white room lead)
  (v_uid,
   'Gemeubileerde studentenkamer in de Jordaan',
   'Lichte, gemeubileerde kamer op de eerste verdieping in het hart van de Jordaan. Eigen bureau, bed en kast aanwezig. Gedeelde badkamer en keuken met maximaal twee huisgenoten. Op loopafstand van de grachten, supermarkten en OV. Perfecte plek voor studenten of young professionals.',
   825, 'Jordaan, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1552321554-3ceeff8c5c73?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 16,
   false, false, 'gemengd',
   true, 47 + floor(random()*180)::int, NULL,
   NOW() - INTERVAL '6 days'),

  -- 2. De Pijp — studio (open-plan studio lead)
  (v_uid,
   'Gezellige studio in De Pijp',
   'Zelfstandige studio met open keuken, eigen badkamer en slaaphoek. Gelegen in de bruisende Pijp, vlakbij de Albert Cuypmarkt. Volledig gemeubileerd en direct beschikbaar. Inclusief internet. Ideaal voor expats en starters.',
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

  -- 3. Oud-West — expat apartment (cozy living room lead)
  (v_uid,
   'Modern expat appartement in Oud-West',
   'Prachtig ingericht 2-kamer appartement in het gewilde Oud-West. Hoge plafonds, originele details en modern meubilair. Beschikt over een volledig uitgeruste keuken, ruime woonkamer en slaapkamer. Inclusief wifi, Netflix en wekelijkse schoonmaakservice. Ideaal voor internationale professionals.',
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

  -- 4. Bos en Lommer — budget room (simple bright bedroom lead)
  (v_uid,
   'Betaalbare kamer in Bos en Lommer',
   'Rustige kamer van 14 m² in een gezellig studentenhuis. Kosten koper inclusief GWE. Gedeelde woonkamer, keuken en badkamer met drie andere bewoners. Goed bereikbaar via tram en metro. Ideaal voor studenten met een krap budget.',
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

  -- 5. Centrum — premium gracht (luxury apartment lead)
  (v_uid,
   'Luxe gracht appartement in het Centrum',
   'Uitzonderlijk ruim en stijlvol appartement aan een van de mooiste grachten van Amsterdam. Originele grachtenpand met hoge plafonds, ensuite slaapkamer, moderne open keuken en eigen parkeerplaats. Volledig gemeubileerd met design meubels. Beschikbaar voor lange termijn.',
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

  -- 6. Amsterdam-Noord — shared house (shared living room lead)
  (v_uid,
   'Huisgenoot gezocht in gezellig huis Amsterdam-Noord',
   'Wij zoeken een derde huisgenoot voor ons ruime huis in Amsterdam-Noord. Eigen slaapkamer van 18 m², grote gedeelde woonkamer, tuin en moderne keuken. Huisdieren welkom. Fijn huis met een goede sfeer, we eten regelmatig samen. GWE inclusief, klaar om in te trekken.',
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

  -- 7. Oost — student studio (modern dark-toned interior lead)
  (v_uid,
   'Studentenstudio in Amsterdam Oost',
   'Zelfstandige studio van 26 m² in rustige straat in Oost. Eigen keuken (inductiekookplaat, koelkast, magnetron), eigen douche en toilet. Lichte ruimte op de begane grond. Goed verbonden met het centrum en de UvA. Geschikt voor studenten en young professionals.',
   895, 'Oost, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1505873242700-f6dff42bdb47?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 26,
   false, false, NULL,
   true, 34 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '5 days'),

  -- 8. Oud-Zuid — short stay (penthouse-view lead)
  (v_uid,
   'Kort verblijf appartement nabij Museumplein',
   'Stijlvol gemeubileerd appartement op loopafstand van het Museumplein, Vondelpark en de bekendste musea van Amsterdam. Beschikbaar voor short stay van 1 tot 6 maanden. Volledig ingericht, alle kosten inclusief. Perfect voor internationale bezoekers en expats.',
   1850, 'Oud-Zuid, Amsterdam', 'short_stay',
   ARRAY[
     'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1615874959474-d609be05944d?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 72,
   false, false, NULL,
   true, 145 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '8 hours'),

  -- 9. Westerpark — apartment (bright modern living room lead)
  (v_uid,
   'Ruim appartement in Westerpark',
   'Licht en ruim 3-kamer appartement op de tweede verdieping in het populaire Westerpark. Open woonkeuken, twee slaapkamers en eigen balkon. Ongemeubileerd, zodat je er helemaal jouw eigen thuis van kunt maken. Nabij Westergas en diverse trendy restaurants en cafés.',
   1395, 'Westerpark, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1554995207-c5c7de50e9c0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1519710164239-da1a0e65c4e0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '21 days')::date, 3, 85,
   false, false, NULL,
   true, 67 + floor(random()*120)::int, NULL,
   NOW() - INTERVAL '9 days'),

  -- 10. Indische Buurt — furnished studio (compact studio lead)
  (v_uid,
   'Gemeubileerde studio in de Indische Buurt',
   'Volledig gemeubileerde studio met eigen badkamer en keuken in de sfeervolle Indische Buurt. Alle kosten inclusief: gas, water, elektriciteit en internet. Op fietsafstand van het centrum. Ideaal voor expats of young professionals die direct willen kunnen intrekken.',
   975, 'Indische Buurt, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1553444836-bc0c1f5c7ab1?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1513694203232-719a6ca23e9b?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 30,
   false, false, NULL,
   true, 41 + floor(random()*100)::int, NULL,
   NOW() - INTERVAL '11 days'),

  -- 11. IJburg — waterfront roommate (minimal loft-ish lead)
  (v_uid,
   'Huisgenoot gezocht voor waterfront woning IJburg',
   'Zoek jij een rustige en schone woning met uitzicht op het water? Wij zoeken een derde bewoner voor ons moderne huis op IJburg. Eigen slaapkamer van 22 m², grote woonkamer, terras aan het water en inpandige parkeerplaats. GWE niet inbegrepen. Hartelijk welkom voor een bezichtiging!',
   820, 'IJburg, Amsterdam', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1505873242700-f6dff42bdb47?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1558618047-9d0e3c01b65e?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 1, 22,
   true, false, NULL,
   true, 38 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '13 days'),

  -- 12. Zuidas — penthouse (luxury living room lead, clearly premium)
  (v_uid,
   'Penthouse met panoramisch uitzicht op de Zuidas',
   'Exclusief penthouse van 130 m² op de 14e verdieping met adembenemend uitzicht over Amsterdam. Beschikt over een luxe open keuken, spa badkamer, drie slaapkamers en een ruim dakterras. Volledig gemeubileerd met premium designmeubels. Inclusief parkeerplaats en portier. Voor de meest veeleisende huurder.',
   2850, 'Zuidas, Amsterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600607687939-9bbc18e7e3d0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1615874959474-d609be05944d?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 3, 130,
   false, false, NULL,
   true, 210 + floor(random()*60)::int, NOW() - INTERVAL '10 minutes',
   NOW() - INTERVAL '2 days'),

  -- ═══════════════════════════════════════════════════════════
  -- UTRECHT (8)
  -- lead images: warmer Dutch-city palette, distinct from Amsterdam
  -- ═══════════════════════════════════════════════════════════

  -- 13. Binnenstad — student room (warm bright bedroom lead)
  (v_uid,
   'Studentenkamer in het hart van Utrecht',
   'Kamer van 15 m² op de eerste verdieping in een klassiek Utrechts pand op de binnenstad. Gedeelde woonkamer, keuken en badkamer met drie studenten. Alle kosten inbegrepen. Op loopafstand van de Universiteitsbibliotheek, Domtoren en het centrum. Beschikbaar per 1 september.',
   595, 'Binnenstad, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1522252234503-e356d0b58374?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '45 days')::date, 1, 15,
   false, false, 'gemengd',
   true, 62 + floor(random()*120)::int, NULL,
   NOW() - INTERVAL '2 days'),

  -- 14. Lombok — studio (single-bed room in warm tones lead)
  (v_uid,
   'Moderne studio in Lombok Utrecht',
   'Zelfstandige studio van 34 m² in het trendy Lombok. Open keuken, eigen badkamer en royale slaaphoek. Volledig ongemeubileerd, zodat je het naar eigen smaak kunt inrichten. Op fietsafstand van het centrum en de universiteit. Huisdieren in overleg.',
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

  -- 15. Wittevrouwen — apartment (light bedroom/living hybrid lead)
  (v_uid,
   'Ruim appartement in Wittevrouwen',
   'Prachtig 3-kamer appartement op de derde verdieping in de populaire Wittevrouwen-wijk. Lichte woonkamer, twee slaapkamers, moderne badkamer en een zonnig balkon op het zuiden. Nabij het Wilhelminapark en diverse leuke restaurants en cafés. Huurprijs exclusief GWE.',
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

  -- 16. Lunetten — shared house (airy bright living room lead)
  (v_uid,
   'Huisgenoot gezocht in groot gezinshuis Lunetten',
   'Groot gezinshuis in Lunetten zoekt een volwassen huisgenoot. Eigen slaapkamer van 20 m², grote gedeelde woonkamer, tuin en garage. Rustige en groene buurt, goed bereikbaar via A27. Auto met parkeerplaats is mogelijk. GWE gedeeld. Voorkeur voor professional of PhD-student.',
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

  -- 17. Overvecht — budget room (wood-toned bedroom lead)
  (v_uid,
   'Betaalbare kamer in Overvecht Utrecht',
   'Kamer van 12 m² in een rustig studentenhuis in Overvecht. Kosten inclusief gas, water, elektriciteit en internet. Goed bereikbaar per bus richting het centrum. Ideaal voor studenten of starters met een beperkt budget. Gedeelde faciliteiten netjes en schoon.',
   565, 'Overvecht, Utrecht', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1513694203232-719a6ca23e9b?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 12,
   false, false, 'gemengd',
   true, 18 + floor(random()*50)::int, NULL,
   NOW() - INTERVAL '15 days'),

  -- 18. Leidsche Rijn — new-build studio (premium-feel interior lead)
  (v_uid,
   'Moderne studio in nieuwbouw Leidsche Rijn',
   'Gloednieuwe studio van 38 m² in een modern nieuwbouwproject in Leidsche Rijn. Volledig nieuw keukenblok, inloopdouche en vloerverwarming. Energielabel A, zeer lage energiekosten. Inpandige fietsenstalling en privé berging. Rustige wijk, goed verbonden met Utrecht Centraal.',
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

  -- 19. Utrecht Centrum — expat short-stay (luxury kitchen lead)
  (v_uid,
   'Volledig gemeubileerd expat appartement Utrecht Centrum',
   'Stijlvol ingericht 2-kamer appartement op de Oudegracht, het mooiste stukje van Utrecht. Inclusief alle meubels, wit- en bruingoed, beddengoed en keukengerei. Wifi en alle kosten inbegrepen. Beschikbaar voor minimaal 3 maanden. Ideaal voor internationale professionals of expats.',
   1525, 'Centrum, Utrecht', 'short_stay',
   ARRAY[
     'https://images.unsplash.com/photo-1616137884-71ea00ab9ea7?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 62,
   false, false, NULL,
   true, 93 + floor(random()*110)::int, NOW() - INTERVAL '30 minutes',
   NOW() - INTERVAL '1 day'),

  -- 20. Oudegracht — short-stay canal apt (modern apt overview lead)
  (v_uid,
   'Sfeervol kort verblijf appartement aan de Oudegracht',
   'Uniek appartement aan de Oudegracht met direct uitzicht op het water. Beschikbaar voor kort verblijf van 2 weken tot 3 maanden. Volledig ingericht, alle kosten inbegrepen. Eigen terras aan de gracht. Een plek die Utrecht op zijn mooiste laat zien.',
   1375, 'Oudegracht, Utrecht', 'short_stay',
   ARRAY[
     'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 2, 58,
   false, false, NULL,
   true, 121 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '5 days'),

  -- ═══════════════════════════════════════════════════════════
  -- ROTTERDAM (8)
  -- lead images: urban/industrial character, distinct from other cities
  -- ═══════════════════════════════════════════════════════════

  -- 21. Kralingen — student room (fresh bedroom lead)
  (v_uid,
   'Studentenkamer in groen Kralingen',
   'Kamer van 17 m² in een studentenhuis vlakbij het Kralingse Bos en de Erasmus Universiteit. Gezellig huis met vijf studenten, grote gedeelde keuken en woonkamer. Tuin beschikbaar. Kosten inclusief GWE. Ideaal voor Erasmus-studenten.',
   715, 'Kralingen, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1524758631624-e2822132143f?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 1, 17,
   false, false, NULL,
   true, 44 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '7 days'),

  -- 22. Rotterdam Centrum — studio (building exterior / urban lead)
  (v_uid,
   'Centrale studio in Rotterdam-Centrum',
   'Moderne studio van 30 m² op de derde verdieping in het centrum van Rotterdam. Volledig uitgerust: inductiekookplaat, koelkast, vaatwasser en eigen douche. Liftgebouw. Op loopafstand van Rotterdam Centraal, de Markthal en het Centraal Station. Inclusief internet.',
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

  -- 23. Hillegersberg — premium villa apt (house/villa exterior lead)
  (v_uid,
   'Luxe villa-appartement in Hillegersberg',
   'Exclusief 4-kamer appartement in het luxe Hillegersberg. Beschikt over een riante woonkamer, drie slaapkamers, twee badkamers en een grote tuinterras. Hoogwaardige keuken met Siemens apparatuur. Beschikbaar ongemeubileerd. Ideaal voor gezinnen of professionals met hoge wensen.',
   1950, 'Hillegersberg, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1633110186-3c62e97c8f39?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600607687939-9bbc18e7e3d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 4, 120,
   false, false, NULL,
   true, 163 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '3 days'),

  -- 24. Delfshaven — shared (terrace/outdoor vibe lead)
  (v_uid,
   'Huisgenoot gezocht in sfeervol huis Delfshaven',
   'In ons bruisende huis in Delfshaven zoeken we een vierde huisgenoot. Kamer van 16 m², gezamenlijke woonkamer, keuken en tuin. Leuke mix van nationaliteiten, internationale sfeer. Ideaal voor jonge professionals of internationale studenten. GWE apart betalen.',
   685, 'Delfshaven, Rotterdam', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1591825729538-b18f2a1a3de3?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1586190848816-788462504855?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1524758631624-e2822132143f?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 16,
   false, false, NULL,
   true, 35 + floor(random()*70)::int, NULL,
   NOW() - INTERVAL '6 days'),

  -- 25. IJsselmonde — budget room (small cozy bedroom lead)
  (v_uid,
   'Betaalbare kamer met tuin in IJsselmonde',
   'Rustige kamer van 13 m² in een woonhuis in IJsselmonde. Gedeelde keuken en badkamer met twee andere bewoners. Gebruik van de grote achtertuin. Kosten inclusief GWE. Goed bereikbaar via de metro. Ideaal voor starters met een krappe beurs.',
   575, 'IJsselmonde, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1574691250077-03a929faece5?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '3 days')::date, 1, 13,
   false, false, NULL,
   true, 21 + floor(random()*50)::int, NULL,
   NOW() - INTERVAL '14 days'),

  -- 26. Katendrecht — expat flat (kitchen/cozy interior lead)
  (v_uid,
   'Expat appartement op de Kaap Katendrecht',
   'Prachtig gerenoveerd appartement in het karakteristieke Katendrecht, het meest trendy deel van Rotterdam. Volledig gemeubileerd met modern meubilair, grote open keuken, eigen balkon met havenzicht. Alles inclusief. Op loopafstand van de Fenix Food Factory en diverse terrassen.',
   1375, 'Katendrecht, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '14 days')::date, 2, 65,
   false, false, NULL,
   true, 87 + floor(random()*110)::int, NOW() - INTERVAL '55 minutes',
   NOW() - INTERVAL '2 days'),

  -- 27. Blijdorp — student studio (minimal airy room lead)
  (v_uid,
   'Studio voor student in Blijdorp Rotterdam',
   'Compacte maar handige studio van 24 m² in Blijdorp, vlakbij Diergaarde Blijdorp en de Erasmus Universiteit. Eigen keuken en badkamer. Energiezuinig pand. Kosten exclusief GWE. Rustige straat, goed bereikbaar per metro en fiets.',
   865, 'Blijdorp, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=800&q=80'
   ],
   CURRENT_DATE::date, 1, 24,
   false, false, NULL,
   true, 49 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '11 days'),

  -- 28. Rotterdam-Zuid — penthouse (balcony/view lead — distinct from AMS penthouse)
  (v_uid,
   'Spectaculair penthouse met Maas-uitzicht',
   'Uniek penthouse van 140 m² op de 12e verdieping met 360° uitzicht over de Maas en skyline van Rotterdam. Beschikt over drie slaapkamers, twee badkamers, chef-keuken en een wraparound dakterras. Parkeerplaats en opslagruimte inbegrepen. Beschikbaar voor lange termijn verhuur.',
   2550, 'Rotterdam-Zuid, Rotterdam', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1519710164239-da1a0e65c4e0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1615874959474-d609be05944d?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '30 days')::date, 3, 140,
   false, false, NULL,
   true, 187 + floor(random()*80)::int, NULL,
   NOW() - INTERVAL '1 day'),

  -- ═══════════════════════════════════════════════════════════
  -- EINDHOVEN (7)
  -- lead images: warmer, tech-city palette — different from Rdam/AMS
  -- ═══════════════════════════════════════════════════════════

  -- 29. Stratum — student room (cozy warm room lead)
  (v_uid,
   'Studentenkamer in Stratum Eindhoven',
   'Gezellige kamer van 14 m² in een studentenhuis in Stratum, op fietsafstand van de TU/e en Fontys. Gedeelde keuken, woonkamer en badkamer met drie studenten. Kosten inclusief GWE en internet. Meubels aanwezig. Beschikbaar per direct.',
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

  -- 30. Strijp-S — creative studio (bright kitchen-bar area lead)
  (v_uid,
   'Creatieve studio op Strijp-S Eindhoven',
   'Sfeervolle studio van 35 m² in het bruisende Strijp-S creatieve district. Open industrieel ontwerp met hoogwaardige afwerking. Eigen keuken, badkamer en mezzanine slaapverdieping. Omgeven door design, kunst en tech. Perfect voor creatieven en designers.',
   855, 'Strijp-S, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1556910107-5ad8dc45e6d3?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 35,
   false, false, NULL,
   true, 58 + floor(random()*100)::int, NOW() - INTERVAL '40 minutes',
   NOW() - INTERVAL '4 days'),

  -- 31. Woensel — expat apartment (outdoor/patio lead, fresh vibe)
  (v_uid,
   'Gemeubileerd expat appartement in Woensel',
   'Modern 2-kamer appartement volledig gemeubileerd en direct beschikbaar in Woensel. Ideaal voor ASML-, NXP- of Philips-medewerkers. Open woonkeuken, slaapkamer, eigen badkamer en balkon. Inclusief GWE en glasvezel internet. Parkeerplaats beschikbaar. Korte of lange termijn mogelijk.',
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

  -- 32. Tongelre — budget room (clean bathroom lead — shows honest value)
  (v_uid,
   'Betaalbare kamer in rustig Tongelre',
   'Kamer van 12 m² in een rustige woonwijk in Tongelre. Gedeelde keuken en badkamer met één andere bewoner. Kosten inclusief gas, water en elektriciteit. Goed bereikbaar per bus. Ideaal voor iemand die het rustig aandurft en weinig budget heeft.',
   490, 'Tongelre, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1552321554-3ceeff8c5c73?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1471285719270-1ba159e8d29f?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '10 days')::date, 1, 12,
   false, false, NULL,
   true, 14 + floor(random()*40)::int, NULL,
   NOW() - INTERVAL '16 days'),

  -- 33. Gestel — shared house (clean bathroom detail lead)
  (v_uid,
   'Huisgenoot gezocht voor gezellig huis in Gestel',
   'Wij zoeken een tweede huisgenoot voor ons huis in Gestel. Ruime slaapkamer van 19 m², grote woonkamer, moderne keuken en zonnige tuin. Rustige woonwijk, goed bereikbaar via de ring. We zijn allebei werkend en hechten aan gezelligheid én privacy. Huisdieren in overleg.',
   625, 'Gestel, Eindhoven', 'roommate_search',
   ARRAY[
     'https://images.unsplash.com/photo-1584466977764-c4e0f2f4f898?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1586190848816-788462504855?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1524758631624-e2822132143f?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '21 days')::date, 1, 19,
   true, false, NULL,
   true, 27 + floor(random()*60)::int, NULL,
   NOW() - INTERVAL '12 days'),

  -- 34. Centrum Eindhoven — modern studio (kitchen bar lead — design district feel)
  (v_uid,
   'Moderne studio in het centrum van Eindhoven',
   'Eigentijdse studio van 32 m² centraal gelegen in Eindhoven. Op loopafstand van het station, de Heuvelgalerie en de beste eetgelegenheden. Volledig uitgerust met moderne keuken en badkamer. Energielabel B. Ideaal voor young professional of internationale medewerker.',
   895, 'Centrum, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1553444836-bc0c1f5c7ab1?auto=format&fit=crop&w=800&q=80'
   ],
   (CURRENT_DATE + INTERVAL '7 days')::date, 1, 32,
   false, false, NULL,
   true, 64 + floor(random()*90)::int, NULL,
   NOW() - INTERVAL '3 days'),

  -- 35. Meerhoven — premium (luxury kitchen lead — clearly upscale, differs from #5/#12)
  (v_uid,
   'Luxe appartement in het groene Meerhoven',
   'Ruim en modern 3-kamer appartement in het groene en rustige Meerhoven. Hoogwaardige afwerking, vloerverwarming, zonnepanelen en eigen garage. Twee slaapkamers, grote woonkamer en royaal terras. Energielabel A++. Ideaal voor gezinnen of professionals die kwaliteit en rust zoeken.',
   1425, 'Meerhoven, Eindhoven', 'room_for_rent',
   ARRAY[
     'https://images.unsplash.com/photo-1600607687939-9bbc18e7e3d0?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1633110186-3c62e97c8f39?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=800&q=80'
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
