import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Calendar, Clock, Users, Plane, IndianRupee, Shield, ArrowLeft, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MapPicker from "@/components/MapPicker.tsx";
import PlaceAutocomplete, { SelectedPlace } from "@/components/PlaceAutocomplete";
import { checkSuspiciousActivity, flagUser } from "@/lib/moderation";
import { useTravelZones, findZoneForPoint, TravelZone } from "@/hooks/useTravelZones";

// ─── Internal intelligence types (not shown in UI) ───────────────────────────
interface FareIntelligence {
  soloEstimate: number;
  sharedEstimate: number;
  matchProbability: 'high' | 'medium' | 'low';
  isPopularRoute: boolean;
  distanceKm: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const haversineKm = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };

// ─── Silent fare & match intelligence engine ──────────────────────────────────
const computeFareIntelligence = (
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number },
  zones: TravelZone[]
): FareIntelligence => {
  const distanceKm = haversineKm(pickup, drop);

  // Fare estimation: ₹50 base + ₹15/km (auto-rickshaw equivalent)
  const soloEstimate = Math.round(50 + distanceKm * 15);
  const sharedEstimate = Math.round(soloEstimate / 3);

  // Hub detection using travel_zones (is_hub = true zones get higher match probability)
  const nearHub = zones.some(z =>
    z.is_hub &&
    (haversineKm(pickup, { lat: z.center_latitude, lng: z.center_longitude }) < 1.5 ||
      haversineKm(drop, { lat: z.center_latitude, lng: z.center_longitude }) < 1.5)
  );

  const matchProbability = nearHub ? 'high' : distanceKm > 10 ? 'medium' : 'low';
  const isPopularRoute = nearHub && distanceKm > 5;

  return { soloEstimate, sharedEstimate, matchProbability, isPopularRoute, distanceKm };
};

