/**
 * Leaderboards & Badges
 * Gamification system for user engagement
 */

import { supabase } from '@/integrations/supabase/client';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  category: 'rides' | 'trust' | 'referral' | 'reliability';
}

export const BADGES: Badge[] = [
  {
    id: 'first_split',
    name: 'First Split',
    description: 'Created your first cost split',
    icon: '🎉',
    requirement: 1,
    category: 'rides',
  },
  {
    id: '10_rides',
    name: 'Road Tripper',
    description: 'Completed 10 rides',
    icon: '🚗',
    requirement: 10,
    category: 'rides',
  },
  {
    id: '50_rides',
    name: 'Travel Master',
    description: 'Completed 50 rides',
    icon: '🌍',
    requirement: 50,
    category: 'rides',
  },
  {
    id: 'trusted_user',
    name: 'Trusted User',
    description: 'Reached 4.5+ trust score',
    icon: '⭐',
    requirement: 45,
    category: 'trust',
  },
  {
    id: 'referral_king',
    name: 'Referral King',
    description: 'Successfully referred 5 friends',
    icon: '👑',
    requirement: 5,
    category: 'referral',
  },
  {
    id: 'reliable_rider',
    name: 'Reliable Rider',
    description: 'Zero no-shows in 20 rides',
    icon: '✅',
    requirement: 20,
    category: 'reliability',
  },
];

/**
 * Get user badges
 */
export const getUserBadges = async (userId: string): Promise<Badge[]> => {
  try {
    const { data: rideCount } = await supabase
      .from('split_members')
      .select('*')
      .eq('user_id', userId);

    const { data: profile } = await supabase
      .from('profiles')
      .select('trust_score')
      .eq('id', userId)
      .maybeSingle();

    const userBadges: Badge[] = [];

    // Check which badges user qualifies for
    BADGES.forEach((badge) => {
      if (badge.category === 'rides' && (rideCount?.length || 0) >= badge.requirement) {
        userBadges.push(badge);
      }
      if (badge.category === 'trust' && (profile?.trust_score || 0) >= badge.requirement / 10) {
        userBadges.push(badge);
      }
    });

    return userBadges;
  } catch (error) {
    console.error('Failed to get badges:', error);
    return [];
  }
};

/**
 * Get leaderboard - top reliable riders
 */
export const getReliabilityLeaderboard = async (limit: number = 10) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, trust_score')
      .order('trust_score', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((user, index) => ({
      rank: index + 1,
      user_id: user.id,
      name: user.name,
      score: user.trust_score,
      badge: '⭐',
    }));
  } catch (error) {
    console.error('Failed to get reliability leaderboard:', error);
    return [];
  }
};

/**
 * Get leaderboard - top splitters (most rides)
 */
export const getTopSplittersLeaderboard = async (limit: number = 10) => {
  try {
    // Get users with most splits
    const { data, error } = await supabase
      .from('split_members')
      .select('user_id, count(*) as ride_count')
      .groupBy('user_id')
      .order('ride_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const userIds = (data || []).map((d: any) => d.user_id);

    // Get user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    return (data || []).map((stat: any, index) => {
      const profile = profiles?.find((p) => p.id === stat.user_id);
      return {
        rank: index + 1,
        user_id: stat.user_id,
        name: profile?.name || 'Unknown',
        rides: stat.ride_count,
        badge: '🚗',
      };
    });
  } catch (error) {
    console.error('Failed to get toppers leaderboard:', error);
    return [];
  }
};

/**
 * Get leaderboard - top referrers
 */
export const getTopReferrersLeaderboard = async (limit: number = 10) => {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('referrer_id, count(*) as referral_count')
      .eq('status', 'completed')
      .groupBy('referrer_id')
      .order('referral_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const userIds = (data || []).map((d: any) => d.referrer_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    return (data || []).map((stat: any, index) => {
      const profile = profiles?.find((p) => p.id === stat.referrer_id);
      return {
        rank: index + 1,
        user_id: stat.referrer_id,
        name: profile?.name || 'Unknown',
        referrals: stat.referral_count,
        earnings: stat.referral_count * 50, // ₹50 per referral
        badge: '👑',
      };
    });
  } catch (error) {
    console.error('Failed to get referrers leaderboard:', error);
    return [];
  }
};

/**
 * Award badge to user
 */
export const awardBadgeToUser = async (userId: string, badgeId: string): Promise<boolean> => {
  try {
    console.log(`🏆 Awarding badge ${badgeId} to user ${userId}`);
    // In real app, save to user_badges table
    return true;
  } catch (error) {
    console.error('Failed to award badge:', error);
    return false;
  }
};
