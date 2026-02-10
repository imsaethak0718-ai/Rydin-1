import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Calendar, Clock, Users, Plane, IndianRupee, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const CreateRide = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [flightTrain, setFlightTrain] = useState("");
  const [seatsTotal, setSeatsTotal] = useState("");
  const [estimatedFare, setEstimatedFare] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setIsSubmitting(true);

    const { error } = await supabase.from("rides").insert({
      host_id: session.user.id,
      source,
      destination,
      date,
      time,
      seats_total: parseInt(seatsTotal),
      seats_taken: 0,
      estimated_fare: parseFloat(estimatedFare),
      girls_only: girlsOnly,
      flight_train: flightTrain || null,
      status: 'open',
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pickup point (e.g., SRM Campus)" className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm" required value={source} onChange={(e) => setSource(e.target.value)} />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input placeholder="Destination (e.g., Chennai Airport)" className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm" required value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="date" className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="time" className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="relative">
            <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Flight/Train number (optional)" className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm" value={flightTrain} onChange={(e) => setFlightTrain(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Select required value={seatsTotal} onValueChange={setSeatsTotal}>
              <SelectTrigger className="h-12 sm:h-11 bg-card text-base sm:text-sm">
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
              <Input type="number" placeholder="Est. fare" className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm" required value={estimatedFare} onChange={(e) => setEstimatedFare(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-safety" />
              <span className="text-sm sm:text-base font-medium">Girls-only ride</span>
            </div>
            <Switch checked={girlsOnly} onCheckedChange={setGirlsOnly} />
          </div>

          <Button type="submit" className="w-full h-12 sm:h-11 text-base sm:text-sm font-semibold" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Ride"}
          </Button>
        </form>
      </motion.main>

      <BottomNav />
    </div>
  );
};

export default CreateRide;
