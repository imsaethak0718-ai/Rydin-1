import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Filter, MapPin, TrendingDown, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import RideCard from "@/components/RideCard";
import BottomNav from "@/components/BottomNav";
import PlatformDisclaimer from "@/components/PlatformDisclaimer";
import { RideListSkeleton } from "@/components/RideCardSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRides } from "@/hooks/useRealtimeRides";
import { requestJoinRide, calculateRideSavings } from "@/lib/database";
import { debugSupabase } from "@/lib/debugSupabase";

const filters = ["All", "Airport", "Station", "Girls Only"];

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

// ... existing imports ...

const Index = () => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("time"); // "time", "price", "seats"
  const [userRides, setUserRides] = useState<Set<string>>(new Set());
  const [totalSavings, setTotalSavings] = useState(0);
  const { session, user } = useAuth();
  const { toast } = useToast();

  // Make debug function available in console
  useEffect(() => {
    (window as any).debugSupabase = debugSupabase;
    console.log("💡 Tip: Run debugSupabase() in the console to diagnose Supabase connection");
  }, []);

  // Use real-time rides hook
  const { rides, loading, error: ridesError } = useRealtimeRides(
    useMemo(() => ({
      status: ["open", "full", "locked"],
    }), [])
  );

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

    // Subscribe to ride_members changes for current user
    const subscription = supabase
      .channel(`user-rides-${session?.user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_members",
          filter: `user_id=eq.${session?.user?.id}`,
        },
        () => {
          fetchUserRides();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session?.user?.id]);

  // Calculate savings whenever rides change
  useEffect(() => {
    const savings = rides.reduce((sum, ride) => {
      return sum + calculateRideSavings(ride.estimated_fare, ride.seats_total, ride.seats_taken);
    }, 0);
    setTotalSavings(savings);
  }, [rides]);

  const handleJoin = async (id: string) => {
    if (!session?.user) return;

    const targetRide = rides.find(r => r.id === id);
    if (targetRide?.girls_only && user?.gender !== 'female') {
      toast({
        title: "Access Restricted",
        description: "This ride is for female students only.",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await requestJoinRide(id, session.user.id);

      if (!result.success) {
        toast({
          title: "Request failed",
          description: result.error || "Unable to send request",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Request sent! 📩",
        description: "The host will be notified to approve your request."
      });

      // Update local state
      setUserRides(prev => new Set([...prev, id]));
    } catch (error: any) {
      console.error("Join ride error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to join ride",
        variant: "destructive"
      });
    }
  };

  const orderedRides = useMemo(() => {
    let result = [...rides];

    // 1. Filter
    result = result.filter((ride) => {
      // Safety check: hide girls only rides from non-females in all views
      if (ride.girls_only && user?.gender !== 'female') return false;

      // Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ride.destination.toLowerCase().includes(query) ||
          ride.source.toLowerCase().includes(query) ||
          (ride.flight_train && ride.flight_train.toLowerCase().includes(query));

        if (!matchesSearch) return false;
      }

      if (activeFilter === "Airport") return ride.destination.toLowerCase().includes("airport");
      if (activeFilter === "Station") return ride.destination.toLowerCase().includes("station");
      if (activeFilter === "Girls Only") return ride.girls_only;
      return true;
    });

    // 2. Sort
    result.sort((a, b) => {
      if (sortBy === "price") {
        return (a.estimated_fare || 0) - (b.estimated_fare || 0);
      } else if (sortBy === "seats") {
        const aSeats = (a.seats_total || 0) - (a.seats_taken || 0);
        const bSeats = (b.seats_total || 0) - (b.seats_taken || 0);
        return bSeats - aSeats; // Most available first
      } else {
        // Default: Time (Earliest first)
        // Combine date and time to compare correctly if dates differ, essentially usually same day next few hours
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      }
    });

    return result;
  }, [rides, activeFilter, sortBy, user?.gender, searchQuery]);

  // Replace filteredRides usage with orderedRides
  const filteredRides = orderedRides;

  // ... (keep existing handleJoin) ...

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display">Rydin</h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> SRM Campus
              </p>
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {filters
              .filter(f => f !== "Girls Only" || user?.gender === 'female')
              .map((f) => (
                <Badge
                  key={f}
                  variant={activeFilter === f ? "default" : "outline"}
                  className="cursor-pointer shrink-0 transition-colors text-xs sm:text-sm"
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </Badge>
              ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* WhatsApp Community Banner */}
        <div className="flex items-center justify-between bg-background border border-border rounded-xl p-4 mb-6 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-2 rounded-xl group-hover:bg-green-200 transition-colors">
              <ExternalLink className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-bold text-foreground">Join The Whatsapp Community</span>
          </div>

          <a
            href="https://chat.whatsapp.com/CHASTy1E4uiEe62LyT1fzy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 px-4 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-transform active:scale-95"
          >
            Join
          </a>
        </div>

        {/* Error Banner */}
        {ridesError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-300 rounded-lg p-4 text-red-900 text-sm space-y-2"
          >
            <p className="font-bold text-red-700">⚠️ Connection Error</p>
            <div className="bg-red-100 p-3 rounded font-mono text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words">
              {ridesError.message}
            </div>

            {ridesError.message.includes("Network Error") ? (
              <div className="text-xs space-y-2 bg-blue-50 p-3 rounded border border-blue-200">
                <p className="font-semibold text-blue-900">🌐 Network Connectivity Issue</p>
                <div className="space-y-1">
                  <p><strong>Step 1:</strong> Check your internet connection</p>
                  <p className="text-blue-800">- Open a new tab and go to google.com</p>
                  <p className="text-blue-800">- If it loads, your internet works</p>
                </div>
                <div className="space-y-1">
                  <p><strong>Step 2:</strong> Check if Supabase is up</p>
                  <p className="text-blue-800">- Visit: https://status.supabase.com/</p>
                  <p className="text-blue-800">- Check for any incidents</p>
                </div>
                <div className="space-y-1">
                  <p><strong>Step 3:</strong> Check firewall/VPN</p>
                  <p className="text-blue-800">- Temporarily disable VPN if using one</p>
                  <p className="text-blue-800">- Whitelist: ylyxhdlncslvqdkhzohs.supabase.co</p>
                </div>
                <p className="text-blue-800 mt-2">⏳ App will auto-retry every few seconds...</p>
              </div>
            ) : (
              <div className="text-xs space-y-1 bg-red-50 p-2 rounded border border-red-200">
                <p className="font-semibold text-red-900">Database Issue:</p>
                <p>1. Open browser console (F12)</p>
                <p>2. Type: <code className="bg-red-100 px-1">debugSupabase()</code></p>
                <p>3. Look for ❌ errors and fix them</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => (window as any).debugSupabase && (window as any).debugSupabase()}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold py-2 rounded mt-2 border border-red-300 transition-colors"
              >
                👉 DIAGNOSE
              </button>
              <button
                onClick={async () => {
                  localStorage.clear();
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-2 rounded mt-2 border border-gray-300 transition-colors"
              >
                🔁 RESET APP
              </button>
            </div>

            <div className="text-xs space-y-1">
              <p>Common database issues:</p>
              <p>✓ SQL migrations not run in Supabase</p>
              <p>✓ RLS policies blocking access (403 error)</p>
              <p>✓ Foreign key relationships misconfigured</p>
            </div>
          </motion.div>
        )}

        {/* Savings Counter Banner */}
        {totalSavings > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 border border-primary/20 rounded-lg p-2 sm:p-3 flex items-center gap-2"
          >
            <TrendingDown className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-semibold text-primary">
                ₹{totalSavings.toLocaleString()} saved collectively
              </p>
              <p className="text-xs text-muted-foreground">Across all active rides</p>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-2 pb-2">
          <h2 className="text-lg font-bold font-display text-foreground">
            Available Rides
          </h2>
          <Badge variant="secondary" className="px-2 py-0.5 h-6 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {loading ? "..." : `${filteredRides.length} found`}
          </Badge>
        </div>

        {loading ? (
          <RideListSkeleton />
        ) : (
          <>
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
                  hostId: ride.host_id,
                  status: ride.status,
                  scheduled_ride_url: ride.scheduled_ride_url,
                }}
                index={i}
                onJoin={handleJoin}
                isHost={user?.id === ride.host_id}
                isJoined={userRides.has(ride.id)}
              />
            ))}
          </>
        )}

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

        {/* Platform Disclaimer */}
        <PlatformDisclaimer variant="footer" />
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
