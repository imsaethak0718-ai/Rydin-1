import { useState } from "react";
import { Share2, Send, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  generateRideSummary,
  formatRideSummaryMessage,
  getParentContact,
  enableParentSafeMode,
} from "@/lib/parentSafeMode";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ParentSafeModeButtonProps {
  rideId: string;
}

const ParentSafeModeButton = ({ rideId }: ParentSafeModeButtonProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [parentInfo, setParentInfo] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleOpenModal = async () => {
    setLoading(true);
    try {
      const [rideSummary, parent] = await Promise.all([
        generateRideSummary(rideId, user?.id!),
        getParentContact(user?.id!),
      ]);
      setSummary(rideSummary);
      setParentInfo(parent);
      setOpen(true);
    } catch (error: any) {
      console.error("Error loading parent info:", error);
      toast({
        title: "Error",
        description: "Couldn't load parent contact info. Please add it in profile.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleShare = async () => {
    try {
      await enableParentSafeMode(user?.id!, rideId);

      const message = formatRideSummaryMessage(summary);

      // In production, integrate with SMS API
      // For now, offer copy to clipboard
      navigator.clipboard.writeText(message);

      toast({
        title: "Message copied!",
        description: `Share this with ${parentInfo?.emergency_contact_name}: "${message}"`,
      });

      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to share ride",
        variant: "destructive",
      });
    }
  };

  if (!user?.emergency_contact_phone) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-xs"
        disabled
        title="Add emergency contact in profile to use Parent-Safe Mode"
      >
        <Shield className="w-4 h-4" />
        Parent-Safe Mode
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenModal}
        disabled={loading}
        className="gap-2 text-xs"
      >
        <Shield className="w-4 h-4" />
        Parent-Safe Mode
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-md bg-card border-border p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Shield className="w-5 h-5 text-green-600 shrink-0" />
              Share with Parent/Guardian
            </DialogTitle>
          </DialogHeader>

          {summary && parentInfo && (
            <div className="space-y-3 sm:space-y-4">
              {/* Info Box */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-green-900">
                  ✅ Share ride details with:
                </p>
                <p className="text-base font-bold text-green-800">
                  {parentInfo.emergency_contact_name}
                </p>
                <p className="text-sm text-green-700">
                  📱 {parentInfo.emergency_contact_phone}
                </p>
              </div>

              {/* Ride Summary Preview */}
              <div className="bg-background/50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Route</p>
                  <p className="font-semibold">
                    {summary.source} → {summary.destination}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date & Time</p>
                  <p className="font-semibold">
                    {summary.date} at {summary.time}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Passengers ({summary.passengers.length})</p>
                  <div className="space-y-1">
                    {summary.passengers.map((p: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {p.name} ⭐{p.trustScore}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cost</p>
                  <p className="font-semibold text-primary">₹{summary.estimatedFare}</p>
                </div>
                {summary.girls_only && (
                  <Badge variant="outline" className="text-xs border-safety text-safety w-fit">
                    Girls-only ride
                  </Badge>
                )}
              </div>

              {/* Privacy Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Your parent will receive ride details, member info, and your ETA. They can reach you anytime.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-12 sm:h-10 text-base sm:text-sm font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShare}
                  className="flex-1 h-12 sm:h-10 gap-2 text-base sm:text-sm font-semibold"
                >
                  <Send className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ParentSafeModeButton;
