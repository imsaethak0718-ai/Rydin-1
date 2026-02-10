import { supabase } from "@/integrations/supabase/client";

export interface RideMemory {
  id: string;
  rideId: string;
  userId: string;
  title: string; // User-customizable title like "Airport trip - Feb 6"
  date: string;
  source: string;
  destination: string;
  amountPaid: number;
  amountSaved: number;
  totalCost: number;
  passengers: Array<{
    name: string;
    trustScore: number;
    department?: string;
  }>;
  memoryCreatedAt: string;
  notes?: string;
}

/**
 * Create a memory for a completed ride
 */
export const createRideMemory = async (
  rideId: string,
  userId: string,
  title: string,
  amountPaid: number,
  amountSaved: number,
  totalCost: number
) => {
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select('source, destination, date')
    .eq('id', rideId)
    .maybeSingle();

  if (rideError) throw rideError;

  const { data: members, error: membersError } = await supabase
    .from('ride_members')
    .select(`
      user_id,
      profiles:user_id (name, trust_score, department)
    `)
    .eq('ride_id', rideId);

  if (membersError) throw membersError;

  // Store memory (this would be in a ride_memories table in production)
  // For now, we'll just store a record
  const { error: insertError } = await supabase
    .from('ride_memories')
    .insert({
      ride_id: rideId,
      user_id: userId,
      title,
      date: ride.date,
      source: ride.source,
      destination: ride.destination,
      amount_paid: amountPaid,
      amount_saved: amountSaved,
      total_cost: totalCost,
      passengers: members.map((m) => ({
        name: m.profiles?.name,
        trustScore: m.profiles?.trust_score,
        department: m.profiles?.department,
      })),
      created_at: new Date().toISOString(),
    });

  if (insertError && insertError.code !== 'PGRST116') throw insertError; // Ignore if table doesn't exist

  return {
    rideId,
    title,
    amountSaved,
    passengerCount: members.length,
  };
};

/**
 * Get all ride memories for a user
 */
export const getRideMemories = async (userId: string) => {
  const { data, error } = await supabase
    .from('ride_memories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') throw error; // Ignore if table doesn't exist
  return data || [];
};

/**
 * Update ride memory title (user customization)
 */
export const updateRideMemoryTitle = async (memoryId: string, newTitle: string) => {
  const { error } = await supabase
    .from('ride_memories')
    .update({ title: newTitle })
    .eq('id', memoryId);

  if (error) throw error;
};

/**
 * Add notes to a ride memory
 */
export const addRideMemoryNotes = async (memoryId: string, notes: string) => {
  const { error } = await supabase
    .from('ride_memories')
    .update({ notes })
    .eq('id', memoryId);

  if (error) throw error;
};

/**
 * Get statistics for ride memories
 */
export const getRideMemoryStats = async (userId: string) => {
  const memories = await getRideMemories(userId);

  const totalRides = memories.length;
  const totalSaved = memories.reduce((sum, m: any) => sum + (m.amount_saved || 0), 0);
  const totalAmountPaid = memories.reduce((sum, m: any) => sum + (m.amount_paid || 0), 0);
  const uniquePassengers = new Set(
    memories.flatMap((m: any) => m.passengers?.map((p: any) => p.name) || [])
  ).size;

  return {
    totalRides,
    totalSaved,
    totalAmountPaid,
    uniquePassengers,
    averageSavingsPerRide: totalRides > 0 ? Math.round(totalSaved / totalRides) : 0,
  };
};

/**
 * Get ride memory by ID
 */
export const getRideMemory = async (memoryId: string) => {
  const { data, error } = await supabase
    .from('ride_memories')
    .select('*')
    .eq('id', memoryId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Format memory for display
 */
export const formatRideMemory = (memory: RideMemory): string => {
  return `🚕 ${memory.title}
📍 ${memory.source} → ${memory.destination}
💰 Paid: ₹${memory.amountPaid} | Saved: ₹${memory.amountSaved}
👥 Rode with: ${memory.passengers.length} people
📅 ${memory.date}`;
};
