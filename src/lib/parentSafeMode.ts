import { supabase } from "@/integrations/supabase/client";

export interface RideSummary {
  rideId: string;
  source: string;
  destination: string;
  date: string;
  time: string;
  passengers: Array<{
    name: string;
    phone: string;
    trustScore: number;
  }>;
  estimatedFare: number;
  hostName: string;
  girls_only: boolean;
}

/**
 * Generate a ride summary for sharing with parents
 */
export const generateRideSummary = async (rideId: string, userId: string): Promise<RideSummary> => {
  // Get ride details
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      id,
      source,
      destination,
      date,
      time,
      estimated_fare,
      girls_only,
      profiles:host_id (name, phone, trust_score)
    `)
    .eq('id', rideId)
    .maybeSingle();

  if (rideError) throw rideError;

  // Get all members
  const { data: members, error: membersError } = await supabase
    .from('ride_members')
    .select(`
      user_id,
      profiles:user_id (name, phone, trust_score)
    `)
    .eq('ride_id', rideId);

  if (membersError) throw membersError;

  return {
    rideId,
    source: ride.source,
    destination: ride.destination,
    date: ride.date,
    time: ride.time,
    estimatedFare: ride.estimated_fare,
    hostName: ride.profiles?.name || 'Unknown',
    girls_only: ride.girls_only,
    passengers: [
      {
        name: ride.profiles?.name,
        phone: ride.profiles?.phone,
        trustScore: ride.profiles?.trust_score,
      },
      ...members.map((m) => ({
        name: m.profiles?.name,
        phone: m.profiles?.phone,
        trustScore: m.profiles?.trust_score,
      })),
    ].filter((p) => p.name), // Remove nulls
  };
};

/**
 * Format ride summary for SMS/message
 */
export const formatRideSummaryMessage = (summary: RideSummary): string => {
  const passengerList = summary.passengers
    .map((p) => `${p.name} (⭐${p.trustScore})`)
    .join(', ');

  return `My Rydin ride:
📍 ${summary.source} → ${summary.destination}
📅 ${summary.date} at ${summary.time}
👥 Passengers: ${passengerList}
💰 Cost: ₹${summary.estimatedFare}
${summary.girls_only ? '🛡️ Girls-only ride' : ''}

Stay safe!`;
};

/**
 * Get parent contact info for a user
 */
export const getParentContact = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('emergency_contact_name, emergency_contact_phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Enable parent-safe mode for a ride (logs sharing)
 */
export const enableParentSafeMode = async (userId: string, rideId: string) => {
  // In production, this would integrate with SMS API (Twilio, etc.)
  // For now, just log the action
  const { error } = await supabase
    .from('ride_parent_shares')
    .insert({
      user_id: userId,
      ride_id: rideId,
      shared_at: new Date().toISOString(),
    });

  if (error && error.code !== 'PGRST116') throw error; // Ignore if table doesn't exist yet
};

/**
 * Get sharing history for a user
 */
export const getParentShareHistory = async (userId: string) => {
  const { data, error } = await supabase
    .from('ride_parent_shares')
    .select(`
      id,
      ride_id,
      shared_at,
      rides (source, destination, date, time)
    `)
    .eq('user_id', userId)
    .order('shared_at', { ascending: false })
    .limit(10);

  if (error && error.code !== 'PGRST116') throw error; // Ignore if table doesn't exist
  return data || [];
};
