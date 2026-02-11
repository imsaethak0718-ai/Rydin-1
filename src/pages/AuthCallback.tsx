import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Wait a moment for auth context to process the session
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        if (user?.profile_complete) {
          navigate("/");
        } else {
          navigate("/profile-setup");
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
};

export default AuthCallback;
