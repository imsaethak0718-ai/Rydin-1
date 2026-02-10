import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search as SearchIcon, MapPin, Calendar, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RideCard from "@/components/RideCard";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeRides } from "@/hooks/useRealtimeRides";
import { joinRideAtomic } from "@/lib/database";

const Search = () => {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { toast } = useToast();

  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [searched, setSearched] = useState(false);
  const [userRides, setUserRides] = useState<Set<string>>(new Set());
  const [filteredRides, setFilteredRides] = useState<any[]>([]);

  // Use real-time rides hook for all rides
  const { rides: allRides, loading } = useRealtimeRides({
    status: ["open", "full", "locked"],
  });

  // Popular routes for quick access
  const popularRoutes = [
    { from: "SRM Campus", to: "Chennai Airport" },
    { from: "SRM Campus", to: "Central Station" },
    { from: "SRM Campus", to: "Tambaram Station" },
    { from: "SRM Campus", to: "CMBT Bus Stand" },
  ];

  // Filter rides based on search criteria
  useEffect(() => {
    if (searched && allRides.length > 0) {
      let filtered = allRides;

      if (source.trim()) {
        filtered = filtered.filter((ride) =>
          ride.source.toLowerCase().includes(source.toLowerCase())
        );
      }

      if (destination.trim()) {
        filtered = filtered.filter((ride) =>
          ride.destination.toLowerCase().includes(destination.toLowerCase())
        );
      }

      if (date) {
        filtered = filtered.filter((ride) => ride.date === date);
      }

      if (maxPrice) {
        filtered = filtered.filter((ride) => ride.estimated_fare <= parseFloat(maxPrice));
      }

      if (girlsOnly) {
        filtered = filtered.filter((ride) => ride.girls_only);
      }

      setFilteredRides(filtered);
    }
  }, [source, destination, date, maxPrice, girlsOnly, allRides, searched]);

  // Fetch user's ride memberships
  useEffect(() => {
    const fetchUserRides = async () => {
      if (session?.user) {
        const { data: memberships } = await supabase
          .from("ride_members")
          .select("ride_id")
          .eq("user_id", session.user.id);

        if (memberships) {
          setUserRides(new Set(memberships.map((m) => m.ride_id)));
        }
      }
    };

    fetchUserRides();
  }, [session?.user]);

  const handleSearch = () => {
    if (!source.trim() || !destination.trim()) {
      toast({ title: "Please fill in source and destination", variant: "destructive" });
      return;
    }

    setSearched(true);
  };

  const handleJoin = async (id: string) => {
    if (!session?.user) return;

    try {
      const result = await joinRideAtomic(id, session.user.id);

      if (!result.success) {
        toast({ title: "Cannot join", description: result.error, variant: "destructive" });
        return;
      }

      toast({ title: "Ride joined!", description: "You've been added to this ride group." });
      setUserRides((prev) => new Set([...prev, id]));
      // Real-time update will happen automatically through the hook
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const quickSelect = (from: string, to: string) => {
    setSource(from);
    setDestination(to);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold font-display">Search Rides</h1>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto px-4 sm:px-6 py-4 space-y-4"
      >
        {/* Search Card */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="From (e.g., SRM Campus)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="pl-10 h-11 bg-background text-base sm:text-sm"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="To (e.g., Airport)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="pl-10 h-11 bg-background text-base sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-10 h-11 bg-background text-base sm:text-sm"
              />
            </div>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Max fare"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="pl-10 h-11 bg-background text-base sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
            <input
              type="checkbox"
              id="girls-only"
              checked={girlsOnly}
              onChange={(e) => setGirlsOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="girls-only" className="text-sm font-medium cursor-pointer">
              Girls-only rides only
            </label>
          </div>

          <Button onClick={handleSearch} className="w-full h-12 sm:h-11">
            <SearchIcon className="w-4 h-4 mr-2" />
            Search Rides
          </Button>
        </div>

        {/* Quick Select Routes */}
        {!searched && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Popular Routes</p>
            <div className="grid grid-cols-1 gap-2">
              {popularRoutes.map((route, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => quickSelect(route.from, route.to)}
                  className="text-left p-3 bg-card rounded-lg border border-border hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{route.to}</p>
                      <p className="text-xs text-muted-foreground">{route.from}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {searched && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {`${filteredRides.length} ride${filteredRides.length !== 1 ? "s" : ""} found`}
              </p>
            </div>

            {filteredRides.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-display font-semibold mb-1">No rides found</p>
                <p className="text-sm">Try different search criteria</p>
              </motion.div>
            ) : (
              filteredRides.map((ride, i) => (
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
                    hostId: ride.host_id,
                    status: ride.status,
                  }}
                  index={i}
                  onJoin={handleJoin}
                  isHost={user?.id === ride.host_id}
                  isJoined={userRides.has(ride.id)}
                />
              ))
            )}
          </div>
        )}
      </motion.main>

      <BottomNav />
    </div>
  );
};

export default Search;
