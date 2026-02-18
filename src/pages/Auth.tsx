import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Loader, ShieldCheck, ArrowLeft, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const SRM_DOMAIN = "@srmist.edu.in";
const isSRMEmail = (email: string) => email.toLowerCase().endsWith(SRM_DOMAIN);

// ── OTP Input Component ────────────────────────────────────────────────────
const OtpInput = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    const joined = next.join("").slice(0, 6);
    onChange(joined);
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          disabled={disabled}
          className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 bg-background outline-none transition-all
            ${d ? "border-primary text-foreground" : "border-border text-muted-foreground"}
            ${disabled ? "opacity-50" : "focus:border-primary focus:ring-2 focus:ring-primary/20"}
          `}
        />
      ))}
    </div>
  );
};

// ── Main Auth Component ────────────────────────────────────────────────────
const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP state
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { login, signUp, signInWithGoogle, verifyOtp, resendOtp, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(user?.profile_complete ? "/" : "/profile-setup");
    }
  }, [isAuthenticated, user, navigate]);

  // Check for blocked non-SRM Google login
  useEffect(() => {
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
  }, [toast]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Auto-verify when all 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && showOtp) {
      handleVerifyOtp();
    }
  }, [otp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (!isSRMEmail(email)) {
      toast({
        title: "SRM Email Required",
        description: "Only @srmist.edu.in emails are allowed.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        if (password !== confirmPassword) throw new Error("Passwords don't match");
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
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || otpLoading) return;
    setOtpLoading(true);
    try {
      await verifyOtp(email, otp);
      toast({ title: "Email Verified! ✅", description: "Welcome to Rydin!" });
      // Auth state change will redirect automatically
    } catch (err: any) {
      toast({
        title: "Invalid Code",
        description: err.message || "The code is wrong or expired. Try resending.",
        variant: "destructive",
      });
      setOtp("");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendOtp(email);
      setResendCooldown(60);
      setOtp("");
      toast({ title: "Code resent!", description: `Check ${email}` });
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message, variant: "destructive" });
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      toast({
        title: "Google Sign-In Failed",
        description: err.message || "Could not sign in with Google",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const emailInvalid = email.length > 4 && !isSRMEmail(email);

  // ── OTP Screen ─────────────────────────────────────────────────────────
  if (showOtp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Back */}
          <button
            onClick={() => { setShowOtp(false); setOtp(""); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Check your email</h1>
          <p className="text-center text-muted-foreground text-sm mb-2">
            We sent a 6-digit code to
          </p>
          <p className="text-center font-semibold text-sm mb-8 text-foreground">{email}</p>

          {/* OTP Boxes */}
          <div className="mb-6">
            <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />
          </div>

          {/* Verify Button */}
          <Button
            onClick={handleVerifyOtp}
            disabled={otp.length !== 6 || otpLoading}
            className="w-full h-12 text-base font-semibold mb-4"
          >
            {otpLoading ? (
              <><Loader className="w-4 h-4 animate-spin mr-2" /> Verifying...</>
            ) : (
              "Verify Code"
            )}
          </Button>

          {/* Resend */}
          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="flex items-center gap-1.5 mx-auto text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Didn't get it? Check your spam folder or{" "}
            <button onClick={() => { setShowOtp(false); setOtp(""); }} className="text-primary hover:underline">
              try a different email
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Auth Screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Rydin</h1>
        </div>

        {/* SRM Badge */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <p className="text-xs text-emerald-600 font-medium">SRM Students Only · @srmist.edu.in</p>
        </div>

        {/* Google Sign In */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 text-sm font-medium flex items-center gap-3 mb-4"
          onClick={handleGoogle}
          disabled={googleLoading || isLoading}
        >
          {googleLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
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

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or use SRM email</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">SRM Email</label>
            <Input
              type="email"
              placeholder="you@srmist.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`h-12 ${emailInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
              required
            />
            {emailInvalid && (
              <p className="text-xs text-destructive mt-1">Only @srmist.edu.in emails are allowed</p>
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

          <AnimatePresence>
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
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
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            disabled={isLoading || emailInvalid}
            className="w-full h-12 text-base font-semibold"
          >
            {isLoading ? (
              <><Loader className="w-4 h-4 animate-spin mr-2" />{isSignUp ? "Creating account..." : "Signing in..."}</>
            ) : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setPassword(""); setConfirmPassword(""); }}
              className="text-primary hover:underline font-medium"
              disabled={isLoading}
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        {/* Privacy */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          By continuing, you agree to our{" "}
          <button type="button" onClick={() => navigate("/terms")} className="text-primary hover:underline">Terms</button>{" "}
          and{" "}
          <button type="button" onClick={() => navigate("/privacy")} className="text-primary hover:underline">Privacy Policy</button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
