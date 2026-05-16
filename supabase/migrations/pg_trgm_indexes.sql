-- ═════════════════════════════════════════════════════════════════════════════
-- MIGRATION: D-03 — pg_trgm GIN indexes for fast ILIKE search on listings
-- Run in Supabase SQL Editor (fully idempotent — safe to re-run).
--
-- Without these indexes every ILIKE '%…%' on listings performs a sequential
-- table scan. pg_trgm GIN indexes let Postgres use an index scan for any
-- ILIKE / SIMILAR TO / ~ pattern.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- listings.title
DROP INDEX IF EXISTS idx_listings_title_trgm;
CREATE INDEX idx_listings_title_trgm
  ON public.listings USING GIN (title gin_trgm_ops);

-- listings.description
DROP INDEX IF EXISTS idx_listings_description_trgm;
CREATE INDEX idx_listings_description_trgm
  ON public.listings USING GIN (description gin_trgm_ops);

-- listings.location  (used for city + district ILIKE filters)
DROP INDEX IF EXISTS idx_listings_location_trgm;
CREATE INDEX idx_listings_location_trgm
  ON public.listings USING GIN (location gin_trgm_ops);

-- profiles.name  (landlord name search)
DROP INDEX IF EXISTS idx_profiles_name_trgm;
CREATE INDEX idx_profiles_name_trgm
  ON public.profiles USING GIN (name gin_trgm_ops);
