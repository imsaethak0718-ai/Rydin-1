import { supabase } from "@/integrations/supabase/client";

/**
 * Lock a ride (host commits to the ride)
 * Prevents new joins and triggers commitment mode
 */
export const lockRideForCommitment = async (rideId: string) => {
  const { error } = await supabase
    .from('rides')
    .update({
      status: 'locked',
      locked_at: new Date().toISOString(),
    })
    .eq('id', rideId);

  if (error) throw error;
};

/**
 * Unlock a ride (host can cancel before locked)
 * Available only before ride starts
 */
export const unlockRide = async (rideId: string) => {
  const { error } = await supabase
    .from('rides')
    .update({
      status: 'open',
      locked_at: null,
    })
    .eq('id', rideId);

  if (error) throw error;
};

/**
 * Get all members who committed to a ride
 */
export const getCommittedMembers = async (rideId: string) => {
  const { data, error } = await supabase
    .from('ride_members')
    .select(`
      id,
      user_id,
      joined_at,
      commitment_acknowledged,
      profiles:user_id (
        name,
        phone,
        trust_score
      )
    `)
    .eq('ride_id', rideId);

  if (error) throw error;
  return data;
};

/**
 * Mark user as acknowledged commitment for a ride
 */
export const acknowledgeCommitment = async (rideId: string, userId: string) => {
  const { error } = await supabase
    .from('ride_members')
    .update({ commitment_acknowledged: true })
    .eq('ride_id', rideId)
    .eq('user_id', userId);

  if (error) throw error;
};

/**
 * Get commitment status for a user in a ride
 */
export const getCommitmentStatus = async (rideId: string, userId: string) => {
  const { data, error } = await supabase
    .from('ride_members')
    .select('commitment_acknowledged')
    .eq('ride_id', rideId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.commitment_acknowledged ?? false;
};
