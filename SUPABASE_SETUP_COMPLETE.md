# Complete Supabase Setup Guide for Rydin

## Overview
This guide will walk you through setting up your Supabase database for the Rydin app. You'll execute 3 SQL migrations in order.

---

## STEP 1: Add profile_complete Column

**Location:** Supabase Dashboard → SQL Editor → New Query

**Copy and paste this SQL:**

```sql
-- Add profile_complete column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE;

-- Create index for faster profile completion checks
CREATE INDEX IF NOT EXISTS profiles_profile_complete_idx ON profiles(profile_complete);

-- Set profile_complete to true for any existing profiles that have name filled
UPDATE profiles SET profile_complete = TRUE WHERE name IS NOT NULL AND name != '';
```

**Click "Run" button and wait for success message ✅**

---

## STEP 2: Add Ride Lock Logic

**Location:** Supabase Dashboard → SQL Editor → New Query

**Copy and paste this SQL:**

```sql
-- Add lock status to rides table
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id);

-- Create function to lock ride automatically when all seats filled
CREATE OR REPLACE FUNCTION auto_lock_ride_on_full()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if ride is now full
  IF (SELECT COUNT(*) FROM ride_members WHERE ride_id = NEW.ride_id AND status = 'accepted') >= (SELECT max_seats FROM rides WHERE id = NEW.ride_id) THEN
    UPDATE rides SET is_locked = TRUE, locked_at = NOW() WHERE id = NEW.ride_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-lock when ride is full
DROP TRIGGER IF EXISTS auto_lock_full_rides ON ride_members;
CREATE TRIGGER auto_lock_full_rides
AFTER INSERT OR UPDATE ON ride_members
FOR EACH ROW
EXECUTE FUNCTION auto_lock_ride_on_full();

-- Create function to lock ride manually (for host)
CREATE OR REPLACE FUNCTION lock_ride(ride_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rides 
  SET is_locked = TRUE, locked_at = NOW(), locked_by = auth.uid()
  WHERE id = ride_id AND host_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to unlock ride manually (for host)
CREATE OR REPLACE FUNCTION unlock_ride(ride_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rides 
  SET is_locked = FALSE, locked_at = NULL, locked_by = NULL
  WHERE id = ride_id AND host_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add index on lock status for faster queries
CREATE INDEX IF NOT EXISTS rides_is_locked_idx ON rides(is_locked);
CREATE INDEX IF NOT EXISTS rides_locked_at_idx ON rides(locked_at);

-- Update RLS policy to prevent edits on locked rides
DROP POLICY IF EXISTS "Users can update their own rides" ON rides;
CREATE POLICY "Users can update their own rides"
  ON rides
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id AND NOT is_locked)
  WITH CHECK (auth.uid() = host_id AND NOT is_locked);

-- Add policy to prevent joining locked rides
DROP POLICY IF EXISTS "Prevent joining locked rides" ON ride_members;
CREATE POLICY "Prevent joining locked rides"
  ON ride_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT (SELECT is_locked FROM rides WHERE id = ride_id)
  );

-- Create notification function for lock events
CREATE OR REPLACE FUNCTION notify_ride_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_locked AND NOT OLD.is_locked THEN
    -- Notify all ride members that the ride is locked
    INSERT INTO notifications (user_id, type, title, message, ride_id, created_at)
    SELECT 
      user_id, 
      'ride_locked', 
      'Ride Full', 
      'Your ride is now full and locked!',
      NEW.id,
      NOW()
    FROM ride_members 
    WHERE ride_id = NEW.id AND status = 'accepted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lock notifications
DROP TRIGGER IF EXISTS notify_ride_locked_trigger ON rides;
CREATE TRIGGER notify_ride_locked_trigger
AFTER UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION notify_ride_locked();

-- Create materialized view for locked rides
DROP MATERIALIZED VIEW IF EXISTS locked_rides_summary CASCADE;
CREATE MATERIALIZED VIEW locked_rides_summary AS
SELECT 
  r.id,
  r.from_location,
  r.to_location,
  r.departure_time,
  r.max_seats,
  COUNT(rm.id) as current_members,
  r.is_locked,
  r.locked_at
FROM rides r
LEFT JOIN ride_members rm ON r.id = rm.ride_id AND rm.status = 'accepted'
WHERE r.is_locked = TRUE
GROUP BY r.id;

-- Create index for performance
CREATE INDEX IF NOT EXISTS locked_rides_summary_locked_at_idx 
ON locked_rides_summary(locked_at);
```

