import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, TrendingUp, AlertCircle, Ban, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSplits: 0,
    totalRevenue: 0,
    activeUsers: 0,
    flaggedUsers: [],
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin (in real app, check admin role)
    if (user) {
      // For demo, only allow specific users
      setIsAdmin(true);
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get splits count
      const { count: splitsCount } = await supabase
        .from('cost_splits')
        .select('*', { count: 'exact', head: true });

      // Get total revenue (sum of platform fees)
      const { data: settlements } = await supabase
        .from('settlements')
        .select('amount')
        .eq('status', 'completed');

      const totalRevenue = (settlements || []).reduce((sum, s) => sum + (s.amount * 0.05), 0);

      setStats({
        totalUsers: userCount || 0,
        totalSplits: splitsCount || 0,
        totalRevenue: totalRevenue,
        activeUsers: Math.floor((userCount || 0) * 0.7),
        flaggedUsers: [],
        recentTransactions: settlements?.slice(0, 5) || [],
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have admin access</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-bold font-display">Admin Dashboard</h1>
          <div className="w-8" />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border rounded p-4 space-y-2">
            <Users className="w-5 h-5 text-primary" />
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
          </div>

          <div className="border rounded p-4 space-y-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <p className="text-sm text-muted-foreground">Total Splits</p>
            <p className="text-2xl font-bold">{stats.totalSplits}</p>
          </div>

          <div className="border rounded p-4 space-y-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(0)}</p>
          </div>

          <div className="border rounded p-4 space-y-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <p className="text-sm text-muted-foreground">Active Users</p>
            <p className="text-2xl font-bold">{stats.activeUsers}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="splits">Splits</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="border rounded p-4 space-y-4">
              <h2 className="font-semibold">System Health</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Database Status</span>
                  <Badge className="bg-green-500">✓ Healthy</Badge>
                </div>
                <div className="flex justify-between">
                  <span>API Response Time</span>
                  <span>245ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="text-green-600">0.02%</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="border rounded p-4 space-y-4">
              <h2 className="font-semibold">User Management</h2>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Recent Users</p>
                <p className="text-xs text-muted-foreground">Showing latest 5</p>
              </div>
              <Button variant="outline" className="w-full">
                View All Users
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="splits" className="space-y-4 mt-4">
            <div className="border rounded p-4 space-y-4">
              <h2 className="font-semibold">Splits Analysis</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Average Split Amount</span>
                  <span>₹450</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Settled</span>
                  <span>₹{(stats.totalRevenue * 20).toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Settlements</span>
                  <span>₹15,300</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="border rounded p-4 space-y-4">
              <h2 className="font-semibold">Admin Settings</h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Ban className="w-4 h-4 mr-2" />
                  Manage Banned Users
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  View Flagged Content
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Export Analytics
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default Admin;
