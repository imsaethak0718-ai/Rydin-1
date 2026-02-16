import { MapPin, Clock, Users, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventCardProps {
  event: {
    id: string;
    name: string;
    location: string;
    distance_km?: number;
    date: string;
    start_time: string;
    category: string;
    image_url?: string;
    interested_count?: number;
    is_interested?: boolean;
  };
  onSelect: () => void;
  onInterest: () => void;
}

const EventCard = ({ event, onSelect, onInterest }: EventCardProps) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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
    <Card
      className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onSelect}
    >
      <div className="flex gap-4">
        {/* Event Image */}
        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {event.image_url ? (
            <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🎪</span>
          )}
        </div>

        {/* Event Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{event.name}</h3>
              <Badge className={`${getCategoryColor(event.category)} mt-1`}>
                {event.category.replace("_", " ")}
              </Badge>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInterest();
              }}
              className="flex-shrink-0"
            >
              <Heart
                className={`w-5 h-5 ${event.is_interested
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground"
                  }`}
              />
            </button>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{event.location}</span>
            {event.distance_km && (
              <span className="text-xs">• {event.distance_km.toFixed(1)} km</span>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Clock className="w-4 h-4" />
            <span>{formatDate(event.date)}</span>
            <span>• {event.start_time}</span>
          </div>

          {/* Interested Count */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
            <Users className="w-4 h-4" />
            <span>{event.interested_count || 0} interested</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-3 pt-3 border-t border-border flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          Find Ride
        </Button>
      </div>
    </Card>
  );
};

export default EventCard;