**Click "Run" button and wait for success message ✅**

---

## STEP 3: Cost Splitting Feature

**Location:** Supabase Dashboard → SQL Editor → New Query

**Copy and paste this SQL:**

```sql
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
```

**Click "Run" button and wait for success message ✅**

---

## STEP 4: Add Engagement Features (Events, Leaderboards, Referrals, Notifications, Badges)

**Location:** Supabase Dashboard → SQL Editor → New Query

**Copy and paste this SQL:**

```sql
-- ============================================
-- EVENTS FEATURE
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('concert', 'fest', 'hackathon', 'sports', 'tech_talk', 'meetup', 'other')),
  location TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_time TEXT,
  duration_minutes INTEGER,
  image_url TEXT,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capacity INTEGER,
  ticket_price DECIMAL(10, 2),
  ticket_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_interested_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_ride_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  departure_location TEXT NOT NULL,
  max_seats INTEGER DEFAULT 4,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_ride_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_group_id UUID NOT NULL REFERENCES event_ride_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ride_group_id, user_id)
);

-- ============================================
-- LEADERBOARDS & BADGES
-- ============================================

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_emoji TEXT,
  icon_url TEXT,
  requirements JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('reliability', 'top_splitters', 'top_referrers')),
  rank INTEGER,
  score DECIMAL(10, 2),
  rides_completed INTEGER DEFAULT 0,
  splits_created INTEGER DEFAULT 0,
  referrals_count INTEGER DEFAULT 0,
  trust_score DECIMAL(10, 2) DEFAULT 4.0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, leaderboard_type)
);

-- ============================================
-- REFERRAL SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT UNIQUE NOT NULL,
  bonus_amount DECIMAL(10, 2) DEFAULT 50.00,
  bonus_type TEXT DEFAULT 'credits' CHECK (bonus_type IN ('credits', 'discount')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS referral_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('signup', 'first_ride', 'first_split')),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ride_reminder', 'payment_reminder', 'split_invitation', 'badge_earned', 'referral', 'ride_locked', 'ride_updated', 'message')),
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ANALYTICS & TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT,
  error_stack TEXT,
  error_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- EVENTS RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interested_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_ride_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_ride_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view all events"
  ON events
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Users can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Users can interest in events"
  ON event_interested_users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their interests"
  ON event_interested_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

-- BADGES RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view badges"
  ON badges
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Users can view their badges"
  ON user_badges
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- LEADERBOARDS RLS
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view leaderboards"
  ON leaderboard_entries
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- REFERRALS RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referrals"
  ON referrals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view referral tracking"
  ON referral_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

-- NOTIFICATIONS RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ANALYTICS RLS
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert analytics"
  ON user_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert error logs"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS events_category_idx ON events(category);
CREATE INDEX IF NOT EXISTS events_event_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON events(organizer_id);

CREATE INDEX IF NOT EXISTS event_interested_users_event_id_idx ON event_interested_users(event_id);
CREATE INDEX IF NOT EXISTS event_interested_users_user_id_idx ON event_interested_users(user_id);

CREATE INDEX IF NOT EXISTS event_ride_groups_event_id_idx ON event_ride_groups(event_id);
CREATE INDEX IF NOT EXISTS event_ride_groups_organizer_id_idx ON event_ride_groups(organizer_id);

CREATE INDEX IF NOT EXISTS user_badges_user_id_idx ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS user_badges_badge_id_idx ON user_badges(badge_id);

CREATE INDEX IF NOT EXISTS leaderboard_entries_user_id_idx ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS leaderboard_entries_type_rank_idx ON leaderboard_entries(leaderboard_type, rank);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON referrals(status);

CREATE INDEX IF NOT EXISTS referral_tracking_referrer_id_idx ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS referral_tracking_referred_user_id_idx ON referral_tracking(referred_user_id);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);

CREATE INDEX IF NOT EXISTS user_analytics_user_id_idx ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS user_analytics_event_name_idx ON user_analytics(event_name);

CREATE INDEX IF NOT EXISTS error_logs_user_id_idx ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs(created_at);

-- ============================================
-- REAL-TIME REPLICATION
-- ============================================

DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
CREATE PUBLICATION supabase_realtime FOR TABLE
  cost_splits, split_members, settlements, ride_links, id_verifications,
  events, event_interested_users, event_ride_groups, event_ride_members,
  badges, user_badges, leaderboard_entries,
  referrals, notifications, rides, ride_members;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to insert default badges
CREATE OR REPLACE FUNCTION insert_default_badges()
RETURNS void AS $$
BEGIN
  INSERT INTO badges (name, description, icon_emoji, requirements) VALUES
    ('First Split', 'Create your first cost split', '🎉', '{"type":"first_split"}'),
    ('Road Tripper', 'Complete 10 rides', '🚗', '{"type":"rides_completed","count":10}'),
    ('Travel Master', 'Travel 100+ km total', '🌍', '{"type":"total_km","amount":100}'),
    ('Trusted User', 'Maintain 4.8+ trust score', '⭐', '{"type":"trust_score","min":4.8}'),
    ('Referral King', 'Get 5 successful referrals', '👑', '{"type":"referrals","count":5}'),
    ('Reliable Rider', 'Complete 50 rides on time', '✅', '{"type":"on_time_rides","count":50}')
  ON CONFLICT (name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Insert default badges on table creation
SELECT insert_default_badges();

-- Function to award badge to user
CREATE OR REPLACE FUNCTION award_badge(user_id UUID, badge_name TEXT)
RETURNS void AS $$
DECLARE
  badge_id UUID;
BEGIN
  SELECT id INTO badge_id FROM badges WHERE name = badge_name LIMIT 1;
  IF badge_id IS NOT NULL THEN
    INSERT INTO user_badges (user_id, badge_id) VALUES (user_id, badge_id)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard_rank(
  leaderboard_type_param TEXT,
  user_id_param UUID,
  score_param DECIMAL
)
RETURNS void AS $$
BEGIN
  INSERT INTO leaderboard_entries (user_id, leaderboard_type, score, updated_at)
  VALUES (user_id_param, leaderboard_type_param, score_param, NOW())
  ON CONFLICT (user_id, leaderboard_type) DO UPDATE SET
    score = score_param,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to send notification
CREATE OR REPLACE FUNCTION send_notification(
  user_id_param UUID,
  type_param TEXT,
  title_param TEXT,
  message_param TEXT,
  data_param JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (user_id_param, type_param, title_param, message_param, data_param);
END;
$$ LANGUAGE plpgsql;
```

