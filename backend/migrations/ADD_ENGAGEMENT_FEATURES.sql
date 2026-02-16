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

CREATE TABLE IF NOT EXISTS event_ride_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ride_type TEXT DEFAULT 'to_event',
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  departure_location TEXT NOT NULL,
  max_capacity INTEGER DEFAULT 4,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_ride_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_room_id UUID NOT NULL REFERENCES event_ride_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ride_room_id, user_id)
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
CREATE INDEX IF NOT EXISTS events_location_idx ON events USING GIST (ll_to_earth(latitude, longitude));

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
