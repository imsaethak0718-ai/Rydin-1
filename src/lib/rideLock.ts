import { supabase } from "@/integrations/supabase/client";

export interface RideLockResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Lock a ride (host commits to the ride starting)
 * Prevents other users from joining
 */
export const lockRideByHost = async (
  rideId: string,
  userId: string
): Promise<RideLockResult> => {
  try {
    // Call RPC function for server-side lock
    const { data, error } = await supabase.rpc("lock_ride_by_host", {
      p_ride_id: rideId,
      p_user_id: userId,
    });

    if (error) {
      console.error("❌ Lock ride error:", error);
      return {
        success: false,
        error: error.message || "Failed to lock ride",
      };
    }

    if (data && !data.success) {
      console.warn("⚠️ Lock failed:", data.error);
      return {
        success: false,
        error: data.error || "Failed to lock ride",
      };
    }

    console.log("✅ Ride locked:", rideId);
    return {
      success: true,
      message: "Ride locked successfully",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Exception in lockRideByHost:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
};

/**
 * Unlock a ride before it starts
 * Only host can unlock, and only if ride hasn't started yet
 */
export const unlockRideByHost = async (
  rideId: string,
  userId: string
): Promise<RideLockResult> => {
  try {
    const { data, error } = await supabase.rpc("unlock_ride_by_host", {
      p_ride_id: rideId,
      p_user_id: userId,
    });

    if (error) {
      console.error("❌ Unlock ride error:", error);
      return {
        success: false,
        error: error.message || "Failed to unlock ride",
      };
    }

    if (data && !data.success) {
      console.warn("⚠️ Unlock failed:", data.error);
      return {
        success: false,
        error: data.error || "Failed to unlock ride",
      };
    }

    console.log("✅ Ride unlocked:", rideId);
    return {
      success: true,
      message: "Ride unlocked successfully",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Exception in unlockRideByHost:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
};

/**
 * Check if a ride is locked
 */
export const isRideLocked = (rideStatus: string, lockedAt?: string): boolean => {
  return rideStatus === "locked" && lockedAt !== null;
};

/**
 * Check if a ride can be locked (host is ready)
 * - Status must be open or full
 * - At least one other user joined
 */
export const canLockRide = (
  rideStatus: string,
  seatsTaken: number
): boolean => {
  const canLockStatuses = ["open", "full"];
  return canLockStatuses.includes(rideStatus) && seatsTaken > 0;
};

/**
 * Get lock status display text
 */
export const getLockStatusText = (
  rideStatus: string,
  lockedAt?: string
): string => {
  if (rideStatus === "locked") {
    if (lockedAt) {
      const lockTime = new Date(lockedAt);
      const now = new Date();
      const diffMinutes = Math.floor(
        (now.getTime() - lockTime.getTime()) / (1000 * 60)
      );
      if (diffMinutes < 1) return "Just locked";
      if (diffMinutes === 1) return "Locked 1 min ago";
      if (diffMinutes < 60) return `Locked ${diffMinutes} mins ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours === 1) return "Locked 1 hour ago";
      return `Locked ${diffHours} hours ago`;
    }
    return "Ride locked";
  }
  return "";
};

/**
 * Subscribe to ride lock status changes
 */
export const subscribeToRideLock = (
  rideId: string,
  onLockChange: (locked: boolean) => void
) => {
  const subscription = supabase
    .channel(`ride-${rideId}-lock`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rides",
        filter: `id=eq.${rideId}`,
      },
      (payload) => {
        const locked = payload.new.status === "locked";
        onLockChange(locked);
      }
    )
    .subscribe();

  return subscription;
};
