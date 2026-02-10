import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, MapPin, Phone, Building, GraduationCap, Shield, LogOut, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getReliabilityBadgeConfig } from "@/lib/noShowHandling";

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast({ title: "Logged out", description: "See you soon!" });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoggingOut(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const reliabilityStatus = user.trust_score >= 4.5 ? "excellent" : user.trust_score >= 4.0 ? "good" : "fair";
  const badgeConfig = getReliabilityBadgeConfig(reliabilityStatus as any);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold font-display">Your Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile-edit")}
            className="h-9 w-9"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {/* Profile Header Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold font-display">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{user.trust_score.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Trust Score</p>
              </div>
            </div>

            {/* Reliability Badge */}
            <div className={`rounded-lg p-3 border ${badgeConfig.color}`}>
              <p className="text-xs font-semibold">{badgeConfig.icon} {badgeConfig.label}</p>
              <p className="text-xs">{badgeConfig.description}</p>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">About You</h3>

          {user.department && (
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Building className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-semibold">{user.department}</p>
              </div>
            </div>
          )}

          {user.year && (
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <GraduationCap className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Year</p>
                <p className="font-semibold">{user.year}</p>
              </div>
            </div>
          )}

          {user.phone && (
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Phone className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-semibold">{user.phone}</p>
              </div>
            </div>
          )}

          {user.emergency_contact_phone && (
            <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
              <Shield className="w-5 h-5 text-safety shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Emergency Contact</p>
                <p className="font-semibold">{user.emergency_contact_name}</p>
                <p className="text-xs text-muted-foreground">{user.emergency_contact_phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-primary mb-1">0</div>
            <p className="text-xs text-muted-foreground">Rides Completed</p>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-primary mb-1">₹0</div>
            <p className="text-xs text-muted-foreground">Total Saved</p>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border border-border">
            <div className="text-2xl font-bold text-primary mb-1">0</div>
            <p className="text-xs text-muted-foreground">No-shows</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-4">
          <Button
            variant="outline"
            className="w-full h-12 sm:h-11"
            onClick={() => navigate("/profile-edit")}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
          <Button
            variant="destructive"
            className="w-full h-12 sm:h-11"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </motion.main>

      <BottomNav />
    </div>
  );
};

export default Profile;
