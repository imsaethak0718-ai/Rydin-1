import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { login, signUp, verifyOtp, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const isSRMEmail = (email: string) => {
    return email.toLowerCase().endsWith("@srmist.edu.in");
  };

  // Redirect ONLY if authenticated AND email is confirmed
  useEffect(() => {
    if (isAuthenticated && user?.email_confirmed_at) {
      if (user?.profile_complete) {
        navigate("/");
      } else {
        navigate("/profile-setup");
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Check for blocked non-SRM Google login OR pending verification
  useEffect(() => {
    // 1. Non-SRM Block
    const blockedEmail = localStorage.getItem("rydin:blocked_email");
    if (blockedEmail) {
      localStorage.removeItem("rydin:blocked_email");
      toast({
        title: "Access Denied — Not an SRM Email",
        description: `${blockedEmail} is not allowed. Only @srmist.edu.in accounts can access Rydin.`,
        variant: "destructive",
        duration: 6000,
      });
    }

    // 2. Pending Verification (User signed up but didn't verify OTP yet)
    const pendingEmail = localStorage.getItem("rydin:pending_verification");
    if (pendingEmail) {
      localStorage.removeItem("rydin:pending_verification");
      setEmail(pendingEmail);
      setIsSignUp(true);
      setShowOtp(true);
      setResendCooldown(60);
      toast({
        title: "Verification Required",
        description: "Please enter the code sent to your email to continue.",
      });
    }
  }, [toast]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Auto-verify when all 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && showOtp) {
      handleVerifyOtp();
    }
  }, [otp, showOtp]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    try {
      await verifyOtp(email, otp);
      toast({
        title: "Email verified!",
        description: "Your account is now ready.",
      });
      // Redirect happens via useEffect
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code",
        variant: "destructive",
      });
      setOtp(""); // Clear OTP on failure
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      await signUp(email, password); // Re-triggering signup sends a new OTP
      setResendCooldown(60);
      toast({
        title: "Code resent!",
        description: "Check your SRM email again.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to resend",
        description: err.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Please fill in all fields");
      }

      if (!isSRMEmail(email)) {
        throw new Error("Only @srmist.edu.in emails are allowed");
      }

      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }
        await signUp(email, password);
        setShowOtp(true);
        setResendCooldown(60);
        toast({
          title: "Check your SRM email!",
          description: `We sent a 6-digit code to ${email}`,
        });
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      toast({
        title: isSignUp ? "Sign Up Failed" : "Login Failed",
        description: err.message || (isSignUp ? "Failed to create account" : "Failed to login"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Rydin</h1>
        </div>

        {/* Tagline */}
        <p className="text-center text-muted-foreground mb-8 text-sm">
          Share rides. Save money. Stay safe.
        </p>

        {showOtp ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Verify your email</h2>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-semibold text-foreground">{email}</span>
              </p>
            </div>

            <div className="flex justify-center py-4">
              <Input
                className="w-full h-14 text-center text-2xl tracking-[1em] font-mono"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.length !== 6}
              className="w-full h-12 text-base font-semibold"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : "Verify Code"}
            </Button>

            <div className="text-center">
              <button
                onClick={handleResendOtp}
                disabled={isLoading || resendCooldown > 0}
                className="text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>

            <button
              onClick={() => {
                setShowOtp(false);
                setOtp("");
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Back to Sign Up
            </button>
          </div>
        ) : (
          /* Form */
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="your@srmist.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  disabled={isLoading}
                  required
                />
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12"
                    disabled={isLoading}
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    {isSignUp ? "Creating account..." : "Signing in..."}
                  </>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Toggle Sign Up / Sign In */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  className="text-primary hover:underline font-medium"
                  disabled={isLoading}
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>
          </>
        )}

        {/* Privacy Notice */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our{" "}
          <a href="#" className="text-primary hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
