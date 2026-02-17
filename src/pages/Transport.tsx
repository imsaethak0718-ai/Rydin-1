import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Train, Bus, Clock, Search, ArrowLeft, Info, ExternalLink, Zap, ChevronDown, Star, Heart, Phone, CreditCard, MapPin, Ticket, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BottomNav from "@/components/BottomNav";
import ShuttleSimMap from "@/components/ShuttleSimMap";
import MTCSimMap from "@/components/MTCSimMap";

// Chennai Suburban Stations (ALL LINES - 60+ stations)
const stations = [
    // South Line (Beach - Chengalpattu)
    "Beach - बीच",
    "Fort - फोर्ट",
    "Park Town - पार्क टाउन",
    "Chintadripet - चिंतादरीपेट",
    "Chepauk - चेपौक",
    "Tiruvallikeni - तिरुवल्लिकेनि",
    "Light House - लाइट हाउस",
    "Mundakanni - मुंडकन्नि",
    "Kotturpuram - कोत्तुरपुरम",
    "Kasturibai Nagar - कस्तूरीबाई नगर",
    "Indira Nagar - इंदिरा नगर",
    "Tirusulam - तिरुसुलम",
    "Meenambakkam - मीनांबक्कम",
    "Pallavaram - पल्लावरम",
    "Chromepet - क्रोमपेट",
    "Tambaram - तांबरम",
    "Perungalathur - पेरुंगलातुर",
    "Vandalur - वंडालुर",
    "Urapakkam - उरापक्कम",
    "Guduvanchery - गुडुवांचेरी",
    "Kattankolathur - कट्टनकोलातुर",
    "Potheri - सरम पोत्तेरि",
    "Chengalpattu - चेंगलपट्टु",

    // Central Line (Beach - Egmore - Tambaram)
    "Egmore - एग्मोर",
    "Mambalam - मांबलम",
    "Kodambakkam - कोडंबक्कम",
    "Saidapet - सैदापेट",
    "Guindy - गिंडी",
    "St. Thomas Mount - सेंट थॉमस माउंट",
    "Tambaram Sanatorium - तांबरम सैनेटोरियम",

    // North Line (Beach - Gummidipoondi)
    "Tiruvottiyur - तिरुवोत्तियुर",
    "Wimco Nagar - विम्को नगर",
    "Kathivakkam - काठीवक्कम",
    "Minjur - मिंजूर",
    "Ponneri - पोन्नेरी",
    "Kavaraipettai - कवराईपेट्टई",
    "Gummidipoondi - गुम्मिदिपुंडी",

    // West Line (Beach - Avadi/Tiruvallur)
    "Perambur - पेरंबुर",
    "Villivakkam - विल्लीवक्कम",
    "Korattur - कोरात्तुर",
    "Pattaravakkam - पट्टारावक्कम",
    "Ambattur - अंबत्तूर",
    "Avadi - अवादि",
    "Hindu College - हिंदू कॉलेज",
    "Pattabiram - पट्टाबिराम",
    "Nemilicheri - नेमिलिचेरी",
    "Tiruvallur - तिरुवल्लूर",

    // MRTS Line (Beach - Velachery)
    "Chepauk MRTS - चेपौक एमआरटीएस",
    "Tirumailai - तिरुमलै",
    "Mandaveli - मंदावेली",
    "Greenways Road - ग्रीनवेज़ रोड",
    "Nanganallur Road - नांगनल्लूर रोड",
    "Adambakkam - अदंबक्कम",
    "Taramani - तारामणि",
    "Thiruvanmiyur - तिरुवन्मियुर",
    "Velachery - वेलाचेरी",

    // Airport Line
    "Nandanam - नंदनम",
    "Shenoy Nagar - शेनॉय नगर",

    // Additional South/West Stations
    "Pazhavanthangal - पळवंदंगल",
    "Meenambakkam MRTS - मीनांबक्कम एमआरटीएस",
];

// Train Routes with Station-wise data
interface TrainRoute {
    name: string;
    type: string;
    direction: "Up" | "Down"; // Up = towards Beach, Down = away from Beach
    stations: string[];
    firstTrain: string;
    lastTrain: string;
    frequency: number; // in minutes
    color: string;
}

