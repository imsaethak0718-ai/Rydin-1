-- ==============================================
-- SETUP: USER VERIFICATIONS TABLE + STORAGE
-- Run this in Supabase SQL Editor if not already done
-- ==============================================

-- 1. Create table (skip if exists)
CREATE TABLE IF NOT EXISTS user_verifications (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  id_number TEXT,
  college_name TEXT,
  photo_url TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;

-- 3. Policy (idempotent)
DROP POLICY IF EXISTS "Enable all for users based on user_id" ON user_verifications;
CREATE POLICY "Enable all for users based on user_id"
  ON user_verifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-verifications', 'user-verifications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage policies (idempotent)
DROP POLICY IF EXISTS "uv_select" ON storage.objects;
DROP POLICY IF EXISTS "uv_insert" ON storage.objects;
DROP POLICY IF EXISTS "uv_update" ON storage.objects;
DROP POLICY IF EXISTS "uv_delete" ON storage.objects;

CREATE POLICY "uv_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'user-verifications');
CREATE POLICY "uv_insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'user-verifications');
CREATE POLICY "uv_update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'user-verifications');
CREATE POLICY "uv_delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'user-verifications');

SELECT 'SUCCESS: user_verifications table and storage ready' as status;
