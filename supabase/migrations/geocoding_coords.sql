-- ═════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Geocoding coordinates on listings
-- Run in Supabase SQL Editor (fully idempotent — safe to re-run).
--
-- Adds lat / lon to public.listings so MapPage can read stored coordinates
-- instead of calling Nominatim from the browser.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lon NUMERIC(9,6);

CREATE INDEX IF NOT EXISTS idx_listings_coords
  ON public.listings (lat, lon)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;
