export interface Ride {
  id: string;
  source: string;
  destination: string;
  date: string;
  time: string;
  seatsTotal: number;
  seatsTaken: number;
  estimatedFare: number;
  girlsOnly: boolean;
  flightTrain?: string;
  hostName: string;
  hostRating: number;
  hostDepartment: string;
  hostId?: string;
  status?: string;
}

export const mockRides: Ride[] = [
  {
    id: "1",
    source: "SRM Campus",
    destination: "Chennai Airport (MAA)",
    date: "2026-02-12",
    time: "06:00 AM",
    seatsTotal: 4,
    seatsTaken: 2,
    estimatedFare: 1200,
    girlsOnly: false,
    flightTrain: "6E 302",
    hostName: "Arjun K.",
    hostRating: 4.7,
    hostDepartment: "Computer Science",
  },
  {
    id: "2",
    source: "SRM Campus",
    destination: "Chennai Central Station",
    date: "2026-02-12",
    time: "08:30 PM",
    seatsTotal: 3,
    seatsTaken: 1,
    estimatedFare: 800,
    girlsOnly: true,
    hostName: "Priya S.",
    hostRating: 4.9,
    hostDepartment: "Electronics",
  },
  {
    id: "3",
    source: "SRM Campus",
    destination: "Tambaram Station",
    date: "2026-02-13",
    time: "10:00 AM",
    seatsTotal: 4,
    seatsTaken: 3,
    estimatedFare: 400,
    girlsOnly: false,
    flightTrain: "12622 Tamil Nadu Exp",
    hostName: "Rahul M.",
    hostRating: 4.2,
    hostDepartment: "Mechanical",
  },
  {
    id: "4",
    source: "SRM Campus",
    destination: "Chennai Airport (MAA)",
    date: "2026-02-14",
    time: "04:00 AM",
    seatsTotal: 4,
    seatsTaken: 1,
    estimatedFare: 1200,
    girlsOnly: false,
    flightTrain: "AI 542",
    hostName: "Sneha R.",
    hostRating: 4.8,
    hostDepartment: "Biotech",
  },
  {
    id: "5",
    source: "SRM Campus",
    destination: "CMBT Bus Stand",
    date: "2026-02-14",
    time: "02:00 PM",
    seatsTotal: 3,
    seatsTaken: 0,
    estimatedFare: 600,
    girlsOnly: true,
    hostName: "Divya P.",
    hostRating: 4.6,
    hostDepartment: "Commerce",
  },
];
