import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Users, MapPin, Calendar, Clock, Shield, Share2, MessageSquare, AlertCircle, Heart, ExternalLink, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getRideHost, generateRideShareLink } from "@/lib/database";
import { useRealtimeRideMembers } from "@/hooks/useRealtimeRides";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface RideDetailsModalProps {
  rideId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride: {
    source: string;
    destination: string;
    date: string;
    time: string;
    seats_total: number;
    seats_taken: number;
    estimated_fare: number;
    girls_only: boolean;
    flight_train?: string;
    host_id: string;
    scheduled_ride_url?: string | null;
  };
}

const RideDetailsModal = ({ rideId, open, onOpenChange, ride }: RideDetailsModalProps) => {
  const [hostInfo, setHostInfo] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Use real-time members hook
  const { members, loading: membersLoading } = useRealtimeRideMembers(rideId);

  const isHost = user?.id === ride.host_id;
  const isMember = members.some((m) => m.user_id === user?.id);

  useEffect(() => {
    if (open) {
      fetchHostInfo();
    }
  }, [open, rideId]);

  const fetchHostInfo = async () => {
    try {
      const hostData = await getRideHost(rideId);
      setHostInfo(hostData);
    } catch (error) {
      console.error("Error fetching host info:", error);
      toast({ title: "Error", description: "Failed to load ride details", variant: "destructive" });
    }
  };

  const handleShare = () => {
    const shareLink = generateRideShareLink(rideId);
    navigator.clipboard.writeText(shareLink);
    toast({ title: "Copied!", description: "Ride link copied to clipboard" });
  };

  const seatsLeft = ride.seats_total - ride.seats_taken;
  const farePerPerson = Math.round(ride.estimated_fare / (ride.seats_total + 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md sm:max-w-md max-h-[90vh] bg-card border-border p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-border/50">
          <DialogTitle className="text-xl sm:text-2xl">Ride Details</DialogTitle>
        </DialogHeader>

        {membersLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 space-y-4 no-scrollbar">
            {/* Route Info */}
            <div className="bg-background/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-semibold">{ride.source}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary rotate-180" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">To</p>
                  <p className="font-semibold">{ride.destination}</p>
                </div>
              </div>
            </div>

            {/* Date/Time/Price */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <Calendar className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-semibold">{ride.date.slice(5)}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-semibold">{ride.time}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="text-sm font-semibold text-primary">₹{farePerPerson}</p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {ride.girls_only && (
                <Badge variant="outline" className="text-xs border-safety text-safety gap-1">
                  <Shield className="w-3 h-3" /> Girls only
                </Badge>
              )}
              {ride.flight_train && (
                <Badge variant="outline" className="text-xs">
                  {ride.flight_train}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} left
              </Badge>
            </div>

            {/* Host Info */}
            {hostInfo && (
              <div className="bg-background/50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">HOST</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{hostInfo.profiles?.name}</p>
                    <p className="text-xs text-muted-foreground">{hostInfo.profiles?.department}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold">{hostInfo.profiles?.trust_score?.toFixed(1)}</span>
                      <Heart className="w-4 h-4 fill-primary text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Verified Ride Link */}
            {ride.scheduled_ride_url && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <p className="text-sm font-bold text-green-700">Verified Ride Link</p>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-none text-[10px]">
                    PRE-BOOKED
                  </Badge>
                </div>
                <p className="text-xs text-green-600/80 mb-2">
                  The host has already scheduled/booked this ride for transparency.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white border-green-200 text-green-700 hover:bg-green-50 h-9 rounded-xl"
                  onClick={() => window.open(ride.scheduled_ride_url || '', '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" /> View Booking Details
                </Button>
              </div>
            )}

            {/* Members List */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                MEMBERS ({members.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="bg-background/50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{member.profiles?.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-primary text-primary" />
                        {member.profiles?.trust_score?.toFixed(1)}
                      </p>
                    </div>
                    {(isMember || isHost) && member.user_id !== user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-primary"
                        onClick={() => navigate(`/chat/${member.user_id}`)}
                        title={`Message ${member.profiles?.name}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Safety Info */}
            <div className="bg-safety/10 border border-safety/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-safety" />
                <p className="text-xs font-semibold text-safety">Safety Tips</p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Share your ride location with trusted contacts</li>
                <li>• Keep your emergency contact updated</li>
                <li>• Verify driver and car details before boarding</li>
              </ul>
            </div>

            {/* Share Button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
              Share Ride Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RideDetailsModal;
