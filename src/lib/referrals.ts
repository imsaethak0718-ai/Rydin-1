/**
 * Referral System
 * Give ₹50 credit per successful referral
 */

import { supabase } from '@/integrations/supabase/client';

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  credit_amount: number;
  status: 'pending' | 'completed';
  created_at: string;
}

const REFERRAL_CREDIT = 50; // ₹50 per referral

/**
 * Generate referral link for a user
 */
export const generateReferralLink = (userId: string): string => {
  const baseUrl = window.location.origin;
  const referralCode = btoa(userId).substring(0, 12); // Simple encoding
  return `${baseUrl}/?ref=${referralCode}`;
};

/**
 * Get referral code from URL
 */
export const getReferralCodeFromURL = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
};

/**
 * Decode referral code to user ID
 */
export const decodeReferralCode = (code: string): string => {
  try {
    // Pad with = if needed
    const padded = code + '='.repeat((4 - (code.length % 4)) % 4);
    return atob(padded);
  } catch {
    return '';
  }
};

/**
 * Track referral signup
 */
export const trackReferralSignup = async (
  newUserId: string,
  referrerUserId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerUserId,
        referee_id: newUserId,
        credit_amount: REFERRAL_CREDIT,
        status: 'pending',
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to track referral:', error);
    return false;
  }
};

/**
 * Complete referral and give credit
 */
export const completeReferral = async (referralId: string): Promise<boolean> => {
  try {
    const { data: referral, error: fetchError } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .maybeSingle();

    if (fetchError || !referral) throw new Error('Referral not found');

    // Update referral status
    const { error: updateError } = await supabase
      .from('referrals')
      .update({ status: 'completed' })
      .eq('id', referralId);

    if (updateError) throw updateError;

    // Give credit to referrer (implement with credits table)
    console.log(`✅ Referral completed: ${referral.referrer_id} earned ₹${referral.credit_amount}`);
    return true;
  } catch (error) {
    console.error('Failed to complete referral:', error);
    return false;
  }
};

/**
 * Get user's referral stats
 */
export const getUserReferralStats = async (userId: string) => {
  try {
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId);

    if (error) throw error;

    const completed = referrals?.filter((r) => r.status === 'completed') || [];
    const pending = referrals?.filter((r) => r.status === 'pending') || [];
    const totalEarned = completed.length * REFERRAL_CREDIT;

    return {
      total_referrals: referrals?.length || 0,
      completed_referrals: completed.length,
      pending_referrals: pending.length,
      total_earned: totalEarned,
      referral_link: generateReferralLink(userId),
    };
  } catch (error) {
    console.error('Failed to get referral stats:', error);
    return null;
  }
};

/**
 * Get top referrers
 */
export const getTopReferrers = async (limit: number = 10) => {
  try {
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('referrer_id, count(*) as count')
      .eq('status', 'completed')
      .groupBy('referrer_id')
      .order('count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return referrals || [];
  } catch (error) {
    console.error('Failed to get top referrers:', error);
    return [];
  }
};
