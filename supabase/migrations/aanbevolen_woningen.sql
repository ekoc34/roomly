-- ============================================================
-- Migration: Aanbevolen woningen — run in Supabase SQL Editor
-- ============================================================

-- 1. Add boosted column to listings
--    Boosted listings appear first in the "Woningen" tab on the homepage.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS boosted boolean NOT NULL DEFAULT false;

-- 2. Add lifestyle_tags column to profiles
--    Used in the "Huisgenoten" tab to display personality/lifestyle chips.
--    Examples: 'Niet roken', 'Student', 'Werkend', 'Rustig', 'Internationaal'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifestyle_tags text[] NOT NULL DEFAULT '{}';

-- 3. (Optional) Index to speed up homepage query ordering boosted listings first
CREATE INDEX IF NOT EXISTS idx_listings_boosted_created
  ON listings (boosted DESC, created_at DESC);
