-- Migration: Profile photo visibility control
-- Run in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_avatar_in_listings boolean NOT NULL DEFAULT true;
