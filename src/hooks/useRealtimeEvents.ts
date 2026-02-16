import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Event {
  id: string;
  name: string;
  location: string;
  distance_km?: number;
  date: string;
  start_time: string;
  end_time?: string;
  category: string;
  description?: string;
  created_by: string;
  image_url?: string;
  created_at: string;
  interested_count?: number;
  is_interested?: boolean;
}

export const useRealtimeEvents = (filter: string = "all") => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let subscription: any;

    const fetchAndSubscribe = async () => {
      try {
        setIsLoading(true);

        // Initial fetch
        const query = supabase
          .from("events")
          .select("*")
          .gte("event_date", new Date().toISOString().split("T")[0])
          .order("event_date", { ascending: true });

        if (filter !== "all") {
          query.eq("category", filter);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Fetch interest counts for each event
        const eventsWithInterest = await Promise.all(
          (data || []).map(async (event) => {
            const { count } = await supabase
              .from("event_interested_users")
              .select("*", { count: "exact" })
              .eq("event_id", event.id);

            const { data: userInterest } = await supabase
              .from("event_interested_users")
              .select("*")
              .eq("event_id", event.id)
              .eq("user_id", user?.id)
              .maybeSingle();

            return {
              ...event,
              name: event.title,
              date: event.event_date,
              start_time: event.event_time,
              image_url: event.image_url,
              interested_count: count || 0,
              is_interested: !!userInterest,
            };
          })
        );

        setEvents(eventsWithInterest);

        // Real-time subscription for events
        subscription = supabase
          .channel("events-channel")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "events",
            },
            (payload) => {
              if (payload.eventType === "INSERT") {
                const newEvent: Event = {
                  ...payload.new,
                  id: payload.new.id,
                  name: payload.new.title,
                  location: payload.new.location,
                  date: payload.new.event_date,
                  start_time: payload.new.event_time,
                  category: payload.new.category,
                  created_by: payload.new.organizer_id,
                  created_at: payload.new.created_at,
                  image_url: payload.new.image_url,
                  interested_count: 0,
                  is_interested: false,
                } as Event;
                setEvents((prev) => [...prev, newEvent]);
              } else if (payload.eventType === "UPDATE") {
                setEvents((prev) =>
                  prev.map((e) => (e.id === payload.new.id ? {
                    ...e,
                    ...payload.new,
                    name: payload.new.title,
                    date: payload.new.event_date,
                    start_time: payload.new.event_time,
                    image_url: payload.new.image_url,
                  } as Event : e))
                );
              } else if (payload.eventType === "DELETE") {
                setEvents((prev) => prev.filter((e) => e.id !== payload.old.id));
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "event_interested_users",
            },
            (payload) => {
              setEvents((prev) =>
                prev.map((e) => {
                  if (e.id === payload.new.event_id) {
                    return {
                      ...e,
                      interested_count: (e.interested_count || 0) + 1,
                      is_interested:
                        user?.id === payload.new.user_id ? true : e.is_interested,
                    };
                  }
                  return e;
                })
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "event_interested_users",
            },
            (payload) => {
              setEvents((prev) =>
                prev.map((e) => {
                  if (e.id === payload.old.event_id) {
                    return {
                      ...e,
                      interested_count: Math.max(0, (e.interested_count || 0) - 1),
                      is_interested:
                        user?.id === payload.old.user_id ? false : e.is_interested,
                    };
                  }
                  return e;
                })
              );
            }
          )
          .subscribe();

        setError(null);
      } catch (err: any) {
        console.error("Error fetching events:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [filter, user?.id]);

  return { events, isLoading, error };
};
