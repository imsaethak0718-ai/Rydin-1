import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Train, Bus, Clock, MapPin, Search, ArrowLeft, Info, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BottomNav from "@/components/BottomNav";
import ShuttleSimMap from "@/components/ShuttleSimMap";

const localTrains = [
    { route: "Beach - Tambaram/Chengalpattu", freq: "Every 10-15 mins", type: "South Line", peak: "8 AM - 11 AM", status: "On Time" },
    { route: "Central - Avadi/Arakkonam", freq: "Every 15-20 mins", type: "West Line", peak: "9 AM - 12 PM", status: "5m delay" },
    { route: "Beach - Velachery (MRTS)", freq: "Every 20 mins", type: "MRTS", peak: "8:30 AM - 10:30 AM", status: "On Time" },
    { route: "Central - Gummidipoondi", freq: "Every 30 mins", type: "North Line", peak: "9 AM - 11 AM", status: "On Time" },
];

const busRoutes = [
    { no: "21G", from: "Tambaram", to: "Broadway", via: "Guindy, Mylapore", freq: "12m", type: "Deluxe" },
    { no: "570", from: "Kelambakkam", to: "CMBT", via: "OMR, Guindy", freq: "15m", type: "AC / Express" },
    { no: "V51", from: "Tambaram", to: "T. Nagar", via: "Velachery", freq: "20m", type: "Normal" },
    { no: "102", from: "Kelambakkam", to: "Broadway", via: "OMR", freq: "18m", type: "Deluxe" },
    { no: "A51", from: "Tambaram", to: "High Court", via: "Pallavaram", freq: "15m", type: "Normal" },
];

const srmShuttles = [
    { route: "Campus ↔ Potheri Stn", time: "6:30 AM - 9:30 PM", freq: "Continuous", status: "Live", count: 2 },
    { route: "Campus ↔ Estancia", time: "8:00 AM - 6:00 PM", freq: "Every 20m", status: "Active", count: 1 },
    { route: "Campus ↔ Tambaram", time: "7:00 AM, 4:30 PM", freq: "Fixed Timings", status: "Scheduled", count: 0 },
    { route: "Tech Park ↔ Medical College", time: "8:00 AM - 8:00 PM", freq: "Every 15m", status: "Live", count: 1 },
];

const Transport = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTrains = localTrains.filter(t =>
        t.route.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredBuses = busRoutes.filter(b =>
        b.no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.to.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-amber-700">SRM Internal Shuttle</p>
                                <p className="text-amber-600/80">These shuttles are free for all students. No ticket required.</p>
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
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-blue-700">Live Status Tip</p>
                                <p className="text-blue-600/80">Use the 'Where is my Train' app for live station alerts.</p>
                            </div>
                        </div>

                        {filteredTrains.map((train, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={train.route}
                                className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none">
                                        {train.type}
                                    </Badge>
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <h3 className="font-bold text-base sm:text-lg mb-1">{train.route}</h3>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="text-[10px] text-muted-foreground">
                                        Frequency
                                        <p className="text-foreground font-semibold">{train.freq}</p>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        Peak Hours
                                        <p className="text-foreground font-semibold">{train.peak}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" className="w-full mt-3 h-8 text-xs text-primary group-hover:bg-primary/5">
                                    View Full Schedule <ExternalLink className="w-3 h-3 ml-2" />
                                </Button>
                            </motion.div>
                        ))}
                    </TabsContent>

                    <TabsContent value="buses" className="space-y-4">
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-orange-700">MTC Update</p>
                                <p className="text-orange-600/80">Avoid peak hours 8-10 AM and 5-8 PM for comfortable travel.</p>
                            </div>
                        </div>

                        {filteredBuses.map((bus, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={bus.no}
                                className="bg-card border border-border rounded-xl p-4 relative overflow-hidden group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-primary text-primary-foreground font-bold w-12 h-12 rounded-lg flex items-center justify-center text-lg shadow-lg shadow-primary/20">
                                        {bus.no}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1 text-sm font-bold">
                                            {bus.from} <span className="text-muted-foreground font-normal">→</span> {bus.to}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Via: {bus.via}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[10px] h-5">{bus.type}</Badge>
                                    <Badge variant="outline" className="text-[10px] h-5">Every {bus.freq}</Badge>
                                </div>
                            </motion.div>
                        ))}
                    </TabsContent>
                </Tabs>

                <section className="bg-muted/30 rounded-2xl p-6 text-center border border-dashed border-border">
                    <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <h3 className="font-bold mb-1">Coming Soon: Live Bus Tracking</h3>
                    <p className="text-sm text-muted-foreground mb-4">We're integrating with Chennai MTC API to bring you real-time bus locations.</p>
                    <Button variant="outline" size="sm" disabled>Notify Me</Button>
                </section>
            </main>

            <BottomNav />
        </div>
    );
};

export default Transport;
