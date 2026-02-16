import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Copy,
  Wallet,
  Car,
  Check,
  Clock,
  AlertCircle,
  IndianRupee,
  Shield,
  ExternalLink,
  Edit2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

interface RidePayment {
  id: string; // ride_member_id
  ride_id: string;
  source: string;
  destination: string;
  amount: number;
  status: 'pending' | 'paid';
  type: 'host' | 'member';
  other_user: {
    id: string;
    name: string;
    upi_id?: string;
  };
  created_at: string;
}

const Settlement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [ridePayments, setRidePayments] = useState<RidePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [newUpi, setNewUpi] = useState("");
  const [isUpdatingUpi, setIsUpdatingUpi] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPayments();
      if (user.upi_id) setNewUpi(user.upi_id);
    }
  }, [user?.id]);

  const fetchPayments = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Fetch rides where I am the HOST
      const { data: hostedRides, error: hostedError } = await supabase
        .from('rides')
        .select(`
          id, source, destination, estimated_fare, seats_total, created_at,
          ride_members (
            id, user_id, payment_status, status
          )
        `)
        .eq('host_id', user.id);

      if (hostedError) throw hostedError;

      // 2. Fetch rides where I am a MEMBER
      const { data: joinedRides, error: joinedError } = await supabase
        .from('ride_members')
        .select(`
          id, payment_status, status,
          rides (
            id, source, destination, estimated_fare, seats_total, host_id, created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (joinedError) throw joinedError;

      // 3. Collect all profile IDs we need
      const profileIds = new Set<string>();
      hostedRides?.forEach(ride => {
        ride.ride_members?.forEach((m: any) => profileIds.add(m.user_id));
      });
      joinedRides?.forEach((membership: any) => {
        if (membership.rides?.host_id) profileIds.add(membership.rides.host_id);
      });

      // 4. Batch fetch profiles
      let profilesMap = new Map<string, any>();
      if (profileIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, upi_id')
          .in('id', Array.from(profileIds));

        profilesMap = new Map(profiles?.map(p => [p.id, p]));
      }

      const formattedPayments: RidePayment[] = [];

      // Format hosted rides
      hostedRides?.forEach(ride => {
        const farePerPerson = Math.round(ride.estimated_fare / (ride.seats_total + 1));
        ride.ride_members?.filter((m: any) => m.status === 'accepted').forEach((member: any) => {
          const profile = profilesMap.get(member.user_id);
          if (profile) {
            formattedPayments.push({
              id: member.id,
              ride_id: ride.id,
              source: ride.source,
              destination: ride.destination,
              amount: farePerPerson,
              status: member.payment_status,
              type: 'host',
              other_user: {
                id: profile.id,
                name: profile.name,
                upi_id: profile.upi_id
              },
              created_at: ride.created_at
            });
          }
        });
      });

      // Format joined rides
      joinedRides?.forEach((membership: any) => {
        const ride = membership.rides;
        const farePerPerson = Math.round(ride.estimated_fare / (ride.seats_total + 1));
        const hostProfile = profilesMap.get(ride.host_id);
        if (hostProfile) {
          formattedPayments.push({
            id: membership.id,
            ride_id: ride.id,
            source: ride.source,
            destination: ride.destination,
            amount: farePerPerson,
            status: membership.payment_status,
            type: 'member',
            other_user: {
              id: hostProfile.id,
              name: hostProfile.name,
              upi_id: hostProfile.upi_id
            },
            created_at: ride.created_at
          });
        }
      });

      setRidePayments(formattedPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error',
        description: 'Could not load payments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      setMarkingPaid(paymentId);
      const { error } = await supabase
        .from('ride_members')
        .update({ payment_status: 'paid' })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: 'Payment marked as received!',
        description: 'Your balance table has been updated.',
      });

      fetchPayments();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update payment status',
        variant: 'destructive',
      });
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleUpdateUpi = async () => {
    if (!user || !newUpi) return;
    setIsUpdatingUpi(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ upi_id: newUpi })
        .eq('id', user.id);

      if (error) throw error;
      toast({ title: "UPI ID Updated! ✅" });
      // Reload page to refresh user context
      window.location.reload();
    } catch (error) {
      toast({ title: "Update Failed", variant: "destructive" });
    } finally {
      setIsUpdatingUpi(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied UPI ID! 📋", description: "You can now paste it in your payment app." });
  };

  const owedByMe = ridePayments.filter(p => p.type === 'member');
  const owedToMe = ridePayments.filter(p => p.type === 'host');

  const totalOwedByMe = owedByMe.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
  const totalOwedToMe = owedToMe.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium">Summing up your splits...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">Settlements</h1>
              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase italic">Manual Split Tracker</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* UPI Setup/Edit Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black tracking-tight">Your UPI ID</h2>
            <div className="p-2 bg-white/10 rounded-xl">
              <Wallet className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="space-y-4">
            {user?.upi_id && !isUpdatingUpi ? (
              <div className="flex items-center justify-between bg-white/10 border border-white/20 rounded-2xl p-4">
                <div className="overflow-hidden mr-2">
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none mb-1">Active ID</p>
                  <p className="text-sm font-bold truncate">{user.upi_id}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-[10px] font-black uppercase text-white hover:bg-white/20 shrink-0"
                  onClick={() => {
                    setNewUpi(user.upi_id!);
                    setIsUpdatingUpi(true);
                  }}
                >
                  <Edit2 className="w-3 h-3 mr-1.5" />
                  Edit
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="username@okaxis"
                  value={newUpi}
                  onChange={(e) => setNewUpi(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 rounded-2xl flex-1"
                  autoFocus={isUpdatingUpi}
                />
                <Button
                  onClick={handleUpdateUpi}
                  disabled={!newUpi || (isUpdatingUpi && newUpi === user?.upi_id)}
                  className="h-12 px-5 rounded-2xl bg-white text-indigo-600 hover:bg-slate-50 font-bold"
                >
                  {isUpdatingUpi ? "Save" : "Add"}
                </Button>
                {isUpdatingUpi && user?.upi_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-2xl text-white hover:bg-white/10"
                    onClick={() => setIsUpdatingUpi(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
            )}
            <p className="text-[10px] text-indigo-100 opacity-60 leading-relaxed font-medium italic">
              Co-travelers will use this ID to pay you for shared rides.
            </p>
          </div>
        </motion.div>

        {/* Summary Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-[2rem] space-y-1">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none">To Pay</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-orange-600">₹</span>
              <span className="text-2xl font-black text-orange-700">{totalOwedByMe}</span>
            </div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-[2rem] space-y-1">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">To Receive</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-emerald-600">₹</span>
              <span className="text-2xl font-black text-emerald-700">{totalOwedToMe}</span>
            </div>
          </div>
        </div>

        {/* Payment Tabs */}
        <Tabs defaultValue="pay" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/30 p-1 rounded-2xl">
            <TabsTrigger value="pay" className="rounded-xl font-bold text-xs uppercase tracking-tight">You Owe</TabsTrigger>
            <TabsTrigger value="receive" className="rounded-xl font-bold text-xs uppercase tracking-tight">Receive</TabsTrigger>
          </TabsList>

          <TabsContent value="pay" className="space-y-4 pt-4">
            {owedByMe.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto opacity-30">
                  <Shield className="w-8 h-8" />
                </div>
                <p className="text-sm text-muted-foreground font-medium tracking-tight">No pending payments for you.</p>
              </div>
            ) : (
              owedByMe.map(payment => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${payment.other_user.id}`} />
                        <AvatarFallback>{payment.other_user.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-sm font-black tracking-tight line-clamp-1">{payment.other_user.name}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase overflow-hidden max-w-[150px]">
                          <Car className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">{payment.destination}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={payment.status === 'paid' ? "secondary" : "destructive"} className="text-[10px] font-black uppercase mb-1">
                        ₹{payment.amount}
                      </Badge>
                      <p className="text-[8px] text-muted-foreground font-bold tracking-widest uppercase">{payment.status === 'paid' ? 'PAID' : 'PENDING'}</p>
                    </div>
                  </div>

                  {payment.status === 'pending' && (
                    <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Host's UPI ID</p>
                          <p className="text-xs font-bold text-primary">{payment.other_user.upi_id || "Not Provided"}</p>
                        </div>
                        {payment.other_user.upi_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-xl border-slate-200 bg-white"
                            onClick={() => copyToClipboard(payment.other_user.upi_id!)}
                          >
                            <Copy className="w-3 h-3 mr-1.5" />
                            Copy
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 rounded-xl h-10 text-xs font-bold shadow-indigo-100"
                          onClick={() => window.open(`upi://pay?pa=${payment.other_user.upi_id}&pn=${payment.other_user.name}&am=${payment.amount}&cu=INR`, '_blank')}
                          disabled={!payment.other_user.upi_id}
                        >
                          <IndianRupee className="w-3 h-3 mr-1.5" />
                          Pay Now
                        </Button>
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => navigate(`/chat/${payment.other_user.id}`)}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </TabsContent>

          <TabsContent value="receive" className="space-y-4 pt-4">
            {owedToMe.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto opacity-30">
                  <Clock className="w-8 h-8" />
                </div>
                <p className="text-sm text-muted-foreground font-medium tracking-tight">You aren't expecting any payments.</p>
              </div>
            ) : (
              owedToMe.map(payment => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`bg-card border border-border rounded-3xl p-5 shadow-sm transition-opacity ${payment.status === 'paid' ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${payment.other_user.id}`} />
                        <AvatarFallback>{payment.other_user.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                        <h3 className="text-sm font-black tracking-tight line-clamp-1">{payment.other_user.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase truncate">{payment.destination}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[10px] font-bold">₹</span>
                        <span className="text-lg font-black">{payment.amount}</span>
                      </div>
                      {payment.status === 'pending' ? (
                        <Button
                          size="sm"
                          className="h-7 text-[9px] font-black uppercase tracking-tighter rounded-lg bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleMarkAsPaid(payment.id)}
                          disabled={markingPaid === payment.id}
                        >
                          Mark Paid
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-3 h-3" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Paid</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Security / Info Tips */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 flex gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">A Note on Payments</p>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
              Rydin only helps you track who paid. Please settle the actual amount directly via UPI or Cash. Never share your passwords or OTPs with anyone.
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Settlement;
