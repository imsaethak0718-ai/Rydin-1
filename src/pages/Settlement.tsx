import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

interface Settlement {
  id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  status: string;
  payment_method?: string;
  proof_url?: string;
  created_at: string;
  completed_at?: string;
  payer?: { name: string; id: string };
  payee?: { name: string; id: string };
  split_id?: string;
}

const Settlement = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const [owedByMe, setOwedByMe] = useState<Settlement[]>([]);
  const [owedToMe, setOwedToMe] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchSettlements();
    }
  }, [session?.user?.id]);

  const fetchSettlements = async () => {
    try {
      setLoading(true);

      // Get settlements where user owes money
      const { data: owed, error: owedError } = await supabase
        .from('settlements')
        .select(`
          id, payer_id, payee_id, amount, status, payment_method,
          proof_url, created_at, completed_at,
          payer:payer_id (name, id),
          payee:payee_id (name, id)
        `)
        .eq('payer_id', session!.user.id)
        .order('created_at', { ascending: false });

      if (owedError) throw owedError;

      // Get settlements where user is owed money
      const { data: ows, error: owsError } = await supabase
        .from('settlements')
        .select(`
          id, payer_id, payee_id, amount, status, payment_method,
          proof_url, created_at, completed_at,
          payer:payer_id (name, id),
          payee:payee_id (name, id)
        `)
        .eq('payee_id', session!.user.id)
        .order('created_at', { ascending: false });

      if (owsError) throw owsError;

      setOwedByMe(owed || []);
      setOwedToMe(ows || []);
    } catch (error) {
      console.error('Error fetching settlements:', error);
      toast({
        title: 'Error',
        description: 'Could not load settlements',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (settlementId: string) => {
    try {
      setMarkingPaid(settlementId);

      const { error } = await supabase
        .from('settlements')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', settlementId);

      if (error) throw error;

      toast({
        title: 'Marked as Paid',
        description: 'Settlement updated successfully',
      });

      // Refresh
      fetchSettlements();
    } catch (error) {
      console.error('Error updating settlement:', error);
      toast({
        title: 'Error',
        description: 'Could not update settlement',
        variant: 'destructive',
      });
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleConfirmPayment = async (settlementId: string, paymentMethod: string) => {
    try {
      const { error } = await supabase
        .from('settlements')
        .update({
          status: 'completed',
          payment_method: paymentMethod,
          completed_at: new Date().toISOString(),
        })
        .eq('id', settlementId);

      if (error) throw error;

      toast({
        title: 'Payment Confirmed',
        description: `Marked as paid via ${paymentMethod}`,
      });

      fetchSettlements();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not confirm payment',
        variant: 'destructive',
      });
    }
  };

  const totalOwed = owedByMe.reduce((sum, s) => sum + (s.status === 'pending' ? s.amount : 0), 0);
  const totalDue = owedToMe.reduce((sum, s) => sum + (s.status === 'pending' ? s.amount : 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading settlements...</p>
      </div>
    );
  }

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
          <h1 className="font-bold font-display">Settlements</h1>
          <div className="w-8" />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4 space-y-2"
          >
            <p className="text-sm text-muted-foreground">You Owe</p>
            <p className="text-2xl font-bold text-orange-600">₹{totalOwed.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{owedByMe.filter(s => s.status === 'pending').length} pending</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border rounded-lg p-4 space-y-2"
          >
            <p className="text-sm text-muted-foreground">You're Owed</p>
            <p className="text-2xl font-bold text-green-600">₹{totalDue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{owedToMe.filter(s => s.status === 'pending').length} pending</p>
          </motion.div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="owed" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="owed">
              You Owe
              {owedByMe.filter(s => s.status === 'pending').length > 0 && (
                <span className="ml-2 text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {owedByMe.filter(s => s.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="due">
              You're Owed
              {owedToMe.filter(s => s.status === 'pending').length > 0 && (
                <span className="ml-2 text-xs bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {owedToMe.filter(s => s.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* You Owe Tab */}
          <TabsContent value="owed" className="space-y-3 mt-4">
            {owedByMe.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No settlements yet</p>
              </div>
            ) : (
              owedByMe.map((settlement) => (
                <motion.div
                  key={settlement.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`border rounded-lg p-4 space-y-3 ${
                    settlement.status === 'completed' ? 'bg-muted/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${settlement.payee_id}`} />
                        <AvatarFallback>{settlement.payee?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Pay {settlement.payee?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(settlement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">₹{settlement.amount.toFixed(2)}</p>
                      {settlement.status === 'completed' ? (
                        <Badge className="bg-green-500">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {settlement.status === 'pending' && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium">Mark as paid via:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirmPayment(settlement.id, 'upi')}
                          disabled={markingPaid === settlement.id}
                        >
                          💰 UPI
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirmPayment(settlement.id, 'cash')}
                          disabled={markingPaid === settlement.id}
                        >
                          💵 Cash
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* You're Owed Tab */}
          <TabsContent value="due" className="space-y-3 mt-4">
            {owedToMe.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No settlements yet</p>
              </div>
            ) : (
              owedToMe.map((settlement) => (
                <motion.div
                  key={settlement.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`border rounded-lg p-4 space-y-3 ${
                    settlement.status === 'completed' ? 'bg-muted/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${settlement.payer_id}`} />
                        <AvatarFallback>{settlement.payer?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{settlement.payer?.name} owes you</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(settlement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">₹{settlement.amount.toFixed(2)}</p>
                      {settlement.status === 'completed' ? (
                        <Badge className="bg-green-500">Received</Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-500">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {settlement.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleMarkAsPaid(settlement.id)}
                        disabled={markingPaid === settlement.id}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark Received
                      </Button>
                      <Button size="sm" variant="outline">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Info Box */}
        {(totalOwed > 0 || totalDue > 0) && (
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              💡 Payment Settlement Tips
            </p>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
              <li>Always confirm payment method (UPI/Cash)</li>
              <li>Take screenshot of UPI confirmation</li>
              <li>Update settlement status after payment</li>
              <li>Keep records for disputes</li>
            </ul>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Settlement;