const trainRoutes: TrainRoute[] = [
    {
        name: "Beach - Chengalpattu (Ordinary)",
        type: "Ordinary",
        direction: "Down",
        stations: ["Beach - बीच", "Fort - फोर्ट", "Egmore - एग्मोर", "Mambalam - मांबलम", "Saidapet - सैदापेट", "Guindy - गिंडी", "St. Thomas Mount - सेंट थॉमस माउंट", "Meenambakkam - मीनांबक्कम", "Pallavaram - पल्लावरम", "Chromepet - क्रोमपेट", "Tambaram - तांबरम", "Perungalathur - पेरुंगलातुर", "Vandalur - वंडालुर", "Urapakkam - उरापक्कम", "Guduvanchery - गुडुवांचेरी", "Kattankolathur - कट्टनकोलातुर", "Potheri - सरम पोत्तेरि", "Chengalpattu - चेंगलपट्टु"],
        firstTrain: "04:00",
        lastTrain: "23:30",
        frequency: 15,
        color: "bg-blue-600",
    },
    {
        name: "Chengalpattu - Beach (Ordinary)",
        type: "Ordinary",
        direction: "Up",
        stations: ["Chengalpattu - चेंगलपट्टु", "Potheri - सरम पोत्तेरि", "Kattankolathur - कट्टनकोलातुर", "Guduvanchery - गुडुवांचेरी", "Urapakkam - उरापक्कम", "Vandalur - वंडालुर", "Perungalathur - पेरुंगलातुर", "Tambaram - तांबरम", "Chromepet - क्रोमपेट", "Pallavaram - पल्लावरम", "Meenambakkam - मीनांबक्कम", "St. Thomas Mount - सेंट थॉमस माउंट", "Guindy - गिंडी", "Saidapet - सैदापेट", "Mambalam - मांबलम", "Egmore - एग्मोर", "Fort - फोर्ट", "Beach - बीच"],
        firstTrain: "04:15",
        lastTrain: "23:45",
        frequency: 15,
        color: "bg-blue-600",
    },
    {
        name: "Beach - Chengalpattu (Fast)",
        type: "Fast",
        direction: "Down",
        stations: ["Beach - बीच", "Egmore - एग्मोर", "Mambalam - मांबलम", "Guindy - गिंडी", "Pallavaram - पल्लावरम", "Chromepet - क्रोमपेट", "Tambaram - तांबरम", "Guduvanchery - गुडुवांचेरी", "Potheri - सरम पोत्तेरि", "Chengalpattu - चेंगलपट्टु"],
        firstTrain: "05:30",
        lastTrain: "22:00",
        frequency: 30,
        color: "bg-emerald-600",
    },
    {
        name: "Chengalpattu - Beach (Fast)",
        type: "Fast",
        direction: "Up",
        stations: ["Chengalpattu - चेंगलपट्टु", "Potheri - सरम पोत्तेरि", "Guduvanchery - गुडुवांचेरी", "Tambaram - तांबरम", "Chromepet - क्रोमपेट", "Pallavaram - पल्लावरम", "Guindy - गिंडी", "Mambalam - मांबलम", "Egmore - एग्मोर", "Beach - बीच"],
        firstTrain: "05:45",
        lastTrain: "22:15",
        frequency: 30,
        color: "bg-emerald-600",
    },
    {
        name: "Tambaram - Beach (Local)",
        type: "Local",
        direction: "Up",
        stations: ["Tambaram - तांबरम", "Chromepet - क्रोमपेट", "Pallavaram - पल्लावरम", "Meenambakkam - मीनांबक्कम", "St. Thomas Mount - सेंट थॉमस माउंट", "Guindy - गिंडी", "Saidapet - सैदापेट", "Mambalam - मांबलम", "Kodambakkam - कोडंबक्कम", "Egmore - एग्मोर", "Park Town - पार्क टाउन", "Fort - फोर्ट", "Beach - बीच"],
        firstTrain: "04:15",
        lastTrain: "23:45",
        frequency: 8,
        color: "bg-purple-600",
    },
    {
        name: "Beach - Tambaram (Local)",
        type: "Local",
        direction: "Down",
        stations: ["Beach - बीच", "Fort - फोर्ट", "Park Town - पार्क टाउन", "Egmore - एग्मोर", "Kodambakkam - कोडंबक्कम", "Mambalam - मांबलम", "Saidapet - सैदापेट", "Guindy - गिंडी", "St. Thomas Mount - सेंट थॉमस माउंट", "Meenambakkam - मीनांबक्कम", "Pallavaram - पल्लावरम", "Chromepet - क्रोमपेट", "Tambaram - तांबरम"],
        firstTrain: "04:00",
        lastTrain: "23:30",
        frequency: 8,
        color: "bg-purple-600",
    },
];

