-- ============================================
-- REALTIME DATABASE SETUP FOR RIDEMATE CONNECT
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Create messages table for real-time chat
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  read_at TIMESTAMP
);

-- 2. Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_ride_id ON messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(ride_id, sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- 3. Fix rides table constraints and defaults
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check CASCADE;

ALTER TABLE rides
ADD CONSTRAINT rides_status_check 
CHECK (status IN ('open', 'full', 'locked', 'completed', 'cancelled'));

-- Set default values
ALTER TABLE rides ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE rides ALTER COLUMN seats_taken SET DEFAULT 0;

-- 4. Enable RLS on all tables
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR RIDES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can insert own rides" ON rides;
DROP POLICY IF EXISTS "Rides are visible to all" ON rides;
DROP POLICY IF EXISTS "Users can update their own rides" ON rides;

-- SELECT: All authenticated users can see all rides
CREATE POLICY "All users can view rides"
ON rides FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Users can create rides (host_id must be their ID)
CREATE POLICY "Users can create rides"
ON rides FOR INSERT
WITH CHECK (auth.uid() = host_id);

-- UPDATE: Users can update their own rides
CREATE POLICY "Users can update own rides"
ON rides FOR UPDATE
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- DELETE: Users can delete their own rides
CREATE POLICY "Users can delete own rides"
ON rides FOR DELETE
USING (auth.uid() = host_id);

-- ============================================
-- RLS POLICIES FOR RIDE_MEMBERS
-- ============================================

DROP POLICY IF EXISTS "ride_members_select" ON ride_members;
DROP POLICY IF EXISTS "ride_members_insert" ON ride_members;
DROP POLICY IF EXISTS "ride_members_update" ON ride_members;
DROP POLICY IF EXISTS "ride_members_delete" ON ride_members;

-- SELECT: Users can see all members of rides they're in
CREATE POLICY "Users can view ride members"
ON ride_members FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- They joined the ride
    auth.uid() = user_id OR
    -- They're the host
    auth.uid() IN (
      SELECT host_id FROM rides WHERE id = ride_members.ride_id
    )
  )
);

-- INSERT: Users can join rides
CREATE POLICY "Users can join rides"
ON ride_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own membership
CREATE POLICY "Users can update own membership"
ON ride_members FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can leave rides
CREATE POLICY "Users can leave rides"
ON ride_members FOR DELETE
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT host_id FROM rides WHERE id = ride_members.ride_id
));

-- ============================================
-- RLS POLICIES FOR MESSAGES
-- ============================================

DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages" ON messages;

-- SELECT: Users can see messages they sent or received
CREATE POLICY "Users can view messages"
ON messages FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = sender_id OR
    auth.uid() = recipient_id
  )
);

-- INSERT: Users can send messages
CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- UPDATE: Users can mark messages as read
CREATE POLICY "Users can update messages"
ON messages FOR UPDATE
USING (
  auth.uid() = sender_id OR
  auth.uid() = recipient_id
)
WITH CHECK (
  auth.uid() = sender_id OR
  auth.uid() = recipient_id
);

-- DELETE: Users can delete their own messages
CREATE POLICY "Users can delete messages"
ON messages FOR DELETE
USING (auth.uid() = sender_id);

-- ============================================
-- RLS POLICIES FOR PROFILES
-- ============================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

-- SELECT: All authenticated users can see all profiles
CREATE POLICY "All users can view profiles"
ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Users can create their own profile
CREATE POLICY "Users can create profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- ENABLE REALTIME FOR ALL TABLES
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_members;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- VERIFY TABLES AND COLUMNS
-- ============================================

-- Run these SELECT queries to verify:

-- Check rides table structure
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'rides' ORDER BY ordinal_position;

-- Check messages table exists
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'messages';

-- Check RLS is enabled
-- SELECT tablename FROM pg_tables 
-- WHERE schemaname = 'public' AND rowsecurity = true;
