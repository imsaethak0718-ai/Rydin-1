import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Users, Check, X, Clock, MapPin, Calendar, ChevronRight, Info, Wallet, Edit2, Trash2, MoreVertical, Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RideRequest {
    id: string;
    ride_id: string;
    user_id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
    profiles: {
        name: string;
        department: string | null;
        trust_score: number;
        gender: string;
    };
    rides: {
        source: string;
        destination: string;
        date: string;
        time: string;
        host_id: string;
    };
}

const Activity = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [hostedRides, setHostedRides] = useState<any[]>([]);
    const [requestsReceived, setRequestsReceived] = useState<RideRequest[]>([]);
    const [myRequests, setMyRequests] = useState<any[]>([]);
    const [travelMatches, setTravelMatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingRide, setEditingRide] = useState<any | null>(null);
    const [isManaging, setIsManaging] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [personalChats, setPersonalChats] = useState<any[]>([]);

    const fetchData = async () => {
        if (!user) return;

        // Trigger expiry cleanup in background
        // Trigger expiry cleanup in background (once per session to avoid spam)
        const hasRunExpiry = sessionStorage.getItem('hasRunExpiry');
        if (!hasRunExpiry) {
            (async () => {
                try {
                    const { error } = await supabase.rpc('expire_past_rides');
                    if (error) {
                        if (error.code === 'PGRST202' || error.message?.includes('found')) {
                            console.warn("⚠️ 'expire_past_rides' RPC not found. Please run the migration script: backend/migrations/SURGICAL_RPC_FIX.sql");
                        } else {
                            console.warn("Background cleanup error:", error);
                        }
                    } else {
                        sessionStorage.setItem('hasRunExpiry', 'true');
                    }
                } catch (e) {
                    // Silent fail for network/other issues
                }
            })();
        }

        setIsLoading(true);

        try {
            // 1. Fetch rides I am hosting (with basic members)
            const { data: hosted, error: hostedError } = await supabase
                .from("rides")
                .select("*, ride_members(*)")
                .eq("host_id", user.id)
                .order("date", { ascending: true });

            if (hostedError) throw hostedError;

            // 2. Fetch profiles for all members of my hosted rides
            if (hosted && hosted.length > 0) {
                const memberIds = hosted.flatMap(r => (r.ride_members || []).map((m: any) => m.user_id));
                if (memberIds.length > 0) {
                    const { data: memberProfiles } = await supabase
                        .from("profiles")
                        .select("id, name, department, trust_score, gender")
                        .in("id", memberIds);

                    const profilesMap = new Map(memberProfiles?.map(p => [p.id, p]));

                    // Attach profiles to members
                    hosted.forEach(ride => {
                        if (ride.ride_members) {
                            ride.ride_members = ride.ride_members.map((m: any) => ({
                                ...m,
                                profiles: profilesMap.get(m.user_id) || null
                            }));
                        }
                    });
                }
            }
            setHostedRides(hosted || []);

            // 3. Fetch requests I have sent (ride_members entries)
            const { data: sent, error: sentError } = await supabase
                .from("ride_members")
                .select(`
                    *,
                    rides (
                        id,
                        source,
                        destination,
                        date,
                        time,
                        host_id
                    )
                `)
                .eq("user_id", user.id)
                .order("joined_at", { ascending: false });

            if (sentError) throw sentError;

            // 4. Batch fetch profiles for the hosts of rides I requested
            if (sent && sent.length > 0) {
                const hostIds = [...new Set(sent.map(req => req.rides?.host_id).filter(Boolean))];
                const { data: hostProfiles } = await supabase
                    .from("profiles")
                    .select("id, name")
                    .in("id", hostIds);

                const hostProfilesMap = new Map(hostProfiles?.map(p => [p.id, p]));

                // Attach host names to the requests
                const sentWithHosts = sent.map(req => {
                    if (req.rides) {
                        return {
                            ...req,
                            rides: {
                                ...req.rides,
                                profiles: hostProfilesMap.get(req.rides.host_id) || null
                            }
                        };
                    }
                    return req;
                });
                setMyRequests(sentWithHosts);
            } else {
                setMyRequests([]);
            }

            // 5. Collect pending requests for my hosted rides
            const pending = (hosted || []).flatMap(ride =>
                (ride.ride_members || [])
                    .filter((m: any) => m.status === 'pending')
                    .map((m: any) => ({ ...m, rides: ride }))
            );
            setRequestsReceived(pending);

            // 6. Fetch Travel Matches
            const { data: myTrips } = await supabase
                .from("train_info")
                .select("*")
                .eq("user_id", user.id);

            if (myTrips && myTrips.length > 0) {
                const matchResults = await Promise.all(myTrips.map(async (trip) => {
                    // Fetch matches first
                    const { data: matches } = await supabase
                        .from("train_info")
                        .select("*")
                        .eq("train_number", trip.train_number)
                        .eq("date", trip.date)
                        .neq("user_id", user.id);

                    if (matches && matches.length > 0) {
                        // Manual profile fetch to avoid join errors
                        const uIds = matches.map(m => m.user_id);
                        const { data: mProfiles } = await supabase
                            .from("profiles")
                            .select("id, name, department, gender, trust_score")
                            .in("id", uIds);

                        const pMap = new Map(mProfiles?.map(p => [p.id, p]));

                        return matches.map(m => ({
                            ...m,
                            profiles: pMap.get(m.user_id),
                            match_type: trip.train_number.match(/^[A-Z]{2}\s?\d/) ? 'Flight' : 'Train',
                            my_trip: trip
                        }));
                    }
                    return [];
                }));

                setTravelMatches(matchResults.flat());
            } else {
                setTravelMatches([]);
            }

            // 7. Fetch Personal Chats
            const { data: directMsgs } = await supabase
                .from("direct_messages")
                .select("*")
                .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
                .order("created_at", { ascending: false });

            if (directMsgs && directMsgs.length > 0) {
                const partnerIds = Array.from(new Set(directMsgs.flatMap(m => [m.sender_id, m.recipient_id]).filter(id => id !== user.id)));

                const { data: pProfiles } = await supabase
                    .from("profiles")
                    .select("id, name, department, avatar_url")
                    .in("id", partnerIds);

                const pMap = new Map(pProfiles?.map(p => [p.id, p]));

                const chatsMap = new Map();
                directMsgs.forEach((msg: any) => {
                    const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
                    const partner = pMap.get(partnerId);

                    if (partner && !chatsMap.has(partnerId)) {
                        chatsMap.set(partnerId, {
                            partner,
                            lastMessage: msg,
                            unread: msg.recipient_id === user.id && !msg.read_at
                        });
                    }
                });
                setPersonalChats(Array.from(chatsMap.values()));
            } else {
                setPersonalChats([]);
            }

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleRequest = async (rideId: string, memberId: string, action: 'accept' | 'reject') => {
        try {
            const { data, error } = await supabase.rpc('handle_ride_request', {
                p_ride_id: rideId,
                p_member_id: memberId,
                p_action: action
            });

            if (error) throw error;

            const result = data as any;
            if (!result.success) throw new Error(result.error);

            toast({
                title: action === 'accept' ? "Accepted! ✅" : "Rejected",
                description: action === 'accept' ? "Student added to your ride group." : "Request declined."
            });

            fetchData();
        } catch (error: any) {
            toast({ title: "Action failed", description: error.message, variant: "destructive" });
        }
    };

    const handleUpdateRide = async () => {
        if (!editingRide) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from("rides")
                .update({
                    destination: editingRide.destination,
                    time: editingRide.time,
                    seats_total: parseInt(editingRide.seats_total)
                })
                .eq("id", editingRide.id);

            if (error) throw error;
            toast({ title: "Ride updated successfully! ✈️" });
            setIsManaging(false);
            fetchData();
        } catch (error: any) {
            toast({ title: "Update failed", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteRide = async (rideId: string) => {
        if (!confirm("Are you sure you want to cancel this trip? This will notify all members.")) return;
        try {
            const { error } = await supabase
                .from("rides")
                .delete()
                .eq("id", rideId);

            if (error) throw error;
            toast({ title: "Ride cancelled", description: "Your trip has been removed." });
            setIsManaging(false);
            fetchData();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold font-display">Activity</h1>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-none">
                        {requestsReceived.length} Pending
                    </Badge>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-4 space-y-6">
                <Tabs defaultValue="actions" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-6 h-auto p-1">
                        <TabsTrigger value="actions" className="relative text-[10px] sm:text-xs px-1 h-9">
                            Approvals
                            {requestsReceived.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground transform translate-x-1/2 -translate-y-1/2 ring-2 ring-background">
                                    {requestsReceived.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="rides" className="text-[10px] sm:text-xs px-1 h-9">Groups</TabsTrigger>
                        <TabsTrigger value="partners" className="relative text-[10px] sm:text-xs px-1 h-9">
                            Partners
                            {travelMatches.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white transform translate-x-1/2 -translate-y-1/2 ring-2 ring-background">
                                    {travelMatches.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="chats" className="relative text-[10px] sm:text-xs px-1 h-9">
                            Chats
                            {personalChats.some(c => c.unread) && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500 transform translate-x-1/2 -translate-y-1/2 ring-2 ring-background" />
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="actions" className="space-y-6">
                        <section>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
                                Requests Received
                            </h2>
                            <div className="space-y-4">
                                {requestsReceived.length === 0 ? (
                                    <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border">
                                        <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">No pending requests yet.</p>
                                    </div>
                                ) : (
                                    requestsReceived.map((req) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            key={req.id}
                                            className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                                        {req.profiles.name?.[0]}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold">{req.profiles.name}</h3>
                                                        <p className="text-xs text-muted-foreground">{req.profiles.department || 'SRM Student'}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-xs">
                                                    ⭐ {req.profiles.trust_score.toFixed(1)}
                                                </Badge>
                                            </div>

                                            <div className="bg-muted/30 rounded-xl p-3 mb-4 space-y-2">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <MapPin className="w-3 h-3 text-primary" />
                                                    <span className="font-medium">{req.rides.source} → {req.rides.destination}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{req.rides.date} at {req.rides.time}</span>
                                                </div>
                                            </div>

                                            {req.status === 'expired' ? (
                                                <div className="text-center p-2 bg-muted/20 rounded-xl border border-dashed border-border">
                                                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Request Expired</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                                                        onClick={() => handleRequest(req.ride_id, req.user_id, 'reject')}
                                                    >
                                                        <X className="w-4 h-4 mr-2" /> Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                                                        onClick={() => handleRequest(req.ride_id, req.user_id, 'accept')}
                                                    >
                                                        <Check className="w-4 h-4 mr-2" /> Accept
                                                    </Button>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
                                Sent Requests
                            </h2>
                            <div className="space-y-3">
                                {myRequests.filter(r => r.rides?.host_id !== user?.id).map((req) => (
                                    <div key={req.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold">{req.rides?.destination}</h4>
                                            <p className="text-[10px] text-muted-foreground">
                                                {req.rides?.date} • Host: {req.rides?.profiles?.name || 'Loading...'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "text-[10px] capitalize",
                                                    req.status === 'accepted' && "bg-green-500/10 text-green-600 border-none",
                                                    req.status === 'pending' && "bg-orange-500/10 text-orange-600 border-none",
                                                    req.status === 'rejected' && "bg-red-500/10 text-red-600 border-none",
                                                    req.status === 'cancelled' && "bg-gray-500/10 text-gray-600 border-none",
                                                    req.status === 'expired' && "bg-gray-400/10 text-gray-500 border-none"
                                                )}
                                            >
                                                {req.status}
                                            </Badge>
                                            {req.status === 'accepted' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-primary"
                                                    onClick={() => navigate(`/ride-chat?rideId=${req.ride_id}`)}
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="rides" className="space-y-4">
                        <div className="space-y-4">
                            {/* Hosted Rides */}
                            {hostedRides.map((ride) => {
                                const acceptedMembers = (ride.ride_members || []).filter((m: any) => m.status === 'accepted');
                                return (
                                    <div key={ride.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                        <div className="p-4 bg-primary/5 border-b border-primary/10">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-lg">{ride.destination}</h3>
                                                <Badge variant="outline" className="bg-background">Host</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {ride.date} at {ride.time}
                                            </p>
                                        </div>

                                        <div className="p-4 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Members ({acceptedMembers.length + 1})</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px]">
                                                        You
                                                    </Badge>
                                                    {acceptedMembers.map((m: any) => (
                                                        <Badge key={m.id} variant="outline" className="text-[10px]">
                                                            {m.profiles?.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex-1 rounded-xl h-10 gap-2 text-xs"
                                                    onClick={() => navigate(`/ride-chat?rideId=${ride.id}`)}
                                                >
                                                    <MessageSquare className="w-4 h-4" /> Chat
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 rounded-xl h-10 gap-2 font-bold text-xs"
                                                    onClick={() => navigate(`/settlement`)}
                                                >
                                                    <Wallet className="w-4 h-4 text-primary" />
                                                    Payments
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-xl"
                                                    onClick={() => {
                                                        setEditingRide(ride);
                                                        setIsManaging(true);
                                                    }}
                                                >
                                                    <Settings className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Joined Rides */}
                            {myRequests.filter(req => req.status === 'accepted' && req.rides?.host_id !== user?.id).map((req) => (
                                <div key={req.ride_id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-4 bg-muted/20 border-b border-border">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg">{req.rides?.destination}</h3>
                                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-none">Member</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {req.rides?.date} at {req.rides?.time}
                                        </p>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {req.rides?.profiles?.name?.[0]}
                                            </div>
                                            <div className="text-xs">
                                                <p className="text-muted-foreground font-medium uppercase text-[8px]">Host</p>
                                                <p className="font-bold">{req.rides?.profiles?.name}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                className="flex-1 rounded-xl h-10 gap-2"
                                                onClick={() => navigate(`/ride-chat?rideId=${req.ride_id}`)}
                                            >
                                                <MessageSquare className="w-4 h-4" /> Group Chat
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 rounded-xl h-10 gap-2 font-bold"
                                                onClick={() => navigate(`/settlement`)}
                                            >
                                                <Wallet className="w-4 h-4 text-primary" />
                                                Settle
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {hostedRides.length === 0 && myRequests.filter(req => req.status === 'accepted' && req.rides?.host_id !== user?.id).length === 0 && (
                                <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border px-4">
                                    <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                                    <h3 className="font-bold text-muted-foreground">No active groups</h3>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Your approved rides and groups will appear here.
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="partners" className="space-y-4">
                        <section>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4 flex items-start gap-3">
                                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-900/80">
                                    <p className="font-bold text-amber-800">Travel Partners Matched!</p>
                                    <p>These students are on the same train or flight as you. Reach out to coordinate your journey together.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {travelMatches.length === 0 ? (
                                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border px-4">
                                        <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                                        <h3 className="font-bold text-muted-foreground">No matches yet</h3>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Add your travel details in the Travel page to find co-travelers.
                                        </p>
                                    </div>
                                ) : (
                                    travelMatches.map((match) => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={match.id}
                                            className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
                                        >
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl">
                                                        {match.profiles?.name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold">{match.profiles?.name}</h3>
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                                                                ⭐ {match.profiles?.trust_score?.toFixed(1)}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{match.profiles?.department || 'SRM Student'}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl bg-primary hover:bg-primary/90 text-white gap-2"
                                                    onClick={() => navigate(`/chat/${match.user_id}`)}
                                                >
                                                    <MessageSquare className="w-4 h-4" /> Chat
                                                </Button>
                                            </div>
                                            <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <div className="flex items-center gap-1 font-bold text-amber-600">
                                                        <Clock className="w-3 h-3" /> Same {match.match_type}
                                                    </div>
                                                    <span>•</span>
                                                    <span>{match.train_number}</span>
                                                    <span>•</span>
                                                    <span>{match.date}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] text-primary hover:bg-primary/5 p-0"
                                                    onClick={() => navigate(`/create?to=${match.match_type === 'Flight' ? 'Airport' : 'Railway Station'}&date=${match.date}&ref=${match.train_number}`)}
                                                >
                                                    Invite to Cab <ChevronRight className="w-3 h-3 ml-1" />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="chats" className="space-y-4">
                        <div className="space-y-3">
                            {personalChats.length === 0 ? (
                                <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border px-4">
                                    <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                                    <h3 className="font-bold text-muted-foreground">No conversations yet</h3>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Your 1-on-1 messages will appear here.
                                    </p>
                                </div>
                            ) : (
                                personalChats.map((chat) => (
                                    <div
                                        key={chat.partner.id}
                                        onClick={() => navigate(`/chat/${chat.partner.id}`)}
                                        className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl overflow-hidden">
                                                {chat.partner.avatar_url ? (
                                                    <img src={chat.partner.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    chat.partner.name?.[0]
                                                )}
                                            </div>
                                            {chat.unread && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-sm truncate">{chat.partner.name}</h4>
                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                    {new Date(chat.lastMessage.created_at).toLocaleDateString() === new Date().toLocaleDateString()
                                                        ? new Date(chat.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : new Date(chat.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <p className={`text-xs truncate ${chat.unread ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                                                {chat.lastMessage.sender_id === user?.id ? "You: " : ""}{chat.lastMessage.content}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            <BottomNav />

            {/* Manage Ride Sheet */}
            <Sheet open={isManaging} onOpenChange={setIsManaging}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-12">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-xl font-black flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            Manage Your Trip
                        </SheetTitle>
                        <SheetDescription>
                            Update your ride details or cancel the trip.
                        </SheetDescription>
                    </SheetHeader>

                    {editingRide && (
                        <div className="space-y-6">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dest" className="text-[10px] font-black uppercase text-muted-foreground">Destination</Label>
                                    <Input
                                        id="dest"
                                        value={editingRide.destination}
                                        onChange={(e) => setEditingRide({ ...editingRide, destination: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="time" className="text-[10px] font-black uppercase text-muted-foreground">Time</Label>
                                        <Input
                                            id="time"
                                            type="time"
                                            value={editingRide.time}
                                            onChange={(e) => setEditingRide({ ...editingRide, time: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="seats" className="text-[10px] font-black uppercase text-muted-foreground">Total Seats</Label>
                                        <Input
                                            id="seats"
                                            type="number"
                                            value={editingRide.seats_total}
                                            onChange={(e) => setEditingRide({ ...editingRide, seats_total: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full rounded-2xl h-12 gap-2 bg-primary font-bold"
                                    onClick={handleUpdateRide}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Save className="w-4 h-4" />}
                                    Save Changes
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full rounded-2xl h-12 gap-2 text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 font-bold"
                                    onClick={() => handleDeleteRide(editingRide.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Cancel Trip
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export default Activity;
