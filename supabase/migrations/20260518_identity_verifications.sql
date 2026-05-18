-- ─────────────────────────────────────────────────────────────────────────────
-- Identity Verification trust layer — Welkthuis.nl
-- Run this SQL manually in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add identity_verified column to profiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false;


-- 2. identity_verifications table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity_verifications (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  document_type  text        NOT NULL
                               CHECK (document_type IN ('passport', 'id_card', 'residence_permit', 'drivers_license')),
  document_path  text        NOT NULL,
  rejection_reason text,
  reviewed_by    uuid        REFERENCES auth.users(id),
  reviewed_at    timestamptz,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Max one pending or approved verification per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_idv_pending_per_user
  ON identity_verifications (user_id) WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_idv_approved_per_user
  ON identity_verifications (user_id) WHERE status = 'approved';


-- 3. updated_at auto-trigger (reuses any existing helper function)
-- ─────────────────────────────────────────────────────────────────────────────
-- If update_updated_at_column() doesn't exist yet, create it:
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_idv_updated_at
  BEFORE UPDATE ON identity_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4. Trigger: keep profiles.identity_verified in sync
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_identity_verified_flag()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE profiles SET identity_verified = true  WHERE id = NEW.user_id;
  ELSIF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    UPDATE profiles SET identity_verified = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_sync_identity_verified
  AFTER UPDATE ON identity_verifications
  FOR EACH ROW EXECUTE FUNCTION sync_identity_verified_flag();


-- 5. Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own verifications
CREATE POLICY "idv_select_own"
  ON identity_verifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert a verification for themselves
CREATE POLICY "idv_insert_own"
  ON identity_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can see all
CREATE POLICY "idv_admin_select"
  ON identity_verifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update (approve / reject)
CREATE POLICY "idv_admin_update"
  ON identity_verifications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Storage bucket: identity-documents (PRIVATE)
--
-- Run these statements AFTER enabling the Storage extension and
-- setting up the "identity-documents" bucket via the Supabase dashboard.
--
-- In the Supabase dashboard: Storage → New Bucket
--   Name: identity-documents
--   Public: OFF
--
-- Then paste the storage policies below into the SQL editor:
-- ─────────────────────────────────────────────────────────────────────────────

-- Users can upload to their own folder: identity-documents/{user_id}/filename
CREATE POLICY "idoc_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'identity-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own files
CREATE POLICY "idoc_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'identity-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all files
CREATE POLICY "idoc_admin_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'identity-documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can delete their own files (needed for resubmission)
CREATE POLICY "idoc_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'identity-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
