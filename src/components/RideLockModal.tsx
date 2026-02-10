import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lockRideForCommitment, getCommittedMembers } from "@/lib/rideLock";
import { useToast } from "@/hooks/use-toast";

interface RideLockModalProps {
  rideId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberCount: number;
  onLockSuccess?: () => void;
}

const RideLockModal = ({
  rideId,
  open,
  onOpenChange,
  memberCount,
  onLockSuccess,
}: RideLockModalProps) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const { toast } = useToast();

  const handleLock = async () => {
    if (!acknowledged) {
      toast({
        title: "Please acknowledge",
        description: "You must accept the cancellation penalty",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await lockRideForCommitment(rideId);
      
      // Fetch members after lock
      const committedMembers = await getCommittedMembers(rideId);
      setMembers(committedMembers);

      toast({
        title: "Ride Locked! 🔒",
        description: `Your commitment is now locked. ${memberCount} member${memberCount !== 1 ? "s" : ""} will be notified.`,
      });

      // Send notifications to all members (mock - in production, use Supabase edge functions)
      console.log("Notifying members about locked ride:", committedMembers);

      onLockSuccess?.();
      setTimeout(() => onOpenChange(false), 1500);
    } catch (error: any) {
      console.error("Lock error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to lock ride",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md bg-card border-border p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            Lock This Ride?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Warning Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-orange-900">
              ⚠️ Important Commitment
            </p>
            <ul className="text-sm text-orange-800 space-y-2 ml-4">
              <li className="list-disc">
                No new members can join after locking
              </li>
              <li className="list-disc">
                Cancelling after lock incurs <strong>-2 trust points</strong>
              </li>
              <li className="list-disc">
                Members will be notified of final ride details
              </li>
              <li className="list-disc">
                All members must acknowledge commitment
              </li>
            </ul>
          </motion.div>

          {/* Members Count */}
          <div className="bg-background/50 rounded-lg p-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">
                {memberCount} committed member{memberCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {memberCount === 0
                  ? "You're riding solo"
                  : "They can't cancel without penalty"}
              </p>
            </div>
            {memberCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setShowMembers(!showMembers)}
              >
                {showMembers ? "Hide" : "View"}
              </Button>
            )}
          </div>

          {/* Members List */}
          {showMembers && members.length > 0 && (
            <div className="bg-background/50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{member.profiles?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.profiles?.phone}
                    </p>
                  </div>
                  <div className="text-right">
                    {member.commitment_acknowledged && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Acknowledgment Checkbox */}
          <div className="flex items-start gap-3 bg-background/50 rounded-lg p-3">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="acknowledge"
              className="text-sm cursor-pointer flex-1"
            >
              <p className="font-semibold">I understand and accept</p>
              <p className="text-xs text-muted-foreground">
                I'm committed to this ride and understand that cancelling will
                incur a -2 trust point penalty.
              </p>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 h-12 sm:h-10 text-base sm:text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLock}
              disabled={!acknowledged || loading}
              className="flex-1 h-12 sm:h-10 gap-2 text-base sm:text-sm font-semibold"
            >
              {loading ? "Locking..." : "Lock & Commit"}
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            You can unlock the ride if no one has joined yet
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideLockModal;
