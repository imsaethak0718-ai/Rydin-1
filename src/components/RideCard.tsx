import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Users, Star, Shield, Plane, ChevronRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RideDetailsModal from "./RideDetailsModal";
import RideMatchReason from "./RideMatchReason";
import { calculateRideStatus, getStatusConfig } from "@/lib/rideStatus";
import { getMatchReason } from "@/lib/rideBuckets";
import type { Ride } from "@/data/mockRides";

interface RideCardProps {
  ride: Ride & { status?: string; bucket_name?: string };
  index: number;
  onJoin?: (id: string) => void;
  onDetails?: (id: string) => void;
  isHost?: boolean;
  isJoined?: boolean;
}

const RideCard = ({ ride, index, onJoin, onDetails, isHost, isJoined }: RideCardProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const seatsLeft = ride.seatsTotal - ride.seatsTaken;
  const farePerPerson = Math.round(ride.estimatedFare / (ride.seatsTaken + 1));

  // Determine ride status
  const rideStatus = calculateRideStatus(
    ride.seatsTotal,
    ride.seatsTaken,
    ride.status as any || 'open'
  );
  const statusConfig = getStatusConfig(rideStatus);

  // Calculate seat fill percentage
  const seatFillPercent = (ride.seatsTaken / ride.seatsTotal) * 100;
  const isAlmostFull = seatsLeft === 1;

  const getButtonState = () => {
    if (isHost) return { label: "Manage", variant: "outline" as const };
    if (isJoined) return { label: "View", variant: "default" as const };
    if (!statusConfig.canJoin) return { label: statusConfig.label, variant: "outline" as const };
    return { label: "Join", variant: "default" as const };
  };

  const buttonState = getButtonState();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setDetailsOpen(true)}
      >
        {/* Route */}
        <div className="flex items-start gap-2 sm:gap-3 mb-3">
          <div className="flex flex-col items-center gap-1 mt-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="w-0.5 h-6 bg-border" />
            <div className="w-2 h-2 rounded-full bg-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{ride.source}</p>
            <p className="text-sm sm:text-base font-semibold font-display truncate mt-1">{ride.destination}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base sm:text-lg font-bold font-display text-primary">₹{farePerPerson}</p>
            <p className="text-xs text-muted-foreground">/person</p>
          </div>
        </div>

        {/* Match Reason */}
        <div className="mb-3">
          <RideMatchReason
            reason={getMatchReason(ride.source, ride.destination, ride.flightTrain)}
            bucketName={ride.bucket_name}
          />
        </div>

        {/* Animated Seat Indicator */}
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {ride.seatsTaken}/{ride.seatsTotal} seats taken
            </span>
            {isAlmostFull && (
              <span className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Almost full
              </span>
            )}
          </div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${seatFillPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-1.5 bg-primary rounded-full"
          />
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {ride.date.slice(5)} · {ride.time}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} left
          </span>
          {ride.flightTrain && (
            <span className="flex items-center gap-1">
              <Plane className="w-3 h-3" />
              {ride.flightTrain}
            </span>
          )}
        </div>

        {/* Status Badge & Host - Responsive Layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            {ride.girlsOnly && (
              <Badge variant="outline" className="text-xs border-safety text-safety gap-1">
                <Shield className="w-3 h-3" /> Girls only
              </Badge>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 fill-primary text-primary" />
              {ride.hostRating} · {ride.hostName}
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (buttonState.label === "Join" && onJoin) {
                  onJoin(ride.id);
                }
              }}
              disabled={!statusConfig.canJoin && buttonState.label === "Join"}
              variant={buttonState.variant}
              className="flex-1 sm:flex-none h-10 sm:h-8 text-sm sm:text-xs font-semibold"
            >
              {buttonState.label}
            </Button>
            <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </motion.div>

      {/* Ride Details Modal */}
      <RideDetailsModal
        rideId={ride.id}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        ride={{
          source: ride.source,
          destination: ride.destination,
          date: ride.date,
          time: ride.time,
          seats_total: ride.seatsTotal,
          seats_taken: ride.seatsTaken,
          estimated_fare: ride.estimatedFare,
          girls_only: ride.girlsOnly,
          flight_train: ride.flightTrain,
          host_id: ride.hostId || "",
        }}
      />
    </>
  );
};

export default RideCard;