// Helper: Calculate upcoming trains for a station
const calculateUpcomingTrains = (station: string, currentTime: Date) => {
    const upcomingTrains: Array<{
        route: TrainRoute;
        arrivalTime: Date;
        destination: string;
        platform: string;
    }> = [];

    trainRoutes.forEach(route => {
        const stationIndex = route.stations.findIndex(s => s === station);
        if (stationIndex === -1) return; // Station not on this route

        // Parse first train time
        const [hours, minutes] = route.firstTrain.split(':').map(Number);
        const firstTrainTime = new Date(currentTime);
        firstTrainTime.setHours(hours, minutes, 0, 0);

        // Generate trains for the next 24 hours
        let trainTime = new Date(firstTrainTime);
        const endTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);

        while (trainTime < endTime) {
            // Calculate arrival at this station (approx 3 min per station)
            const arrivalTime = new Date(trainTime.getTime() + stationIndex * 3 * 60 * 1000);

            if (arrivalTime > currentTime && arrivalTime < endTime) {
                upcomingTrains.push({
                    route,
                    arrivalTime,
                    destination: route.stations[route.stations.length - 1].split(' - ')[0],
                    platform: route.direction === "Up" ? "1" : "2",
                });
            }

            trainTime = new Date(trainTime.getTime() + route.frequency * 60 * 1000);
        }
    });

    return upcomingTrains.sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
};

