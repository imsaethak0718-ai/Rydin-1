import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Building,
  GraduationCap,
  Shield,
  LogOut,
  Edit2,
  CheckCircle,
  Award,
  Users,
  Wallet,
  Camera,
  Upload,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge as UIWebBadge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getReliabilityBadgeConfig } from "@/lib/noShowHandling";
import { IDScanner } from "@/components/IDScanner";
import { getUserBadges, Badge as GameBadge } from "@/lib/leaderboards";
import { getUserReferralStats } from "@/lib/referrals";
import { uploadProfilePhoto, saveAvatarUrl } from "@/lib/photoCapture";

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [badges, setBadges] = useState<GameBadge[]>([]);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      fetchUserStats();
      checkVerificationStatus();
    }
  }, [user?.id]);

  // Check verification status from user_verifications table directly
  const checkVerificationStatus = async () => {
    if (!user?.id) return;

    // First check the profile field
    if (user.identity_verified) {
      setIsVerified(true);
      return;
    }

    // Fallback: check user_verifications table directly
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('user_verifications')
        .select('verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data?.verified) {
        setIsVerified(true);
      }
    } catch (err) {
      console.error('Verification check failed:', err);
    }
  };

  const fetchUserStats = async () => {
    try {
      setLoadingStats(true);
      const [earnedBadges, stats] = await Promise.all([
        getUserBadges(user!.id),
        getUserReferralStats(user!.id)
      ]);
      setBadges(earnedBadges);
      setReferralStats(stats);
    } catch (error) {
      console.error("Error fetching profile stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

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

  const handleScanSuccess = () => {
    setShowScanner(false);
    setIsVerified(true); // Optimistically update UI immediately
    toast({
      title: "🎉 Verified!",
      description: "Your identity has been verified successfully. You now have the Verified badge!",
    });
    // Refresh user data
    refreshProfile();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.id, file);
      if (url) {
        await saveAvatarUrl(user.id, url);
        toast({ title: "Photo Updated", description: "Your profile photo has been updated!" });
        refreshProfile();
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      toast({ title: "Upload Failed", description: "Could not upload photo. Try again.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
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
  const hasPhoto = !!user.avatar_url;

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
        {/* Profile Header Card with Avatar */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative group">
                  {hasPhoto ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-primary/30 shadow-md">
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary/60">
                        {user.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  {/* Upload overlay on hover */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploadingPhoto ? (
                      <span className="text-white text-xs animate-spin">⏳</span>
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  {/* Verified checkmark */}
                  {isVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-background">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold font-display">{user.name}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {isVerified && (
                    <UIWebBadge variant="secondary" className="mt-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-[10px]">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Verified Student
                    </UIWebBadge>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{user.trust_score.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Trust Score</p>
              </div>
            </div>

            {/* Upload photo button when no photo */}
            {!hasPhoto && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full flex items-center gap-3 p-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors"
              >
                <div className="p-2 bg-primary/10 rounded-full">
                  <Camera className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{uploadingPhoto ? "Uploading..." : "Add Profile Photo"}</p>
                  <p className="text-xs text-muted-foreground">Help others recognize you</p>
                </div>
              </button>
            )}

            {/* Reliability Badge */}
            <div className={`rounded-lg p-3 border ${badgeConfig.color}`}>
              <p className="text-xs font-semibold">{badgeConfig.icon} {badgeConfig.label}</p>
              <p className="text-xs">{badgeConfig.description}</p>
            </div>
          </div>
        </div>

        {/* Verification Section */}
        {!isVerified && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Verify Your Identity
                </p>
                <p className="text-xs text-orange-800 dark:text-orange-200">
                  Upload your college ID to get the <strong>"Verified"</strong> badge.
                  We'll match the name on your ID with your profile name.
                </p>
                {!hasPhoto && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    Add a profile photo first for a complete profile
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => setShowScanner(true)}
                className="shrink-0"
              >
                Verify Now
              </Button>
            </div>
          </div>
        )}

        {/* Verified Success Banner */}
        {isVerified && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">Identity Verified ✅</p>
              <p className="text-xs text-green-800 dark:text-green-200">Your college identity has been confirmed</p>
            </div>
          </div>
        )}

        {/* Real-time Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-4 border border-border flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Credits</p>
              <p className="text-xl font-bold font-display">₹{referralStats?.total_earned || 0}</p>
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full text-green-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Referrals</p>
              <p className="text-xl font-bold font-display">{referralStats?.total_referrals || 0}</p>
            </div>
          </div>
        </div>

        {/* Badges Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Earned Badges</h3>
            <span className="text-xs text-primary font-medium">{badges.length} Unlocked</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {badges.length > 0 ? (
              badges.map((badge) => (
                <UIWebBadge key={badge.id} variant="secondary" className="px-3 py-1 flex items-center gap-1.5">
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </UIWebBadge>
              ))
            ) : (
              <div className="w-full py-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                <Award className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Complete rides and splits to earn badges!</p>
              </div>
            )}
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

      <AnimatePresence>
        {showScanner && (
          <IDScanner
            userId={user.id}
            userName={user.name}
            onSuccess={handleScanSuccess}
            onCancel={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};

export default Profile;
