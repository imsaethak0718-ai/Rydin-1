import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RideCard from "@/components/RideCard";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const filters = ["All", "Airport", "Station", "Girls Only"];

interface RideWithHost {
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
  host_id: string;
  profiles: { name: string; trust_score: number; department: string | null } | null;
}

const Index = () => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [rides, setRides] = useState<RideWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const { toast } = useToast();

  const fetchRides = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*, profiles!rides_host_id_fkey(name, trust_score, department)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRides(data as unknown as RideWithHost[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const filteredRides = rides.filter((ride) => {
    if (activeFilter === "Airport") return ride.destination.toLowerCase().includes("airport");
    if (activeFilter === "Station") return ride.destination.toLowerCase().includes("station");
    if (activeFilter === "Girls Only") return ride.girls_only;
    return true;
  });

  const handleJoin = async (id: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from("ride_members").insert({
      ride_id: id,
      user_id: session.user.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Increment seats_taken
    const ride = rides.find((r) => r.id === id);
    if (ride) {
      await supabase.from("rides").update({ seats_taken: ride.seats_taken + 1 }).eq("id", id);
    }
    toast({ title: "Ride joined! 🎉", description: "You've been added to this ride group." });
    fetchRides();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold font-display">Rydin</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> SRM Campus
              </p>
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <Badge
                key={f}
                variant={activeFilter === f ? "default" : "outline"}
                className="cursor-pointer shrink-0 transition-colors"
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} available`}
          </p>
        </div>

        {filteredRides.map((ride, i) => (
          <RideCard
            key={ride.id}
            ride={{
              id: ride.id,
              source: ride.source,
              destination: ride.destination,
              date: ride.date,
              time: ride.time,
              seatsTotal: ride.seats_total,
              seatsTaken: ride.seats_taken,
              estimatedFare: ride.estimated_fare,
              girlsOnly: ride.girls_only,
              flightTrain: ride.flight_train || undefined,
              hostName: ride.profiles?.name || "Unknown",
              hostRating: ride.profiles?.trust_score ?? 4.0,
              hostDepartment: ride.profiles?.department || "",
            }}
            index={i}
            onJoin={handleJoin}
          />
        ))}

        {!loading && filteredRides.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-muted-foreground"
          >
            <p className="text-lg font-display font-semibold mb-1">No rides found</p>
            <p className="text-sm">Try a different filter or create a new ride</p>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
