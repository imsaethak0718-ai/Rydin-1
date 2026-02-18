-- ============================================
-- PROFILE PHOTO & IDENTITY VERIFICATION MIGRATION
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Add avatar_url and identity_verified columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;

-- 2. Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies for profile-photos bucket

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view profile photos (they're public avatars)
CREATE POLICY "Profile photos are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

-- Allow users to update/delete their own photos
CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Ensure id_verifications table has proper RLS policies
ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verifications
CREATE POLICY "Users can view own verifications"
ON id_verifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own verifications
CREATE POLICY "Users can insert own verifications"
ON id_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own verifications
CREATE POLICY "Users can update own verifications"
ON id_verifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- VERIFY: Run this to check the migration
-- ============================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name IN ('avatar_url', 'identity_verified');