**Click "Run" button and wait for success message ✅**

---

## STEP 5: Create Storage Bucket

**Location:** Supabase Dashboard → Storage (left sidebar)

1. Click **"New bucket"** button
2. Enter bucket name: `id-verifications`
3. **Uncheck "Public bucket"** (keep it PRIVATE)
4. Click **"Create bucket"** ✅

---

## STEP 6: Enable Real-time Replication

**Location:** Supabase Dashboard → Database → Replication (left sidebar)

Verify these tables have **checkmarks** (✅ enabled):
- `cost_splits` ✅
- `split_members` ✅
- `settlements` ✅
- `ride_links` ✅
- `id_verifications` ✅
- `rides` ✅
- `ride_members` ✅
- `events` ✅
- `event_interested_users` ✅
- `event_ride_groups` ✅
- `event_ride_members` ✅
- `badges` ✅
- `user_badges` ✅
- `leaderboard_entries` ✅
- `referrals` ✅
- `notifications` ✅

If any are unchecked, click them to enable.

---

## Summary

✅ **Profile & Verification** - One-time profile setup with ID scanning
✅ **Ride Management** - Auto-lock when full, ride tracking
✅ **Cost Splitting** - Peer-to-peer ride cost splitting with settlements
✅ **Events** - Discover events, create event ride groups, track interests
✅ **Leaderboards** - Reliability, Top Splitters, Top Referrers rankings
✅ **Badges** - 6 achievement badges earned through user activity
✅ **Referral System** - ₹50 credits per successful referral
✅ **Notifications** - Ride reminders, payments, badges, referrals
✅ **Analytics & Error Tracking** - Event tracking and error logging
✅ **Real-time Updates** - All data syncs in real-time via WebSocket

**Your Rydin app is fully configured and ready to deploy!**

---

## Next Steps

1. **Clear your auth database**: Go to Supabase Dashboard → Auth → Users, delete any test accounts
2. **Test locally**: Run `npm install` then test creating splits, joining events, checking settlements
3. **Deploy**: Push to [Vercel](https://vercel.com), [Netlify](https://netlify.com), or [Firebase Hosting](https://firebase.google.com)
4. **Post-launch**: Monitor analytics, gather user feedback, iterate on features
