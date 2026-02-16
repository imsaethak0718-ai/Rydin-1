import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RideWithHost {
  id: string;
  source: string;
  destination: string;
  date: string;
  time: string;
  seats_total: number;
  seats_taken: number;
  estimated_fare: number;
  girls_only: boolean;
  flight_train: string | null;
  scheduled_ride_url: string | null;
  host_id: string;
  status: string;
  created_at: string;
  profiles: { name: string; trust_score: number; department: string | null } | null;
}

export const useRealtimeRides = (filters?: {
  status?: string[];
  destination?: string;
  source?: string;
}) => {
  const [rides, setRides] = useState<RideWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channel = useState<RealtimeChannel | null>(null)[0];
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const { session } = useAuth(); // Get auth session context

  useEffect(() => {
    // CRITICAL: Wait for session to be established before fetching
    if (!session) {
      console.log("⏳ Waiting for auth session to be established...");
      setLoading(true);
      return;
    }

    const fetchRides = async (retryCount = 0) => {
      try {
        setLoading(true);
        retryCountRef.current = retryCount;

        // Build query step by step for better error reporting
        console.log("Starting fetch with filters:", filters);

        // Fetch rides first (without joins to avoid relationship cache issues)
        let query = supabase
          .from("rides")
          .select("id, source, destination, date, time, seats_total, seats_taken, estimated_fare, girls_only, flight_train, scheduled_ride_url, host_id, status, created_at");

        if (filters?.status && filters.status.length > 0) {
          query = query.in("status", filters.status);
        } else {
          query = query.in("status", ["open", "full", "locked"]);
        }

        if (filters?.destination) {
          query = query.ilike("destination", `%${filters.destination}%`);
        }

        if (filters?.source) {
          query = query.ilike("source", `%${filters.source}%`);
        }

        // Wrap query execution in a timeout to prevent hanging requests
        // query = query.order("created_at", { ascending: false }); // SAFEGUARD: created_at might be missing
        // Filter out past rides
        const today = new Date().toISOString().split('T')[0];
        query = query.gte("date", today);
        query = query.order("date", { ascending: true });

        // Execute query WITHOUT custom timeout to see real error
        const { data: ridesData, error: fetchError } = await query;

        // Timeout wrapper removed for debugging
        /*
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Supabase request timed out")), 5000)
        );
        const result: any = await Promise.race([queryPromise, timeoutPromise]);
        const { data: ridesData, error: fetchError } = result;
        */

        if (fetchError) {
          const errorMsg = fetchError.message || (fetchError as any).error_description || String(fetchError);
          const errorCode = (fetchError as any)?.code;
          const errorStatus = (fetchError as any)?.status;

          // Only log critical errors, ignore expected timeouts during nav
          if (!errorMsg.includes("timed out") && !errorMsg.includes("network")) {
            console.error("❌ Error fetching rides:", errorMsg);
          }
          console.error("Supabase fetch error - code:", errorCode);
          console.error("Supabase fetch error - status:", errorStatus);
          console.error("Full error object:", fetchError);

          // Provide specific guidance based on error
          if (errorStatus === 404) {
            throw new Error("Rides table not found. Did you run the SQL migrations?");
          } else if (errorStatus === 403) {
            throw new Error("Access denied - RLS policies may be blocking read access");
          } else if (errorMsg.includes("relation") && errorMsg.includes("does not exist")) {
            throw new Error(`Database table error: ${errorMsg}`);
          } else {
            throw new Error(`Supabase: ${errorMsg}`);
          }
        }

        // Fetch profiles for all hosts
        if (ridesData && ridesData.length > 0) {
          const hostIds = [...new Set(ridesData.map(r => r.host_id))];
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, name, trust_score, department")
            .in("id", hostIds);

          if (!profilesError && profilesData) {
            // Create a map of profiles by ID
            const profilesMap = new Map(profilesData.map(p => [p.id, p]));

            // Merge profiles into rides
            const ridesWithProfiles = ridesData.map(ride => ({
              ...ride,
              profiles: profilesMap.get(ride.host_id) || null
            }));

            setRides(ridesWithProfiles as unknown as RideWithHost[]);
          } else {
            setRides(ridesData as unknown as RideWithHost[]);
          }
        } else {
          setRides([]);
        }

        setError(null);
      } catch (err) {
        let errorDetail = "Unknown error";
        let isNetworkError = false;

        if (err instanceof TypeError) {
          // Network errors are TypeErrors
          if (err.message.includes("Failed to fetch")) {
            isNetworkError = true;
            errorDetail = "Network Error - Cannot reach Supabase";

            // Retry logic for network errors
            if (retryCount < maxRetries) {
              console.warn(`Network error, retrying (${retryCount + 1}/${maxRetries})...`);
              setLoading(false);
              setTimeout(() => {
                fetchRides(retryCount + 1);
              }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s, 3s
              return;
            }
          } else {
            errorDetail = err.message;
          }
        } else if (err instanceof Error) {
          errorDetail = err.message;
        } else if (err && typeof err === 'object') {
          errorDetail = (err as any).message || (err as any).error_description || JSON.stringify(err);
        } else {
          errorDetail = String(err);
        }

        console.error("useRealtimeRides caught error:", errorDetail);
        console.error("Full error object in catch:", err);

        if (isNetworkError) {
          setError(new Error(`${errorDetail}\n\nTried ${retryCount} times. Check your internet connection, firewall, or Supabase project status.\n\nRun debugSupabase() in console for more info.`));
        } else {
          setError(new Error(`Failed to fetch rides: ${errorDetail}`));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRides();

    // Set up real-time subscription
    const subscription = supabase
      .channel("rides-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch new ride data
            supabase
              .from("rides")
              .select("id, source, destination, date, time, seats_total, seats_taken, estimated_fare, girls_only, flight_train, scheduled_ride_url, host_id, status, created_at")
              .eq("id", payload.new.id)
              .maybeSingle()
              .then(({ data: newRide }) => {
                if (newRide && newRide.host_id) {
                  // Fetch host profile
                  supabase
                    .from("profiles")
                    .select("id, name, trust_score, department")
                    .eq("id", newRide.host_id)
                    .maybeSingle()
                    .then(({ data: profile }) => {
                      if (newRide) {
                        setRides((prev) => [
                          { ...newRide, profiles: profile } as RideWithHost,
                          ...prev,
                        ]);
                      }
                    });
                }
              });
          } else if (payload.eventType === "UPDATE") {
            // Update existing ride
            setRides((prev) =>
              prev.map((ride) =>
                ride.id === payload.new.id
                  ? { ...ride, ...payload.new }
                  : ride
              )
            );
          } else if (payload.eventType === "DELETE") {
            // Remove deleted ride
            setRides((prev) => prev.filter((ride) => ride.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session, filters?.status, filters?.destination, filters?.source]);

  return { rides, loading, error };
};

export const useRealtimeRideMembers = (rideId: string) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // Fetch members without join first
        const { data: membersData, error } = await supabase
          .from("ride_members")
          .select("id, user_id, joined_at, payment_status, ride_id")
          .eq("ride_id", rideId);

        if (error) {
          const errorMsg = error.message || JSON.stringify(error);
          console.error("Error fetching members:", errorMsg);
          throw error;
        }

        // Fetch profiles for all members
        if (membersData && membersData.length > 0) {
          const userIds = membersData.map(m => m.user_id);
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, name, trust_score, department, phone")
            .in("id", userIds);

          if (!profilesError && profilesData) {
            // Create a map of profiles by ID
            const profilesMap = new Map(profilesData.map(p => [p.id, p]));

            // Merge profiles into members
            const membersWithProfiles = membersData.map(member => ({
              ...member,
              profiles: profilesMap.get(member.user_id) || null
            }));

            setMembers(membersWithProfiles);
          } else {
            setMembers(membersData);
          }
        } else {
          setMembers([]);
        }
      } catch (err) {
        const errorDetail = err instanceof Error
          ? err.message
          : err && typeof err === 'object'
            ? JSON.stringify(err)
            : String(err);
        console.error("useRealtimeRideMembers error:", errorDetail);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();

    // Subscribe to member changes
    const subscription = supabase
      .channel(`ride-${rideId}-members`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_members",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch new member data first
            supabase
              .from("ride_members")
              .select("id, user_id, joined_at, payment_status, ride_id")
              .eq("id", payload.new.id)
              .maybeSingle()
              .then(async ({ data: newMember }) => {
                if (newMember) {
                  // Then fetch their profile
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("id, name, trust_score, department, phone")
                    .eq("id", newMember.user_id)
                    .maybeSingle();

                  setMembers((prev) => [...prev, { ...newMember, profiles: profile }]);
                }
              });
          } else if (payload.eventType === "DELETE") {
            setMembers((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [rideId]);

  return { members, loading };
};
