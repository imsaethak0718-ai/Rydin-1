import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, CheckCircle, Clock, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

interface SplitData {
  id: string;
  title: string;
  total_amount: number;
  split_count: number;
  amount_per_person: number;
  status: string;
  created_at: string;
  created_by: string;
  ride_link?: {
    platform: string;
    pickup_location: string;
    dropoff_location: string;
    ride_type: string;
  };
}

interface Member {
  id: string;
  user_id: string;
  amount_owed: number;
  amount_paid: number;
  payment_status: string;
  joined_at: string;
  profile?: {
    name: string;
    trust_score: number;
  };
}

const ViewSplit = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const [split, setSplit] = useState<SplitData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    fetchSplitData();
  }, [shareToken, session?.user?.id]);

  const fetchSplitData = async () => {
    try {
      setLoading(true);

      // Get split by share token
      const { data: splitData, error: splitError } = await supabase
        .from('cost_splits')
        .select(`
          id, title, total_amount, split_count, amount_per_person,
          status, created_at, created_by,
          ride_link:ride_link_id (platform, pickup_location, dropoff_location, ride_type)
        `)
        .eq('share_token', shareToken)
        .maybeSingle();

      if (splitError || !splitData) {
        throw new Error('Split not found');
      }

      setSplit(splitData);

      // Get members
      const { data: membersData, error: membersError } = await supabase
        .from('split_members')
        .select(`
          id, user_id, amount_owed, amount_paid, payment_status, joined_at,
          profile:profiles (name, trust_score)
        `)
        .eq('split_id', splitData.id);

      if (membersError) throw membersError;

      setMembers(membersData || []);

      // Check if current user has joined
      if (session?.user) {
        const userMember = (membersData || []).find(m => m.user_id === session.user.id);
        setHasJoined(!!userMember);
      }
    } catch (error) {
      console.error('Error fetching split:', error);
      toast({
        title: 'Error',
        description: 'Could not load split details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSplit = async () => {
    if (!session?.user || !split) return;

    setJoining(true);
    try {
      const { error } = await supabase
        .from('split_members')
        .insert({
          split_id: split.id,
          user_id: session.user.id,
          amount_owed: split.amount_per_person,
          amount_paid: 0,
          payment_status: 'pending',
        });

      if (error) throw error;

      setHasJoined(true);
      toast({
        title: 'Joined!',
        description: `You joined the split. You owe ₹${split.amount_per_person}`,
      });

      // Refresh members
      fetchSplitData();
    } catch (error) {
      console.error('Error joining split:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not join split',
        variant: 'destructive',
      });
    } finally {
      setJoining(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.href}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading split...</p>
        </div>
      </div>
    );
  }

  if (!split) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">❌</div>
          <h1 className="text-2xl font-bold">Split Not Found</h1>
          <p className="text-muted-foreground">This split may have expired or been deleted</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const settledMembers = members.filter(m => m.payment_status === 'settled').length;
  const totalMembers = members.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-bold font-display">{split.title}</h1>
          <div className="w-8" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Ride Details */}
        {split.ride_link && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Trip Details</span>
              <Badge className="bg-black text-white">
                {split.ride_link.platform.toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">From</span>
                <span>{split.ride_link.pickup_location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">To</span>
                <span>{split.ride_link.dropoff_location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{split.ride_link.ride_type}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Cost Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 rounded-lg p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold">₹{split.total_amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Per Person</p>
              <p className="text-2xl font-bold text-primary">₹{split.amount_per_person.toFixed(2)}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-primary/20">
            <p className="text-sm text-muted-foreground mb-2">Split among {totalMembers} {totalMembers === 1 ? 'person' : 'people'}</p>
            <div className="flex gap-1">
              {[...Array(split.split_count)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    i < totalMembers ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Status & Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Settlement Progress</h2>
            <Badge variant="outline">
              {settledMembers}/{totalMembers} Settled
            </Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(settledMembers / totalMembers) * 100}%` }}
            />
          </div>
        </motion.div>

        {/* Members List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" />
            <h2 className="font-semibold">Members ({totalMembers})</h2>
          </div>

          <div className="space-y-2">
            {members.map((member, i) => (
              <div
                key={member.id}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`} />
                    <AvatarFallback>{member.profile?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{member.profile?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      Owes ₹{member.amount_owed.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="text-right flex items-center gap-2">
                  {member.payment_status === 'settled' ? (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Settled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-orange-500 text-orange-600">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Join Section */}
        {!hasJoined && session?.user ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-2 border-primary rounded-lg p-6 space-y-4 bg-primary/5"
          >
            <h2 className="font-semibold text-center">Join This Split?</h2>
            <p className="text-sm text-muted-foreground text-center">
              You'll owe <span className="font-bold text-primary">₹{split.amount_per_person.toFixed(2)}</span> for your share
            </p>
            <Button
              onClick={handleJoinSplit}
              disabled={joining}
              className="w-full"
              size="lg"
            >
              {joining ? 'Joining...' : 'Join Split'}
            </Button>
          </motion.div>
        ) : hasJoined ? (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              You've joined this split. You owe ₹{split.amount_per_person.toFixed(2)}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg p-6 text-center space-y-2">
            <p className="text-muted-foreground text-sm">Sign in to join this split</p>
            <Button onClick={() => navigate('/auth')} variant="outline">
              Sign In
            </Button>
          </div>
        )}

        {/* Share Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border rounded-lg p-4 space-y-2"
        >
          <p className="text-sm font-medium">Share This Split</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={window.location.href}
              readOnly
              className="flex-1 px-3 py-2 border rounded text-sm bg-muted"
            />
            <Button
              onClick={copyShareLink}
              variant="outline"
              size="sm"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
};

export default ViewSplit;
