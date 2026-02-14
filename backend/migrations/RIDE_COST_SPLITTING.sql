-- ============================================
-- COST SPLITTING FEATURE - DATABASE SCHEMA
-- ============================================

-- 1. ID VERIFICATIONS TABLE
-- Stores student ID verification data
CREATE TABLE IF NOT EXISTS id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  id_number TEXT NOT NULL UNIQUE,
  college_name TEXT NOT NULL,
  photo_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RIDE LINKS TABLE
-- Stores parsed Uber/Ola/Rapido ride information
CREATE TABLE IF NOT EXISTS ride_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('uber', 'ola', 'rapido')),
  original_url TEXT NOT NULL,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  ride_type TEXT,
  total_price DECIMAL(10, 2) NOT NULL,
  estimated_duration_minutes INTEGER,
  estimated_distance_km DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. COST SPLITS TABLE
-- Groups of people splitting a ride cost
CREATE TABLE IF NOT EXISTS cost_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_link_id UUID NOT NULL REFERENCES ride_links(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  share_token TEXT UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  per_person_amount DECIMAL(10, 2) NOT NULL,
  number_of_people INTEGER NOT NULL CHECK (number_of_people >= 2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'settled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SPLIT MEMBERS TABLE
-- Individual members in a cost split
CREATE TABLE IF NOT EXISTS split_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id UUID NOT NULL REFERENCES cost_splits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  amount_owed DECIMAL(10, 2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_method TEXT CHECK (payment_method IN ('upi', 'cash', 'card', null)),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- 5. SETTLEMENTS TABLE
-- Payment history and settlement tracking
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_member_id UUID NOT NULL REFERENCES split_members(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi', 'cash', 'card')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- ID VERIFICATIONS RLS
ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification"
  ON id_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verification"
  ON id_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verification"
  ON id_verifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RIDE LINKS RLS
ALTER TABLE ride_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ride links"
  ON ride_links
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ride links"
  ON ride_links
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- COST SPLITS RLS
ALTER TABLE cost_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view splits they're part of or created"
  ON cost_splits
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creator_id OR
    id IN (SELECT split_id FROM split_members WHERE user_id = auth.uid() OR share_token IS NOT NULL)
  );

CREATE POLICY "Public can view splits via share token"
  ON cost_splits
  FOR SELECT
  TO anon
  USING (share_token IS NOT NULL);

CREATE POLICY "Users can insert splits"
  ON cost_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Only creator can update splits"
  ON cost_splits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- SPLIT MEMBERS RLS
ALTER TABLE split_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own split membership"
  ON split_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR split_id IN (SELECT id FROM cost_splits WHERE creator_id = auth.uid()));

CREATE POLICY "Users can view members of splits they're in"
  ON split_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    split_id IN (SELECT id FROM cost_splits WHERE creator_id = auth.uid())
  );

CREATE POLICY "Public can view members via cost_splits"
  ON split_members
  FOR SELECT
  TO anon
  USING (
    split_id IN (SELECT id FROM cost_splits WHERE share_token IS NOT NULL)
  );

CREATE POLICY "Users can join splits"
  ON split_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their payment status"
  ON split_members
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SETTLEMENTS RLS
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their settlements"
  ON settlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can insert settlements"
  ON settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their settlements"
  ON settlements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS id_verifications_user_id_idx ON id_verifications(user_id);
CREATE INDEX IF NOT EXISTS id_verifications_verified_idx ON id_verifications(verified);

CREATE INDEX IF NOT EXISTS ride_links_user_id_idx ON ride_links(user_id);
CREATE INDEX IF NOT EXISTS ride_links_platform_idx ON ride_links(platform);

CREATE INDEX IF NOT EXISTS cost_splits_creator_id_idx ON cost_splits(creator_id);
CREATE INDEX IF NOT EXISTS cost_splits_ride_link_id_idx ON cost_splits(ride_link_id);
CREATE INDEX IF NOT EXISTS cost_splits_share_token_idx ON cost_splits(share_token);
CREATE INDEX IF NOT EXISTS cost_splits_status_idx ON cost_splits(status);

CREATE INDEX IF NOT EXISTS split_members_split_id_idx ON split_members(split_id);
CREATE INDEX IF NOT EXISTS split_members_user_id_idx ON split_members(user_id);
CREATE INDEX IF NOT EXISTS split_members_payment_status_idx ON split_members(payment_status);

CREATE INDEX IF NOT EXISTS settlements_from_user_id_idx ON settlements(from_user_id);
CREATE INDEX IF NOT EXISTS settlements_to_user_id_idx ON settlements(to_user_id);
CREATE INDEX IF NOT EXISTS settlements_status_idx ON settlements(status);

-- ============================================
-- REAL-TIME REPLICATION SETUP
-- ============================================

-- Enable real-time for cost-splitting tables
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
CREATE PUBLICATION supabase_realtime FOR TABLE cost_splits, split_members, settlements, ride_links, id_verifications;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get split details with members
CREATE OR REPLACE FUNCTION get_split_details(split_id UUID)
RETURNS TABLE (
  split_id UUID,
  creator_id UUID,
  title TEXT,
  total_amount DECIMAL,
  per_person_amount DECIMAL,
  number_of_people INTEGER,
  member_count BIGINT,
  ride_info JSONB
) AS $$
SELECT
  cs.id,
  cs.creator_id,
  cs.title,
  cs.total_amount,
  cs.per_person_amount,
  cs.number_of_people,
  COUNT(sm.id),
  jsonb_build_object(
    'platform', rl.platform,
    'pickup_location', rl.pickup_location,
    'dropoff_location', rl.dropoff_location,
    'ride_type', rl.ride_type,
    'estimated_duration', rl.estimated_duration_minutes,
    'estimated_distance', rl.estimated_distance_km
  )
FROM cost_splits cs
LEFT JOIN split_members sm ON cs.id = sm.split_id
LEFT JOIN ride_links rl ON cs.ride_link_id = rl.id
WHERE cs.id = split_id
GROUP BY cs.id, cs.creator_id, cs.title, cs.total_amount, cs.per_person_amount, cs.number_of_people, rl.platform, rl.pickup_location, rl.dropoff_location, rl.ride_type, rl.estimated_duration_minutes, rl.estimated_distance_km;
$$ LANGUAGE SQL;

-- Function to calculate settlement amounts
CREATE OR REPLACE FUNCTION calculate_settlement(split_id UUID)
RETURNS TABLE (
  from_user_id UUID,
  to_user_id UUID,
  amount DECIMAL
) AS $$
SELECT 
  sm.user_id,
  cs.creator_id,
  COALESCE(sm.amount_owed, 0)
FROM split_members sm
JOIN cost_splits cs ON sm.split_id = cs.id
WHERE sm.split_id = split_id 
AND sm.user_id IS NOT NULL
AND sm.user_id != cs.creator_id
AND sm.payment_status = 'pending';
$$ LANGUAGE SQL;
