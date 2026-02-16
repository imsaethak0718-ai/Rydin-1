import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Train, Plane, Bus, Clock, MapPin, Users, Trash2, RefreshCw, CheckCircle2, XCircle, Loader2, ArrowRight, Zap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

interface ShuttleTiming {
  id: string;
  route_name: string;
  from_location: string;
  to_location: string;
  departure_time: string;
  arrival_time?: string;
  frequency_minutes?: number;
}

interface MyTrip {
  id: string;
  train_number: string;
  date: string;
  created_at: string;
  type: "train" | "flight";
  matchCount: number;
  isChecking: boolean;
}

interface CoTraveler {
  id: string;
  train_number: string;
  date: string;
  user_name?: string;
  user_email?: string;
  user_department?: string;
}

const Travel = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"train" | "flight" | "shuttle">("train");
  const [trainNumber, setTrainNumber] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [date, setDate] = useState("");
  const [shuttleTimings, setShuttleTimings] = useState<ShuttleTiming[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [myTrips, setMyTrips] = useState<MyTrip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [showCoTravelers, setShowCoTravelers] = useState(false);
  const [coTravelers, setCoTravelers] = useState<CoTraveler[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<MyTrip | null>(null);
  const [isLoadingCoTravelers, setIsLoadingCoTravelers] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch user's trips on mount
  useEffect(() => {
    if (user) {
      fetchMyTrips();
    }
  }, [user]);

  useEffect(() => {
    if (mode === "shuttle") {
      fetchShuttleTimings();
    }
  }, [mode]);

  const fetchMyTrips = async () => {
    if (!user) return;
    try {
      setIsLoadingTrips(true);

      const { data, error } = await supabase
        .from("train_info")
        .select("*")
        .eq("user_id", user.id) // Filter to only show the logged-in user's trips
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each trip, check how many others have the same train/flight + date
      const tripsWithMatches: MyTrip[] = await Promise.all(
        (data || []).map(async (trip: any) => {
          const { count, error: countErr } = await supabase
            .from("train_info")
            .select("*", { count: "exact", head: true })
            .eq("train_number", trip.train_number)
            .eq("date", trip.date);

          const totalMatches = (count || 1) - 1; // exclude self

          return {
            id: trip.id,
            train_number: trip.train_number,
            date: trip.date,
            created_at: trip.created_at,
            type: trip.train_number?.match(/^[A-Z]{2}\s?\d/) ? "flight" : "train",
            matchCount: totalMatches,
            isChecking: false,
          };
        })
      );

      setMyTrips(tripsWithMatches);
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  const refreshMatchCount = async (tripId: string) => {
    setMyTrips(prev =>
      prev.map(t => (t.id === tripId ? { ...t, isChecking: true } : t))
    );

    const trip = myTrips.find(t => t.id === tripId);
    if (!trip) return;

    try {
      const { count } = await supabase
        .from("train_info")
        .select("*", { count: "exact", head: true })
        .eq("train_number", trip.train_number)
        .eq("date", trip.date);

      setMyTrips(prev =>
        prev.map(t =>
          t.id === tripId ? { ...t, matchCount: (count || 1) - 1, isChecking: false } : t
        )
      );
    } catch {
      setMyTrips(prev =>
        prev.map(t => (t.id === tripId ? { ...t, isChecking: false } : t))
      );
    }
  };

  const viewCoTravelers = async (trip: MyTrip) => {
    setSelectedTrip(trip);
    setShowCoTravelers(true);
    setIsLoadingCoTravelers(true);

    try {
      // Fetch all train_info entries matching this train+date, join with profiles if possible
      const { data, error } = await supabase
        .from("train_info")
        .select("*")
        .eq("train_number", trip.train_number)
        .eq("date", trip.date);

      if (error) throw error;

      // Filter out self (by id since we don't have user_id on train_info)
      const others = (data || []).filter((t: any) => t.id !== trip.id);

      setCoTravelers(
        others.map((t: any) => ({
          id: t.id,
          train_number: t.train_number,
          date: t.date,
          user_name: t.user_name || undefined,
          user_email: t.user_email || undefined,
          user_department: t.user_department || undefined,
        }))
      );
    } catch (err) {
      console.error("Error fetching co-travelers:", err);
      setCoTravelers([]);
    } finally {
      setIsLoadingCoTravelers(false);
    }
  };

  const createHopperFromTrip = (trip: MyTrip) => {
    // Navigate to Hopper page — the user can create a hopper with the trip context
    // We encode trip info in URL params so Hopper page can pre-fill
    const tripType = trip.type === "flight" ? "Airport" : "Railway Station";
    navigate(
      `/hopper?from=SRM Campus&to=${encodeURIComponent(tripType)}&date=${trip.date}&ref=${trip.train_number}`
    );
  };

  const deleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase
        .from("train_info")
        .delete()
        .eq("id", tripId);

      if (error) throw error;

      // Update local state
      setMyTrips(prev => prev.filter(t => t.id !== tripId));

      toast({
        title: "Trip removed",
        description: "Your travel request has been deleted."
      });
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to remove trip. Please check your connection.",
        variant: "destructive",
      });
    }
  };

  const fetchShuttleTimings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("shuttle_timings")
        .select("*")
        .order("departure_time", { ascending: true });

      if (error) throw error;
      setShuttleTimings(data || []);
    } catch (error) {
      console.error("Error fetching shuttle timings:", error);
      toast({
        title: "Error",
        description: "Failed to load shuttle timings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTrainTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainNumber.trim() || !date) return;

    try {
      const { data, error } = await supabase
        .from("train_info")
        .insert({
          train_number: trainNumber.toUpperCase(),
          date: date,
          user_id: user.id, // Associate trip with user
        })
        .select()
        .single();

      if (error) throw error;

      // Check for matches immediately
      const { count } = await supabase
        .from("train_info")
        .select("*", { count: "exact", head: true })
        .eq("train_number", trainNumber.toUpperCase())
        .eq("date", date);

      const matchCount = (count || 1) - 1;

      const newTrip: MyTrip = {
        id: data.id,
        train_number: trainNumber.toUpperCase(),
        date: date,
        created_at: new Date().toISOString(),
        type: "train",
        matchCount,
        isChecking: false,
      };

      setMyTrips(prev => [newTrip, ...prev]);

      toast({
        title: matchCount > 0 ? `🎉 ${matchCount} co-traveler${matchCount > 1 ? "s" : ""} found!` : "Trip added!",
        description: matchCount > 0
          ? `${matchCount} other student${matchCount > 1 ? "s are" : " is"} on the same train. Check the panel!`
          : "No matches yet. We'll keep looking!",
      });

      setTrainNumber("");
      setDate("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add trip",
        variant: "destructive",
      });
    }
  };

  const handleAddFlightTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim() || !date) return;

    try {
      const { data, error } = await supabase
        .from("train_info")
        .insert({
          train_number: flightNumber.toUpperCase(),
          date: date,
          user_id: user.id, // Associate trip with user
        })
        .select()
        .single();

      if (error) throw error;

      const { count } = await supabase
        .from("train_info")
        .select("*", { count: "exact", head: true })
        .eq("train_number", flightNumber.toUpperCase())
        .eq("date", date);

      const matchCount = (count || 1) - 1;

      const newTrip: MyTrip = {
        id: data.id,
        train_number: flightNumber.toUpperCase(),
        date: date,
        created_at: new Date().toISOString(),
        type: "flight",
        matchCount,
        isChecking: false,
      };

      setMyTrips(prev => [newTrip, ...prev]);

      toast({
        title: matchCount > 0 ? `🎉 ${matchCount} co-traveler${matchCount > 1 ? "s" : ""} found!` : "Trip added!",
        description: matchCount > 0
          ? `${matchCount} other student${matchCount > 1 ? "s are" : " is"} on the same flight. Check the panel!`
          : "No matches yet. We'll keep looking!",
      });

      setFlightNumber("");
      setDate("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add trip",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Travel Matching</h1>
          <p className="text-sm text-muted-foreground">
            Find co-travelers and discover shuttle timings
          </p>
        </div>
      </div>

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT COLUMN: Form */}
          <div className="flex-1 min-w-0">
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "train" | "flight" | "shuttle")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="train">
                  <Train className="w-4 h-4 mr-2" />
                  Train
                </TabsTrigger>
                <TabsTrigger value="flight">
                  <Plane className="w-4 h-4 mr-2" />
                  Flight
                </TabsTrigger>
                <TabsTrigger value="shuttle">
                  <Bus className="w-4 h-4 mr-2" />
                  Shuttle
                </TabsTrigger>
              </TabsList>

              {/* Train Tab */}
              <TabsContent value="train" className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900">
                    Enter your train details. If another student is on the same train, we'll notify
                    both of you to coordinate a cab together.
                  </p>
                </div>

                <form onSubmit={handleAddTrainTrip} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Train Number</label>
                    <Input
                      type="text"
                      placeholder="e.g., 12345 or TN Express"
                      value={trainNumber}
                      onChange={(e) => setTrainNumber(e.target.value)}
                      className="h-12 bg-card"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Travel Date</label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-12 bg-card"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 font-semibold">
                    Add Train Trip
                  </Button>
                </form>

                <Card className="p-4 bg-muted">
                  <h3 className="font-semibold mb-2">How it works:</h3>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. Add your train details</li>
                    <li>2. We check if another student is on the same train</li>
                    <li>3. Both get notified instantly</li>
                    <li>4. Convert to Hopper to find a shared cab</li>
                  </ol>
                </Card>
              </TabsContent>

              {/* Flight Tab */}
              <TabsContent value="flight" className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-purple-900">
                    Add your flight details to find other SRM students on the same flight.
                  </p>
                </div>

                <form onSubmit={handleAddFlightTrip} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Flight Number</label>
                    <Input
                      type="text"
                      placeholder="e.g., AI 123 or BA456"
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                      className="h-12 bg-card"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Travel Date</label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-12 bg-card"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 font-semibold">
                    Add Flight Trip
                  </Button>
                </form>

                <Card className="p-4 bg-muted">
                  <h3 className="font-semibold mb-2">No PNR needed:</h3>
                  <p className="text-sm text-muted-foreground">
                    Just enter your flight number. We won't access your ticket details.
                  </p>
                </Card>
              </TabsContent>

              {/* Shuttle Tab */}
              <TabsContent value="shuttle" className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-900">
                    Check SRM shuttles and buses. Save money if available!
                  </p>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading shuttle timings...</p>
                  </div>
                ) : shuttleTimings.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Bus className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">
                      No shuttle timings available yet. Check back soon!
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {shuttleTimings.map((shuttle) => (
                      <motion.div
                        key={shuttle.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-2">
                                {shuttle.route_name}
                              </h3>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span>{shuttle.from_location}</span>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 pl-6">
                                  <span>↓</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span>{shuttle.to_location}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm font-semibold mb-1">
                                <Clock className="w-4 h-4" />
                                {shuttle.departure_time}
                              </div>
                              {shuttle.arrival_time && (
                                <p className="text-xs text-muted-foreground">
                                  Arrive: {shuttle.arrival_time}
                                </p>
                              )}
                              {shuttle.frequency_minutes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Every {shuttle.frequency_minutes} mins
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}

                <Card className="p-4 bg-muted">
                  <h3 className="font-semibold mb-2">Pro tip:</h3>
                  <p className="text-sm text-muted-foreground">
                    Use shuttles whenever possible. They're free and faster than cabs!
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT COLUMN: My Trips Panel */}
          <div className="lg:w-80 w-full flex-shrink-0">
            <div className="sticky top-20">
              <Card className="overflow-hidden">
                {/* Panel Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <Train className="w-4 h-4" />
                      <h3 className="font-bold text-sm">My Travel Requests</h3>
                    </div>
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {myTrips.length}
                    </span>
                  </div>
                </div>

                {/* Trip List */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {isLoadingTrips ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : myTrips.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <Train className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No trips yet. Add a train or flight to start finding co-travelers!
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {myTrips.map((trip) => (
                        <motion.div
                          key={trip.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="border-b border-border last:border-b-0"
                        >
                          <div className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              {/* Trip Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {trip.type === "flight" ? (
                                    <Plane className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                                  ) : (
                                    <Train className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                  )}
                                  <span className="font-bold text-sm truncate">
                                    {trip.train_number}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-5.5">
                                  {formatDate(trip.date)}
                                </p>
                              </div>

                              {/* Match Badge */}
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {trip.isChecking ? (
                                  <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span className="text-xs">Checking...</span>
                                  </div>
                                ) : trip.matchCount > 0 ? (
                                  <div className="flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-2.5 py-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="text-xs font-bold">
                                      {trip.matchCount} found
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 bg-orange-100 text-orange-600 rounded-full px-2.5 py-1">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">0 found</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-2 ml-5.5 flex-wrap">
                              {trip.matchCount > 0 && (
                                <>
                                  <button
                                    onClick={() => viewCoTravelers(trip)}
                                    className="flex items-center gap-1 text-xs text-green-600 font-semibold hover:text-green-700 transition-colors"
                                  >
                                    <Users className="w-3 h-3" />
                                    View Co-travelers
                                  </button>
                                  <span className="text-muted-foreground">·</span>
                                  <button
                                    onClick={() => createHopperFromTrip(trip)}
                                    className="flex items-center gap-1 text-xs text-amber-600 font-semibold hover:text-amber-700 transition-colors"
                                  >
                                    <Zap className="w-3 h-3" />
                                    Create Hopper
                                  </button>
                                  <span className="text-muted-foreground">·</span>
                                </>
                              )}
                              <button
                                onClick={() => refreshMatchCount(trip.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                disabled={trip.isChecking}
                              >
                                <RefreshCw className={`w-3 h-3 ${trip.isChecking ? "animate-spin" : ""}`} />
                                Refresh
                              </button>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={() => deleteTrip(trip.id)}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {/* Panel Footer - summary */}
                {myTrips.length > 0 && (
                  <div className="border-t border-border px-4 py-3 bg-muted/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Total matches across all trips
                      </span>
                      <span className="font-bold text-green-600">
                        {myTrips.reduce((acc, t) => acc + t.matchCount, 0)} co-travelers
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Co-Travelers Dialog */}
      <Dialog open={showCoTravelers} onOpenChange={setShowCoTravelers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Co-Travelers Found!
            </DialogTitle>
            <DialogDescription>
              {selectedTrip && (
                <span>
                  {selectedTrip.matchCount} student{selectedTrip.matchCount !== 1 && "s"} on{" "}
                  <strong>{selectedTrip.train_number}</strong> on{" "}
                  <strong>{formatDate(selectedTrip.date)}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {isLoadingCoTravelers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : coTravelers.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Could not load co-traveler details. They're still on the same trip!
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {coTravelers.map((ct, i) => (
                <motion.div
                  key={ct.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                      {ct.user_name ? ct.user_name[0].toUpperCase() : `T${i + 1}`}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {ct.user_name || `Co-Traveler ${i + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ct.user_department || "SRM Student"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Same trip</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {selectedTrip && (
            <div className="space-y-2 pt-2">
              <Button
                className="w-full gap-2"
                onClick={() => {
                  setShowCoTravelers(false);
                  createHopperFromTrip(selectedTrip);
                }}
              >
                <Zap className="w-4 h-4" />
                Create Hopper to Share Cab
                <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                A Hopper lets you share a cab from the station/airport. Co-travelers can join!
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Travel;
