import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Loader, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { login, signUp, verifyOtp, loginWithGoogle, isAuthenticated, user } = useAuth();
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
      setGoogleLoading(false);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      toast({
        title: "Google Sign In Failed",
        description: err.message || "Unable to continue with Google",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const emailInvalid = email.length > 4 && !isSRMEmail(email);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Rydin</h1>
        </div>

        {/* SRM Badge - Restored */}
        <div className="flex items-center justify-center gap-1.5 mb-8">
          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold tracking-wide uppercase">SRM Students Only</p>
        </div>

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
                <label className="block text-sm font-medium mb-2">SRM Email</label>
                <Input
                  type="email"
                  placeholder="your@srmist.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-12 ${emailInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={isLoading}
                  required
                />
                {emailInvalid && (
                  <p className="text-xs text-destructive mt-1">
                    Only @srmist.edu.in emails are allowed
                  </p>
                )}
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
                disabled={isLoading || emailInvalid}
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

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={googleLoading || isLoading}
                className="w-full h-12 text-base font-semibold flex items-center gap-3"
                onClick={handleGoogleSignIn}
              >
                {googleLoading ? (
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </Button>
            </form>

            {/* Toggle Sign Up / Sign In */}
            <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border/50 pt-6">
              <p>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  className="text-primary hover:underline font-semibold"
                  disabled={isLoading}
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>
          </>
        )}

        {/* Privacy Notice - Restored functional links */}
        <div className="text-center text-[10px] sm:text-xs text-muted-foreground mt-8 leading-relaxed">
          By continuing, you agree to our{" "}
          <button type="button" onClick={() => navigate("/terms")} className="text-primary hover:underline font-medium">Terms of Service</button>
          {" "}and{" "}
          <button type="button" onClick={() => navigate("/privacy")} className="text-primary hover:underline font-medium">Privacy Policy</button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
