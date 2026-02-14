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
  const { login, signUp, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.profile_complete) {
        navigate("/");
      } else {
        navigate("/profile-setup");
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Please fill in all fields");
      }

      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }
        await signUp(email, password);
        toast({
          title: "Account Created",
          description: "Please log in with your credentials",
        });
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        await login(email, password);
        // Don't navigate here - let the useEffect above handle it
        // based on profile_complete status
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              placeholder="your@email.com"
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
