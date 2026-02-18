import { useEffect, useState } from "react";
import { Bus, Train, ArrowRight, ExternalLink } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";

interface FallbackTransportProps {
  from?: string;
  to?: string;
}

const FallbackTransport = ({ from, to }: FallbackTransportProps) => {
  const [shuttles, setShuttles] = useState<any[]>([]);
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFallback = async () => {
      setLoading(true);
      
      // Fetch shuttles matching the route (simplified)
      const { data: shuttleData } = await supabase
        .from("shuttle_timings")
        .select("*")
        .limit(3);
      
      if (shuttleData) setShuttles(shuttleData);

      // Fetch trains matching the route (simplified)
      const { data: trainData } = await supabase
        .from("train_info")
        .select("*")
        .limit(2);
      
      if (trainData) setTrains(trainData);
      
      setLoading(false);
    };

    fetchFallback();
  }, [from, to]);

  if (loading) return null;
  if (shuttles.length === 0 && trains.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 px-1">
        <div className="h-[1px] flex-1 bg-border" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap px-2">
          Fallback Transport Options
        </span>
        <div className="h-[1px] flex-1 bg-border" />
      </div>

      <div className="grid gap-3">
        {shuttles.map((shuttle) => (
          <Card key={shuttle.id} className="p-4 border-dashed border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{shuttle.route_name}</h4>
                  <p className="text-xs text-muted-foreground">Departs: {shuttle.departure_time}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="gap-1 text-xs">
                View Schedule <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}

        {trains.map((train) => (
          <Card key={train.id} className="p-4 border-dashed border-blue-200 bg-blue-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Train className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{train.train_name} ({train.train_number})</h4>
                  <p className="text-xs text-muted-foreground">{train.from_station} → {train.to_station}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-blue-600">{train.departure_time}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Departure</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="p-4 bg-muted/50 rounded-xl border border-border text-center">
        <p className="text-xs text-muted-foreground">
          No student rides available for this time. These public transport options are your best alternatives.
        </p>
      </div>
    </div>
  );
};

export default FallbackTransport;