// ─── Component ────────────────────────────────────────────────────────────────
const CreateRide = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user } = useAuth();
  const [searchParams] = useSearchParams();

  // Form state
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [source, setSource] = useState(searchParams.get("from") || "");
  const [destination, setDestination] = useState(searchParams.get("to") || "");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupZoneId, setPickupZoneId] = useState<string | null>(null);
  const [dropZoneId, setDropZoneId] = useState<string | null>(null);
  const [date, setDate] = useState(searchParams.get("date") || "");
  const [time, setTime] = useState("");
  const [flexibility, setFlexibility] = useState(30);
  const [flightTrain, setFlightTrain] = useState(searchParams.get("ref") || "");
  const [seatsTotal, setSeatsTotal] = useState("");
  const [estimatedFare, setEstimatedFare] = useState("");
  const [scheduledRideUrl, setScheduledRideUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use shared travel zones hook (cached, no duplicate fetch)
  const { zones: travelZones } = useTravelZones();
  const fareIntelRef = useRef<FareIntelligence | null>(null);

  // Silently compute fare intelligence when coords change
  // (useEffect removed — we compute inline in onSelect handlers to avoid stale closure issues)

  const handlePresetTime = (type: string) => {
    const now = new Date();
    let targetDate = new Date();
    if (type === 'now') {
      // current time — no change needed
    } else if (type === '30min') {
      targetDate = new Date(now.getTime() + 30 * 60000);
    } else if (type === 'tonight') {
      targetDate.setHours(20, 0, 0);
    } else if (type === 'morning') {
      targetDate.setDate(now.getDate() + 1);
      targetDate.setHours(8, 0, 0);
    }
    setDate(targetDate.toISOString().split('T')[0]);
    setTime(targetDate.toTimeString().slice(0, 5));
  };

  const isAirportRide = destination.toLowerCase().includes('airport') || source.toLowerCase().includes('airport');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    // ── Validation 1: Map pins required ──────────────────────────────────────
    if (!pickupCoords || !dropCoords) {
      toast({
        title: "Pin your locations on the map",
        description: "Tap the map below to set your pickup and destination points.",
        variant: "destructive"
      });
      return;
    }

    // ── Validation 2: Must be within Tamil Nadu / Chennai region (150km) ─────
    const pickupDistFromChennai = haversineKm(pickupCoords, CHENNAI_CENTER);
    const dropDistFromChennai = haversineKm(dropCoords, CHENNAI_CENTER);
    if (pickupDistFromChennai > 150 || dropDistFromChennai > 150) {
      toast({
        title: "Outside service area",
        description: "Rydin currently serves Chennai and surrounding areas within 150km. For inter-city travel, contact support.",
        variant: "destructive"
      });
      return;
    }

    // ── Validation 3: Trip distance sanity check ──────────────────────────────
    const tripDistance = haversineKm(pickupCoords, dropCoords);
    if (tripDistance < 0.3) {
      toast({
        title: "Destination too close",
        description: "This trip is within walking distance. Please choose a further destination.",
        variant: "destructive"
      });
      return;
    }
    if (tripDistance > 200) {
      toast({
        title: "Route too long",
        description: "This route exceeds 200km. For long-distance travel, contact support.",
        variant: "destructive"
      });
      return;
    }

    // ── Validation 4: Fare sanity (prevent ₹0 or ₹99999 rides) ──────────────
    const fareValue = parseFloat(estimatedFare);
    if (isNaN(fareValue) || fareValue < 10) {
      toast({
        title: "Enter a valid fare",
        description: "Minimum fare is ₹10.",
        variant: "destructive"
      });
      return;
    }
    if (fareValue > 5000) {
      toast({
        title: "Fare seems too high",
        description: "Maximum fare for student rides is ₹5000. Please enter a realistic amount.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    // ── Moderation check ──────────────────────────────────────────────────────
    const modCheck = await checkSuspiciousActivity(session.user.id);
    if (modCheck.isSuspicious) {
      if (modCheck.action === 'flag') {
        await flagUser(session.user.id, modCheck.reason || "Suspicious creation pattern.");
        toast({
          title: "Account under review",
          description: "Your account is being reviewed. Your ride visibility may be reduced.",
          variant: "destructive"
        });
      } else if (modCheck.action === 'block') {
        toast({ title: "Action blocked", description: "You cannot create more rides at this time.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    }

    // ── Save ride with zone tagging & internal intelligence metadata ─────────
    const intel = fareIntelRef.current;

    // Resolve zone IDs from coordinates if not already set via autocomplete
    const resolvedPickupZone = pickupZoneId ||
      findZoneForPoint(pickupCoords.lat, pickupCoords.lng, travelZones)?.id || null;
    const resolvedDropZone = dropZoneId ||
      findZoneForPoint(dropCoords.lat, dropCoords.lng, travelZones)?.id || null;

    const { error } = await supabase.from("rides").insert({
      host_id: session.user.id,
      source: source || `${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`,
      destination: destination || `${dropCoords.lat.toFixed(4)}, ${dropCoords.lng.toFixed(4)}`,
      pickup_latitude: pickupCoords.lat,
      pickup_longitude: pickupCoords.lng,
      drop_latitude: dropCoords.lat,
      drop_longitude: dropCoords.lng,
      date,
      time,
      seats_total: parseInt(seatsTotal),
      seats_taken: 0,
      estimated_fare: fareValue,
      girls_only: girlsOnly,
      flight_train: flightTrain || null,
      scheduled_ride_url: scheduledRideUrl || null,
      status: 'open',
      // Zone tagging for clustering (stored if columns exist)
      ...(resolvedPickupZone ? { pickup_zone_id: resolvedPickupZone } : {}),
      ...(resolvedDropZone ? { drop_zone_id: resolvedDropZone } : {}),
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error creating ride", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ride created! 🚕", description: "Others can now find and join your ride." });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold font-display">Create a Ride</h1>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto px-4 sm:px-6 py-6"
      >
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Locations ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Pickup Location
              </label>
              <PlaceAutocomplete
                placeholder="Where are you starting from?"
                onSelect={(p: SelectedPlace) => {
                  setSource(p.name);
                  if (p.lat && p.lng) {
                    const coords = { lat: p.lat, lng: p.lng };
                    setPickupCoords(coords);
                    // Tag with zone if selected from zone list or if coords fall within a zone
                    if (p.isZone && p.zoneId) {
                      setPickupZoneId(p.zoneId);
                    } else {
                      const matched = findZoneForPoint(p.lat, p.lng, travelZones);
                      setPickupZoneId(matched?.id || null);
                    }
                    // Auto-compute fare if drop is already set
                    if (dropCoords) {
                      const intel = computeFareIntelligence(coords, dropCoords, travelZones);
                      fareIntelRef.current = intel;
                      if (!estimatedFare) setEstimatedFare(intel.soloEstimate.toString());
                    }
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Destination
              </label>
              <PlaceAutocomplete
                placeholder="Where are you going?"
                onSelect={(p: SelectedPlace) => {
                  setDestination(p.name);
                  if (p.lat && p.lng) {
                    const coords = { lat: p.lat, lng: p.lng };
                    setDropCoords(coords);
                    // Tag with zone
                    if (p.isZone && p.zoneId) {
                      setDropZoneId(p.zoneId);
                    } else {
                      const matched = findZoneForPoint(p.lat, p.lng, travelZones);
                      setDropZoneId(matched?.id || null);
                    }
                    // Auto-compute fare if pickup is already set
                    if (pickupCoords) {
                      const intel = computeFareIntelligence(pickupCoords, coords, travelZones);
                      fareIntelRef.current = intel;
                      if (!estimatedFare) setEstimatedFare(intel.soloEstimate.toString());
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* ── Map (mandatory for coordinate accuracy) ───────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Pin on Map</label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {pickupCoords && dropCoords ? "✓ Both set" : "Required"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tap to set pickup, tap again to set destination. Covers all of Chennai & surroundings.
            </p>
            <MapPicker
              initialPickup={pickupCoords || undefined}
              initialDrop={dropCoords || undefined}
              focusPickup={pickupCoords}
              focusDrop={dropCoords}
              onSelect={(p, d) => {
                setPickupCoords(p);
                setDropCoords(d);
              }}
            />
          </div>

          {/* ── Date & Time ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Departure Time</label>
              <div className="flex gap-1.5">
                {(['now', '30min', 'tonight', 'morning'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handlePresetTime(t)}
                    className="h-7 px-2 text-[10px] font-medium bg-muted/60 hover:bg-muted rounded-md transition-colors"
                  >
                    {t === 'now' ? 'Now' : t === '30min' ? '30m' : t === 'tonight' ? 'Tonight' : 'Morning'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" className="pl-10 h-12 bg-card" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="time" className="pl-10 h-12 bg-card" required value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            {/* Airport tip — only shown when relevant */}
            {isAirportRide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2"
              >
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700">
                  <strong>Airport tip:</strong> For domestic flights, leave at least 2.5 hours before departure.
                </p>
              </motion.div>
            )}

            {/* Flexibility slider */}
            <div className="space-y-2 p-4 bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time Flexibility</span>
                <span className="text-xs font-bold text-primary">± {flexibility} mins</span>
              </div>
              <Slider
                value={[flexibility]}
                onValueChange={(v) => setFlexibility(v[0])}
                max={120}
                step={15}
                className="py-1"
              />
            </div>
          </div>

          {/* ── Seats & Fare ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Select required value={seatsTotal} onValueChange={setSeatsTotal}>
              <SelectTrigger className="h-12 bg-card">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Max seats" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} seats</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Total fare (₹)"
                className="pl-10 h-12 bg-card"
                required
                value={estimatedFare}
                onChange={(e) => setEstimatedFare(e.target.value)}
              />
            </div>
          </div>

          {/* Per-head split — shown only when both fare and seats are filled */}
          {estimatedFare && seatsTotal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center"
            >
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Per person</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl font-bold text-primary">
                  ₹{Math.round(parseFloat(estimatedFare) / (parseInt(seatsTotal) + 1))}
                </span>
                <span className="text-xs text-muted-foreground">/ person</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Split between you + {seatsTotal} co-traveler{parseInt(seatsTotal) > 1 ? 's' : ''}
              </p>
            </motion.div>
          )}

          {/* ── Optional fields ───────────────────────────────────────────── */}
          <div className="relative">
            <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Flight / Train number (optional)"
              className="pl-10 h-12 bg-card"
              value={flightTrain}
              onChange={(e) => setFlightTrain(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Scheduled ride link (optional)"
                className="pl-10 h-12 bg-card"
                value={scheduledRideUrl}
                onChange={(e) => setScheduledRideUrl(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              💡 Paste your Uber/Ola/Rapido scheduled link for a Verified badge.
            </p>
          </div>

          {/* ── Girls-only toggle ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
            <div className={`flex items-center gap-2 ${user?.gender !== 'female' ? "opacity-50" : ""}`}>
              <Shield className="w-4 h-4 text-safety" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Girls-only ride</span>
                {user?.gender !== 'female' && (
                  <span className="text-[10px] text-muted-foreground">Available for female hosts only</span>
                )}
              </div>
            </div>
            <Switch
              checked={girlsOnly}
              onCheckedChange={setGirlsOnly}
              disabled={user?.gender !== 'female'}
            />
          </div>

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating ride..." : "Create Ride"}
          </Button>

        </form>
      </motion.main>

      <BottomNav />
    </div>
  );
};

export default CreateRide;
