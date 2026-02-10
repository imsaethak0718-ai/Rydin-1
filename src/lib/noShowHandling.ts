import { supabase } from "@/integrations/supabase/client";

export type ReliabilityStatus = 'excellent' | 'good' | 'fair' | 'warning' | 'restricted';

export interface ReliabilityMetrics {
  noShowCount: number;
  completedRides: number;
  reliability: number; // 0-100%
  status: ReliabilityStatus;
  canJoinRides: boolean;
  joinLimitPerDay?: number;
}

/**
 * Get reliability metrics for a user
 */
export const getUserReliability = async (userId: string): Promise<ReliabilityMetrics> => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('no_show_count, completed_rides, reliability_score')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  const noShowCount = profile?.no_show_count ?? 0;
  const completedRides = profile?.completed_rides ?? 0;
  const reliabilityScore = profile?.reliability_score ?? 100;

  return {
    noShowCount,
    completedRides,
    reliability: reliabilityScore,
    status: getReliabilityStatus(noShowCount, reliabilityScore),
    canJoinRides: noShowCount < 3,
    joinLimitPerDay: noShowCount >= 2 ? 2 : undefined, // Max 2 rides/day after 2 no-shows
  };
};

/**
 * Determine reliability status based on no-shows
 */
const getReliabilityStatus = (noShowCount: number, reliabilityScore: number): ReliabilityStatus => {
  if (reliabilityScore >= 95) return 'excellent';
  if (reliabilityScore >= 80) return 'good';
  if (reliabilityScore >= 60) return 'fair';
  if (noShowCount >= 2) return 'restricted';
  if (noShowCount === 1) return 'warning';
  return 'fair';
};

/**
 * Mark a user as no-show for a ride
 * Implements soft penalty system
 */
export const markAsNoShow = async (userId: string) => {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('no_show_count, reliability_score')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const currentNoShows = profile?.no_show_count ?? 0;
  const currentReliability = profile?.reliability_score ?? 100;

  let penalty = 0;
  let action = '';

  if (currentNoShows === 0) {
    // First no-show: warning only, -10 reliability
    penalty = 10;
    action = 'warning';
  } else if (currentNoShows === 1) {
    // Second no-show: -20 reliability, join limit applied
    penalty = 20;
    action = 'restricted';
  } else {
    // Third+ no-show: -30 reliability, heavily restricted
    penalty = 30;
    action = 'heavily_restricted';
  }

  const newReliability = Math.max(0, currentReliability - penalty);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      no_show_count: currentNoShows + 1,
      reliability_score: newReliability,
      last_no_show_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) throw updateError;

  return {
    action,
    newNoShowCount: currentNoShows + 1,
    newReliability,
    message: getNoShowMessage(currentNoShows),
  };
};

/**
 * Get user-friendly message for no-show
 */
const getNoShowMessage = (noShowCount: number): string => {
  switch (noShowCount) {
    case 0:
      return '⚠️ First no-show recorded. We sent you a warning. Please be reliable.';
    case 1:
      return '⚠️ Second no-show. Your join limit is now 2 rides/day. One more will restrict your account.';
    case 2:
      return '🔴 Third no-show. Your account is now restricted. Contact support to appeal.';
    default:
      return '❌ Account restricted due to multiple no-shows.';
  }
};

/**
 * Clear no-show count after 60 days of good behavior
 */
export const clearNoShowCount = async (userId: string) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      no_show_count: 0,
      reliability_score: 100,
      no_show_cleared_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
};

/**
 * Get reliability badge component config
 */
export const getReliabilityBadgeConfig = (status: ReliabilityStatus) => {
  const config = {
    excellent: {
      icon: '⭐',
      label: 'Excellent',
      color: 'bg-green-50 text-green-700 border-green-200',
      description: 'Highly reliable member',
    },
    good: {
      icon: '✅',
      label: 'Good',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Reliable member',
    },
    fair: {
      icon: '📊',
      label: 'Fair',
      color: 'bg-gray-50 text-gray-700 border-gray-200',
      description: 'Average reliability',
    },
    warning: {
      icon: '⚠️',
      label: 'Warning',
      color: 'bg-orange-50 text-orange-700 border-orange-200',
      description: '1 no-show on record',
    },
    restricted: {
      icon: '🔴',
      label: 'Restricted',
      color: 'bg-red-50 text-red-700 border-red-200',
      description: '2+ no-shows - limited to 2 rides/day',
    },
  };

  return config[status];
};
