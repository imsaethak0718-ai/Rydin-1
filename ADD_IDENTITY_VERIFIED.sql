-- ==============================================
-- ADD identity_verified COLUMN TO profiles TABLE
-- This column is used by the frontend to show the "Verified" badge
-- ==============================================

-- Add the column (safe to re-run)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false;

-- Update existing verified users (sync from user_verifications table)
UPDATE profiles p
SET identity_verified = true
FROM user_verifications v
WHERE p.id = v.user_id AND v.verified = true;

SELECT 'SUCCESS: identity_verified column added and synced' as status;
