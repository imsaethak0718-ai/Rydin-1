export type RideStatus = 'open' | 'full' | 'locked' | 'completed' | 'cancelled';

export interface RideStatusConfig {
  status: RideStatus;
  canJoin: boolean;
  label: string;
  color: string;
  description: string;
}

export const rideStatusMap: Record<RideStatus, RideStatusConfig> = {
  open: {
    status: 'open',
    canJoin: true,
    label: 'Open',
    color: 'bg-green-100 text-green-800 border-green-300',
    description: 'Available to join',
  },
  full: {
    status: 'full',
    canJoin: false,
    label: 'Full',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'All seats taken',
  },
  locked: {
    status: 'locked',
    canJoin: false,
    label: 'Locked',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Ride has started',
  },
  completed: {
    status: 'completed',
    canJoin: false,
    label: 'Completed',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Ride finished',
  },
  cancelled: {
    status: 'cancelled',
    canJoin: false,
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800 border-red-300',
    description: 'Ride cancelled',
  },
};

export const getStatusConfig = (status: RideStatus): RideStatusConfig => {
  return rideStatusMap[status];
};

export const calculateRideStatus = (
  seatsTotal: number,
  seatsTaken: number,
  status: RideStatus
): RideStatus => {
  if (status === 'locked' || status === 'completed' || status === 'cancelled') {
    return status;
  }
  
  if (seatsTaken >= seatsTotal) {
    return 'full';
  }
  
  return 'open';
};