const busRoutes = [
    { no: "102", from: "Broadway", to: "Kelambakkam", via: "Guindy, Pallavaram, Chrompet", freq: "10m", type: "Express", timing: "4:45 AM - 7:55 PM", fare: "₹15-35", electric: false, status: "On Time", popular: true },
    { no: "570", from: "CMBT Koyambedu", to: "Kelambakkam", via: "Velachery, Siruseri, OMR", freq: "12m", type: "AC Express", timing: "4:50 AM - 9:15 PM", fare: "₹15-50", electric: true, status: "Live", popular: true },
    { no: "114", from: "Redhills", to: "Vandalur Zoo", via: "Koyambedu, Tambaram, SRM", freq: "15m", type: "Electric", timing: "5:00 AM - 10:00 PM", fare: "₹5-23", electric: true, status: "Live", popular: true },
    { no: "A1", from: "High Court", to: "Tambaram", via: "Guindy, Pallavaram", freq: "8m", type: "Deluxe", timing: "4:50 AM - 10:00 PM", fare: "₹10-40", electric: false, status: "On Time", popular: true },
    { no: "18A", from: "Broadway", to: "Kilambakkam", via: "Guindy, Tambaram, Potheri", freq: "10m", type: "Electric", timing: "5:00 AM - 9:30 PM", fare: "₹5-23", electric: true, status: "Live", popular: false },
    { no: "588", from: "Adyar", to: "Mamallapuram", via: "OMR, ECR, Kovalam", freq: "30m", type: "Deluxe", timing: "6:00 AM - 8:00 PM", fare: "₹10-40", electric: false, status: "On Time", popular: false },
    { no: "19", from: "T.Nagar", to: "Thiruporur", via: "Velachery, OMR, Kelambakkam", freq: "20m", type: "Electric", timing: "5:30 AM - 9:00 PM", fare: "₹5-23", electric: true, status: "Live", popular: false },
    { no: "77", from: "CMBT", to: "Ambattur Estate", via: "Koyambedu, Ambattur", freq: "5m", type: "Ordinary", timing: "4:30 AM - 11:00 PM", fare: "₹5-23", electric: false, status: "On Time", popular: false },
    { no: "23C", from: "Ayanavaram", to: "Besant Nagar", via: "T.Nagar, Adyar", freq: "12m", type: "Express", timing: "4:05 AM - 8:10 PM", fare: "₹8-35", electric: false, status: "On Time", popular: false },
    { no: "29C", from: "Perambur", to: "Velachery", via: "Egmore, T.Nagar, Guindy", freq: "10m", type: "Deluxe", timing: "5:00 AM - 10:30 PM", fare: "₹10-40", electric: false, status: "On Time", popular: false },
    { no: "170TX", from: "Poonamallee", to: "Sholinganallur", via: "Vadapalani, Guindy, OMR", freq: "15m", type: "Electric", timing: "5:30 AM - 9:00 PM", fare: "₹5-23", electric: true, status: "Live", popular: false },
    { no: "164E", from: "Tondiarpet", to: "Velachery", via: "Broadway, T.Nagar, Guindy", freq: "12m", type: "Electric", timing: "5:00 AM - 9:30 PM", fare: "₹5-23", electric: true, status: "Live", popular: false },
    { no: "M27", from: "T.Nagar", to: "CMBT Koyambedu", via: "Vadapalani, Virugambakkam", freq: "8m", type: "Ordinary", timing: "5:00 AM - 10:00 PM", fare: "₹5-23", electric: false, status: "On Time", popular: false },
    { no: "202X", from: "Avadi", to: "Kilambakkam", via: "Koyambedu, Guindy, Tambaram", freq: "25m", type: "Express", timing: "5:30 AM - 8:30 PM", fare: "₹8-35", electric: false, status: "On Time", popular: false },
    { no: "C33", from: "Circular Route", to: "K.Kannadasan Nagar", via: "Anna Nagar, Vadapalani", freq: "20m", type: "Electric", timing: "6:00 AM - 9:00 PM", fare: "₹5-23", electric: true, status: "Live", popular: false },
    { no: "57X", from: "Koyambedu", to: "Kelambakkam", via: "Guindy, Velachery, OMR", freq: "18m", type: "Express Electric", timing: "5:30 AM - 9:00 PM", fare: "₹8-35", electric: true, status: "Live", popular: false },
    { no: "70V", from: "Broadway", to: "Velachery", via: "T.Nagar, Guindy, Adyar", freq: "10m", type: "Electric", timing: "5:00 AM - 10:00 PM", fare: "₹5-23", electric: true, status: "Live", popular: false },
    { no: "A51", from: "High Court", to: "Tambaram East", via: "Guindy, Chrompet", freq: "12m", type: "Deluxe", timing: "5:00 AM - 9:30 PM", fare: "₹10-40", electric: false, status: "On Time", popular: false },
    { no: "153", from: "CMBT Koyambedu", to: "Thiruvallur", via: "Ambattur, Poonamallee", freq: "20m", type: "Ordinary", timing: "5:30 AM - 8:30 PM", fare: "₹5-23", electric: false, status: "On Time", popular: false },
    { no: "MAA2", from: "Siruseri", to: "Airport", via: "OMR, Guindy, Meenambakkam", freq: "30m", type: "AC Electric", timing: "6:00 AM - 10:00 PM", fare: "₹15-50", electric: true, status: "Live", popular: false },
];

const srmShuttles = [
    { route: "Arch Gate ↔ Medical Hostel (Shift 1)", time: "06:00 AM - 02:00 PM", freq: "Every 15m (Peak)", status: "Scheduled", count: 0 },
    { route: "Arch Gate ↔ Medical Hostel (Shift 2)", time: "02:00 PM - 10:00 PM", freq: "Every 15m (Peak)", status: "Scheduled", count: 0 },
    { route: "Arch Gate ↔ Medical Hostel (Shift 3)", time: "10:00 PM - 06:00 AM", freq: "Night Service", status: "Live", count: 2 },
];

