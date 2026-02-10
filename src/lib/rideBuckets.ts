import { supabase } from "@/integrations/supabase/client";

export interface RideBucket {
  id: string;
  name: string;
  source: string;
  destination: string;
  category: 'airport' | 'railway' | 'metro' | 'custom';
  description?: string;
  estimatedFare: number;
  typicalTime: string;
  defaultSeats: number;
  matchReason?: string;
}

// Common ride templates for auto-generation
export const RIDE_BUCKETS: RideBucket[] = [
  {
    id: 'airport-morning',
    name: 'SRM to Airport Morning',
    source: 'SRM Campus',
    destination: 'Chennai Airport (MAA)',
    category: 'airport',
    description: 'Early morning airport pickups',
    estimatedFare: 1200,
    typicalTime: '05:00 AM - 07:00 AM',
    defaultSeats: 4,
  },
  {
    id: 'airport-evening',
    name: 'SRM to Airport Evening',
    source: 'SRM Campus',
    destination: 'Chennai Airport (MAA)',
    category: 'airport',
    description: 'Evening airport pickups',
    estimatedFare: 1200,
    typicalTime: '03:00 PM - 06:00 PM',
    defaultSeats: 4,
  },
  {
    id: 'central-station',
    name: 'SRM to Central Station',
    source: 'SRM Campus',
    destination: 'Chennai Central Station',
    category: 'railway',
    description: 'Train travel from Chennai Central',
    estimatedFare: 800,
    typicalTime: '08:00 AM - 08:00 PM',
    defaultSeats: 3,
  },
  {
    id: 'tambaram-station',
    name: 'SRM to Tambaram Station',
    source: 'SRM Campus',
    destination: 'Tambaram Railway Station',
    category: 'railway',
    description: 'Train travel from Tambaram',
    estimatedFare: 400,
    typicalTime: '06:00 AM - 10:00 PM',
    defaultSeats: 4,
  },
  {
    id: 'cmbt-busstand',
    name: 'SRM to CMBT Bus Stand',
    source: 'SRM Campus',
    destination: 'CMBT Bus Stand',
    category: 'metro',
    description: 'Interstate bus travel',
    estimatedFare: 600,
    typicalTime: '05:00 AM - 10:00 PM',
    defaultSeats: 3,
  },
];

/**
 * Get all available ride buckets
 */
export const getRideBuckets = (): RideBucket[] => {
  return RIDE_BUCKETS;
};

/**
 * Create auto-generated rides from buckets
 * In production, this would be a cron job
 */
export const createAutoBucketRide = async (bucket: RideBucket, time: string, isGirlsOnly: boolean = false) => {
  const today = new Date().toISOString().split('T')[0];

  // Check if ride already exists for today at this time
  const { data: existing } = await supabase
    .from('rides')
    .select('id')
    .eq('source', bucket.source)
    .eq('destination', bucket.destination)
    .eq('date', today)
    .eq('time', time)
    .maybeSingle();

  if (existing) return existing; // Already exists

  // Create new ride
  const { data, error } = await supabase
    .from('rides')
    .insert({
      host_id: 'system', // Use a system user or null
      source: bucket.source,
      destination: bucket.destination,
      date: today,
      time,
      seats_total: bucket.defaultSeats,
      seats_taken: 0,
      estimated_fare: bucket.estimatedFare,
      girls_only: isGirlsOnly,
      status: 'open',
      bucket_id: bucket.id, // Track origin
      bucket_name: bucket.name,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Find matching bucket for a ride
 */
export const findMatchingBucket = (source: string, destination: string): RideBucket | null => {
  return RIDE_BUCKETS.find(
    (b) =>
      b.source.toLowerCase() === source.toLowerCase() &&
      b.destination.toLowerCase() === destination.toLowerCase()
  ) || null;
};

/**
 * Get match reason for displaying on ride card
 */
export const getMatchReason = (
  userDeparture?: string,
  userDestination?: string,
  flightTrain?: string
): string => {
  if (flightTrain) {
    return `Same flight/train: ${flightTrain}`;
  }
  if (userDestination?.toLowerCase().includes('airport')) {
    return 'Airport run';
  }
  if (userDestination?.toLowerCase().includes('station')) {
    return 'Railway travel';
  }
  return 'Same route';
};

/**
 * Get all rides for a specific bucket on a date
 */
export const getBucketRidesForDate = async (bucketId: string, date: string) => {
  const { data, error } = await supabase
    .from('rides')
    .select('*, profiles!rides_host_id_fkey(name, trust_score)')
    .eq('bucket_id', bucketId)
    .eq('date', date)
    .in('status', ['open', 'full', 'locked'])
    .order('time', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * System admin function to create batch auto-rides
 * Would be triggered by cron job in production
 */
export const createDailyAutoBuckets = async () => {
  const times = [
    '05:00 AM',
    '08:00 AM',
    '10:00 AM',
    '02:00 PM',
    '05:00 PM',
    '08:00 PM',
  ];

  const buckets = [RIDE_BUCKETS[0], RIDE_BUCKETS[2], RIDE_BUCKETS[4]]; // Airport, Central, CMBT

  for (const bucket of buckets) {
    for (const time of times) {
      try {
        await createAutoBucketRide(bucket, time, false);
        // Also create girls-only version for airport
        if (bucket.category === 'airport') {
          await createAutoBucketRide(bucket, time, true);
        }
      } catch (error) {
        console.warn(`Failed to create auto ride for ${bucket.name} at ${time}:`, error);
      }
    }
  }
};
