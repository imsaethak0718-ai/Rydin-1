import { useState, useEffect } from "react";
import { X, MapPin, Clock, Users, Heart, MapIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EventModalProps {
  event: {
    id: string;
    name: string;
    location: string;
    distance_km?: number;
    date: string;
    start_time: string;
    end_time?: string;
    category: string;
    description?: string;
    image_url?: string;
    interested_count?: number;
    is_interested?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
  onInterest: () => void;
}

const EventModal = ({
  event,
  isOpen,
  onClose,
  onInterest,
}: EventModalProps) => {
  const [rideRooms, setRideRooms] = useState<any[]>([]);
  const [isLoadingRides, setIsLoadingRides] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchRideRooms();
    }
  }, [isOpen, event.id]);

  const fetchRideRooms = async () => {
    try {
      setIsLoadingRides(true);
      const { data, error } = await supabase
        .from("event_ride_rooms")
        .select(
          `
          *,
          event_ride_room_members (count)
        `
        )
        .eq("event_id", event.id)
        .order("departure_time", { ascending: true });

      if (error) throw error;
      setRideRooms(data || []);
    } catch (error) {
      console.error("Error fetching ride rooms:", error);
      toast({
        title: "Error",
        description: "Failed to load ride options",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRides(false);
    }
  };

  const handleJoinRide = async (rideRoomId: string) => {
    try {
      toast({
        title: "Success",
        description: "You joined the ride!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to join ride",
        variant: "destructive",
      });
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      concert: "bg-pink-100 text-pink-800",
      fest: "bg-blue-100 text-blue-800",
      hackathon: "bg-purple-100 text-purple-800",
      sports: "bg-green-100 text-green-800",
      tech_talk: "bg-orange-100 text-orange-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{event.name}</span>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Image */}
          <div className="w-full h-64 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
            {event.image_url ? (
              <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-6xl">🎪</span>
            )}
          </div>

          {/* Event Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className={getCategoryColor(event.category)}>
                {event.category.replace("_", " ")}
              </Badge>
              <button onClick={onInterest}>
                <Heart
                  className={`w-6 h-6 ${event.is_interested
                      ? "fill-red-500 text-red-500"
                      : "text-muted-foreground"
                    }`}
                />
              </button>
            </div>

            {/* Location */}
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{event.location}</p>
                {event.distance_km && (
                  <p className="text-sm text-muted-foreground">
                    {event.distance_km.toFixed(1)} km from campus
                  </p>
                )}
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">
                  {new Date(event.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {event.start_time}
                  {event.end_time && ` - ${event.end_time}`}
                </p>
              </div>
            </div>

            {/* Interested Count */}
            <div className="flex gap-3">
              <Users className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">
                  {event.interested_count || 0} students interested
                </p>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div>
                <h3 className="font-semibold text-sm mb-2">About</h3>
                <p className="text-sm text-muted-foreground">
                  {event.description}
                </p>
              </div>
            )}
          </div>

          {/* Ride Rooms */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <MapIcon className="w-4 h-4" />
              Available Rides
            </h3>

            {isLoadingRides ? (
              <p className="text-sm text-muted-foreground">Loading rides...</p>
            ) : rideRooms.length === 0 ? (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  No rides available yet
                </p>
                <Button size="sm" className="mt-3">
                  Create Ride
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {rideRooms.map((room) => (
                  <div
                    key={room.id}
                    className="border border-border rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">
                          {room.ride_type === "to_event"
                            ? "Going to event"
                            : "Returning from event"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {room.departure_time}
                          {room.return_time && ` - ${room.return_time}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {room.event_ride_room_members?.[0]?.count || 0}/
                          {room.max_capacity} passengers
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleJoinRide(room.id)}
                        disabled={
                          room.event_ride_room_members?.[0]?.count >=
                          room.max_capacity
                        }
                      >
                        Join
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;