const Transport = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [busFilter, setBusFilter] = useState("All");
    const [expandedBuses, setExpandedBuses] = useState<Set<string>>(new Set());
    const [favoriteBuses, setFavoriteBuses] = useState<Set<string>>(new Set());

    // Train station state
    const [selectedStation, setSelectedStation] = useState("Potheri - सरम पोत्तेरि");
    const [stationSearch, setStationSearch] = useState("");
    const [showStationPicker, setShowStationPicker] = useState(false);

    // Calculate upcoming trains for selected station
    const upcomingTrains = useMemo(() => {
        const now = new Date();
        return calculateUpcomingTrains(selectedStation, now).slice(0, 25); // Next 25 trains
    }, [selectedStation]);

    // Filter stations for search
    const filteredStations = stations.filter(s =>
        s.toLowerCase().includes(stationSearch.toLowerCase())
    );

    // Helper to format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Helper to get time until train
    const getTimeUntil = (arrivalTime: Date) => {
        const now = new Date();
        const diff = arrivalTime.getTime() - now.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return "Arriving now";
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        return `${hours}h ${remainingMins}m`;
    };

    const filteredBuses = busRoutes
        .filter(b => {
            // Search filter (including via)
            const matchesSearch =
                b.no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.via.toLowerCase().includes(searchQuery.toLowerCase());

            // Type filter
            const matchesFilter =
                busFilter === "All" ||
                (busFilter === "Electric" && b.electric) ||
                (busFilter === "AC" && b.type.includes("AC")) ||
                (busFilter === "Express" && b.type.includes("Express")) ||
                (busFilter === "Ordinary" && b.type === "Ordinary");

            return matchesSearch && matchesFilter;
        })
        // Sort: Popular first, then favorites, then by route number
        .sort((a, b) => {
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            if (favoriteBuses.has(a.no) && !favoriteBuses.has(b.no)) return -1;
            if (!favoriteBuses.has(a.no) && favoriteBuses.has(b.no)) return 1;
            return a.no.localeCompare(b.no);
        });

    const toggleExpand = (busNo: string) => {
        const newExpanded = new Set(expandedBuses);
        if (newExpanded.has(busNo)) {
            newExpanded.delete(busNo);
        } else {
            newExpanded.add(busNo);
        }
        setExpandedBuses(newExpanded);
    };

    const toggleFavorite = (busNo: string) => {
        const newFavorites = new Set(favoriteBuses);
        if (newFavorites.has(busNo)) {
            newFavorites.delete(busNo);
        } else {
            newFavorites.add(busNo);
        }
        setFavoriteBuses(newFavorites);
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold font-display tracking-tight">Public Transport</h1>
                </div>
                <div className="max-w-lg mx-auto px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search route or bus number..."
                            className="pl-10 h-10 bg-muted/50 border-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-6 space-y-6">



                <Tabs defaultValue="shuttle" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="shuttle" className="flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Shuttle
                        </TabsTrigger>
                        <TabsTrigger value="trains" className="flex items-center gap-2">
                            <Train className="w-4 h-4" /> Local Train
                        </TabsTrigger>
                        <TabsTrigger value="buses" className="flex items-center gap-2">
                            <Bus className="w-4 h-4" /> MTC Bus
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="shuttle" className="space-y-4">
                        <ShuttleSimMap />
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-amber-700">Arch Gate ↔ Medical Hostel</p>
                                <p className="text-amber-600/80">
                                    Free shuttle service. Peak hour buses every 15 mins on working days.
                                    <br />
                                    <strong>Routes match the official schedule board.</strong>
                                </p>
                            </div>
                        </div>

                        {srmShuttles.map((shuttle, i) => (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={shuttle.route}
                                className="bg-card border border-border rounded-xl p-4 flex justify-between items-center relative overflow-hidden group hover:border-primary/30 transition-all shadow-sm"
                            >
                                <div className="flex gap-4 items-center">
                                    <div className={`w-2 h-2 rounded-full ${shuttle.status === 'Live' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                                    <div>
                                        <h3 className="font-bold text-sm sm:text-base">{shuttle.route}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-muted-foreground">{shuttle.time}</p>
                                            {shuttle.count > 0 && (
                                                <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 text-green-600 border-green-200 bg-green-50">
                                                    {shuttle.count} Bus{shuttle.count > 1 ? 'es' : ''} Running
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{shuttle.freq}</p>
                                    <p className="text-[9px] text-muted-foreground">{shuttle.status}</p>
                                </div>
                            </motion.div>
                        ))}
                    </TabsContent>

                    <TabsContent value="trains" className="space-y-4">
                        {/* Station Selector */}
                        <div
                            onClick={() => setShowStationPicker(!showStationPicker)}
                            className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-2 border-indigo-500/30 rounded-xl p-4 cursor-pointer hover:border-indigo-500/50 transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-600 text-white p-2 rounded-lg">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Your Station</p>
                                        <p className="font-bold text-lg">{selectedStation.split(' - ')[0]}</p>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-indigo-600 transition-transform ${showStationPicker ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {/* Station Picker */}
                        <AnimatePresence>
                            {showStationPicker && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search station..."
                                                className="pl-10 h-9 bg-muted/50 border-none"
                                                value={stationSearch}
                                                onChange={(e) => setStationSearch(e.target.value)}
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto space-y-1">
                                            {filteredStations.map((station) => (
                                                <button
                                                    key={station}
                                                    onClick={() => {
                                                        setSelectedStation(station);
                                                        setShowStationPicker(false);
                                                        setStationSearch("");
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedStation === station
                                                        ? "bg-primary text-primary-foreground font-semibold"
                                                        : "hover:bg-muted"
                                                        }`}
                                                >
                                                    {station.split(' - ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Info Box */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-blue-700">Upcoming Trains from {selectedStation.split(' - ')[0]}</p>
                                <p className="text-blue-600/80 text-xs mt-1">Showing next 25 trains • Real-time updates powered by Rydin</p>
                            </div>
                        </div>

                        {/* Upcoming Trains */}
                        {upcomingTrains.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingTrains.map((train, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={`${train.route.name}-${i}`}
                                        className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all group relative overflow-hidden"
                                    >
                                        {/* Color strip */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${train.route.color}`} />

                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 pl-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="secondary" className={`${train.route.color} text-white border-none text-[10px] h-5`}>
                                                        {train.route.type}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] h-5">
                                                        Platform {train.platform}
                                                    </Badge>
                                                </div>

                                                <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                                                    <Train className="w-4 h-4 text-primary" />
                                                    To {train.destination}
                                                </h3>

                                                <p className="text-xs text-muted-foreground">
                                                    {train.route.name}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-lg font-bold text-primary">
                                                    {formatTime(train.arrivalTime)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {getTimeUntil(train.arrivalTime)}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <Train className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-semibold">No upcoming trains</p>
                                <p className="text-xs mt-1">No trains stop at this station in the next 24 hours</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="buses" className="space-y-4">
                        <MTCSimMap />

                        {/* Filter Chips */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {["All", "Electric", "AC", "Express", "Ordinary"].map((filter) => (
                                <Badge
                                    key={filter}
                                    variant={busFilter === filter ? "default" : "outline"}
                                    className={`cursor-pointer whitespace-nowrap transition-all ${busFilter === filter
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "hover:bg-muted"
                                        }`}
                                    onClick={() => setBusFilter(filter)}
                                >
                                    {filter === "Electric" && <Zap className="w-3 h-3 mr-1 inline" />}
                                    {filter}
                                </Badge>
                            ))}
                        </div>

                        {/* Quick Info Box */}
                        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="text-sm space-y-2">
                                    <p className="font-semibold text-emerald-700 flex items-center gap-2">
                                        <Ticket className="w-4 h-4" /> Quick Info
                                    </p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                        <div className="flex items-center gap-1">
                                            <CreditCard className="w-3 h-3 text-emerald-600" />
                                            <span className="text-muted-foreground">Pass: ₹2,000/month</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Phone className="w-3 h-3 text-emerald-600" />
                                            <span className="text-muted-foreground">Care: 149 (Toll-free)</span>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                                            <Smartphone className="w-3 h-3 text-emerald-600" />
                                            <span>Real-time: Moovit / TownBus app</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Popular Routes Section */}
                        {busFilter === "All" && !searchQuery && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                    <h3 className="font-bold text-sm">Popular Routes</h3>
                                </div>
                                <div className="space-y-3">
                                    {filteredBuses.filter(b => b.popular).map((bus) => (
                                        <motion.div
                                            key={bus.no}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-gradient-to-r from-primary/5 to-transparent border border-primary/20 rounded-xl p-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className={`${bus.electric ? 'bg-green-600' : 'bg-primary'} text-primary-foreground font-bold w-12 h-12 rounded-lg flex items-center justify-center text-sm shadow-lg ${bus.electric ? 'shadow-green-600/20' : 'shadow-primary/20'}`}>
                                                        {bus.no}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-1 text-sm font-bold">
                                                            {bus.from} <span className="text-muted-foreground font-normal text-xs">→</span> {bus.to}
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">Via: {bus.via}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {bus.status === 'Live' && (
                                                        <div className="flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-md">
                                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                            <span className="text-[9px] font-semibold text-green-700">LIVE</span>
                                                        </div>
                                                    )}
                                                    {bus.electric && (
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-50 text-green-700 border-green-200 flex items-center">
                                                            <Zap className="w-2.5 h-2.5" />
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All Routes Section */}
                        <div>
                            {(busFilter !== "All" || searchQuery || filteredBuses.filter(b => b.popular).length > 0) && (
                                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                                    <Bus className="w-4 h-4" />
                                    {busFilter !== "All" ? `${busFilter} Routes` : searchQuery ? "Search Results" : "All Routes"}
                                    <span className="text-muted-foreground font-normal">({filteredBuses.filter(b => !b.popular || busFilter !== "All").length})</span>
                                </h3>
                            )}

                            {filteredBuses
                                .filter(b => !b.popular || busFilter !== "All" || searchQuery)
                                .map((bus, i) => {
                                    const isExpanded = expandedBuses.has(bus.no);
                                    const isFavorite = favoriteBuses.has(bus.no);

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            key={bus.no}
                                            className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all mb-3"
                                        >
                                            {/* Main Card Content */}
                                            <div className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <div className={`${bus.electric ? 'bg-green-600' : 'bg-primary'} text-primary-foreground font-bold w-14 h-14 rounded-lg flex items-center justify-center text-base shadow-lg ${bus.electric ? 'shadow-green-600/20' : 'shadow-primary/20'}`}>
                                                            {bus.no}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1 text-sm font-bold">
                                                                {bus.from} <span className="text-muted-foreground font-normal">→</span> {bus.to}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">Via: {bus.via}</p>
                                                            {!isExpanded && (
                                                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    Every {bus.freq} • {bus.fare}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <button
                                                            onClick={() => toggleFavorite(bus.no)}
                                                            className="p-1 hover:bg-muted rounded-md transition-colors"
                                                        >
                                                            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                                                        </button>
                                                        {bus.status === 'Live' && (
                                                            <div className="flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-md">
                                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                                <span className="text-[10px] font-semibold text-green-700">LIVE</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-[10px] h-5">{bus.type}</Badge>
                                                    <Badge variant="outline" className="text-[10px] h-5">Every {bus.freq}</Badge>
                                                    {bus.electric && (
                                                        <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200 flex items-center gap-0.5">
                                                            <Zap className="w-3 h-3" /> Electric
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Expand/Collapse Button */}
                                                <button
                                                    onClick={() => toggleExpand(bus.no)}
                                                    className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-primary hover:bg-primary/5 py-2 rounded-md transition-colors"
                                                >
                                                    {isExpanded ? "Show Less" : "Show Details"}
                                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-border bg-muted/30 p-4 space-y-2"
                                                >
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div>
                                                            <span className="text-muted-foreground">Operating Hours</span>
                                                            <p className="font-semibold">{bus.timing}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Fare Range</span>
                                                            <p className="font-semibold">{bus.fare}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Frequency</span>
                                                            <p className="font-semibold">Every {bus.freq}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Service Type</span>
                                                            <p className="font-semibold">{bus.type}</p>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2">
                                                        <span className="text-muted-foreground text-xs">Full Route</span>
                                                        <p className="text-xs font-semibold mt-1">{bus.from} → {bus.via} → {bus.to}</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                        </div>

                        {filteredBuses.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                <Bus className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No buses found matching your criteria</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>


            </main>

            <BottomNav />
        </div>
    );
};

export default Transport;
