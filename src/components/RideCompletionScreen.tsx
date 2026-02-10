import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Download, Heart, Users, MapPin, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createRideMemory } from "@/lib/rideMemory";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface RideCompletionScreenProps {
  rideId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride: {
    source: string;
    destination: string;
    estimatedFare: number;
    seatsTotal: number;
    seatsTaken: number;
  };
}

const RideCompletionScreen = ({
  rideId,
  open,
  onOpenChange,
  ride,
}: RideCompletionScreenProps) => {
  const [title, setTitle] = useState(`Trip - ${new Date().toLocaleDateString()}`);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const amountPerPerson = Math.round(ride.estimatedFare / ride.seatsTotal);
  const amountPaid = amountPerPerson;
  const totalCost = amountPerPerson * ride.seatsTotal;
  const amountSaved = ride.estimatedFare - totalCost;

  const handleSaveMemory = async () => {
    setLoading(true);
    try {
      await createRideMemory(
        rideId,
        user?.id!,
        title,
        amountPaid,
        amountSaved,
        totalCost
      );
      toast({
        title: "Memory saved!",
        description: "You can view this ride anytime in your history",
      });
    } catch (error: any) {
      console.error("Error saving memory:", error);
    }
    setLoading(false);
  };

  const handleShare = () => {
    const shareText = `🚕 Just split a ride on Rydin!

💰 I paid: ₹${amountPaid}
💸 Saved: ₹${amountSaved}
👥 Split with ${ride.seatsTaken} co-travellers
📍 ${ride.source} → ${ride.destination}

Smart carpooling >> Uber for everyone
Join me on Rydin 🚀

Link: ${window.location.origin}`;

    navigator.clipboard.writeText(shareText);
    toast({
      title: "Share link copied!",
      description: "Ready to share on WhatsApp, Instagram, or email",
    });
  };

  const shareOnWhatsApp = () => {
    const message = encodeURIComponent(
      `🚕 Just split a ride on Rydin!\n\n💰 I paid: ₹${amountPaid}\n💸 Saved: ₹${amountSaved}\n👥 With ${ride.seatsTaken} co-travellers\n📍 ${ride.source} → ${ride.destination}\n\nJoin me: ${window.location.origin}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md bg-gradient-to-b from-green-50 to-card border-border p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center flex justify-center gap-2 text-xl sm:text-2xl">
            <Heart className="w-5 h-5 text-green-600 fill-green-600" />
            Ride Completed!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Celebration Animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="text-center py-4"
          >
            <p className="text-5xl mb-2">🎉</p>
            <p className="text-sm text-muted-foreground">You helped save money!</p>
          </motion.div>

          {/* Savings Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 space-y-3 border border-green-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Full route cost:</span>
              <span className="font-bold">₹{ride.estimatedFare}</span>
            </div>
            <div className="border-t border-dashed pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Your share:</span>
                <span className="font-bold">₹{amountPaid}</span>
              </div>
              <div className="flex items-center gap-2 text-green-600 font-bold">
                <TrendingDown className="w-4 h-4" />
                <span>You saved: ₹{amountSaved}</span>
              </div>
            </div>
          </motion.div>

          {/* Trip Details */}
          <div className="bg-background/50 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="text-sm font-semibold">{ride.source}</p>
                <p className="text-sm font-semibold text-primary">{ride.destination}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Passengers</p>
                <p className="text-sm font-semibold">{ride.seatsTaken + 1} people on ride</p>
              </div>
            </div>
          </div>

          {/* Memory Title Input */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Save this memory as:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
              placeholder="e.g., Airport trip - Feb 6"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleSaveMemory}
              disabled={loading}
              className="w-full h-12 sm:h-10 bg-green-600 hover:bg-green-700 gap-2 text-base sm:text-sm font-semibold"
            >
              <Heart className="w-4 h-4" />
              Save This Memory
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleShare}
                className="h-12 sm:h-10 gap-2 text-base sm:text-sm font-semibold"
              >
                <Share2 className="w-4 h-4" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={shareOnWhatsApp}
                className="h-12 sm:h-10 gap-2 text-base sm:text-sm font-semibold"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Viral CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center text-sm"
          >
            <p className="font-semibold text-blue-900 mb-1">
              Share Rydin with your next co-traveller
            </p>
            <p className="text-xs text-blue-800">
              Help friends split fares & save money. Start a movement! 🚀
            </p>
          </motion.div>

          {/* Close Button */}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideCompletionScreen;
