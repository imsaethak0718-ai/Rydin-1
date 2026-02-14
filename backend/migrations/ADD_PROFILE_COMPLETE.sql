-- Add profile_complete column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE;

-- Create index for faster profile completion checks
CREATE INDEX IF NOT EXISTS profiles_profile_complete_idx ON profiles(profile_complete);

-- Set profile_complete to true for any existing profiles that have name filled
UPDATE profiles SET profile_complete = TRUE WHERE name IS NOT NULL AND name != '';
