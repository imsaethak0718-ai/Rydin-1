-- ============================================
-- REALTIME DATABASE SETUP FOR RIDEMATE CONNECT
-- Safe version - Run in smaller chunks to avoid deadlock
-- ============================================

-- STEP 1: Create messages table for real-time chat
-- Run this first
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

-- STEP 2: Create indexes for messages
-- Run this second
CREATE INDEX IF NOT EXISTS idx_messages_ride_id ON messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(ride_id, sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- STEP 3: Fix rides table constraints
-- Run this third
ALTER TABLE IF EXISTS rides DROP CONSTRAINT IF EXISTS rides_status_check;

ALTER TABLE IF EXISTS rides
ADD CONSTRAINT rides_status_check 
CHECK (status IN ('open', 'full', 'locked', 'completed', 'cancelled'));

-- STEP 4: Set defaults
-- Run this fourth
ALTER TABLE IF EXISTS rides ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE IF EXISTS rides ALTER COLUMN seats_taken SET DEFAULT 0;

-- STEP 5: Enable RLS (safe version - won't conflict)
-- Run this fifth
ALTER TABLE IF EXISTS rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ride_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;

-- STEP 6: Drop old ride policies (one at a time to avoid deadlock)
-- Run this sixth
DROP POLICY IF EXISTS "Users can insert own rides" ON rides;
DROP POLICY IF EXISTS "Rides are visible to all" ON rides;
DROP POLICY IF EXISTS "Users can update their own rides" ON rides;
DROP POLICY IF EXISTS "All users can view rides" ON rides;
DROP POLICY IF EXISTS "Users can create rides" ON rides;
DROP POLICY IF EXISTS "Users can update own rides" ON rides;
DROP POLICY IF EXISTS "Users can delete own rides" ON rides;

-- STEP 7: Create new ride policies
-- Run this seventh
CREATE POLICY "All users can view rides"
ON rides FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create rides"
ON rides FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can update own rides"
ON rides FOR UPDATE
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can delete own rides"
ON rides FOR DELETE
USING (auth.uid() = host_id);

-- STEP 8: Drop and recreate ride_members policies
-- Run this eighth
DROP POLICY IF EXISTS "ride_members_select" ON ride_members;
DROP POLICY IF EXISTS "ride_members_insert" ON ride_members;
DROP POLICY IF EXISTS "ride_members_update" ON ride_members;
DROP POLICY IF EXISTS "ride_members_delete" ON ride_members;
DROP POLICY IF EXISTS "Users can view ride members" ON ride_members;
DROP POLICY IF EXISTS "Users can join rides" ON ride_members;
DROP POLICY IF EXISTS "Users can update own membership" ON ride_members;
DROP POLICY IF EXISTS "Users can leave rides" ON ride_members;

CREATE POLICY "Users can view ride members"
ON ride_members FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT host_id FROM rides WHERE id = ride_members.ride_id
    )
  )
);

CREATE POLICY "Users can join rides"
ON ride_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
ON ride_members FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rides"
ON ride_members FOR DELETE
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT host_id FROM rides WHERE id = ride_members.ride_id
));

-- STEP 9: Drop and recreate message policies
-- Run this ninth
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages" ON messages;

CREATE POLICY "Users can view messages"
ON messages FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = sender_id OR
    auth.uid() = recipient_id
  )
);

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

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

CREATE POLICY "Users can delete messages"
ON messages FOR DELETE
USING (auth.uid() = sender_id);

-- STEP 10: Drop and recreate profile policies
-- Run this tenth
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "All users can view profiles"
ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- STEP 11: Enable realtime for all tables
-- Run this last (eleventh)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS rides;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS ride_members;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS messages;
