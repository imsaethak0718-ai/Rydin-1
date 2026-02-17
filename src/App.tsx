import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { debugSupabase } from "@/lib/debugSupabase";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfileSetup from "./pages/ProfileSetup";
import CreateRide from "./pages/CreateRide";
import CreateSplit from "./pages/CreateSplit";
import ViewSplit from "./pages/ViewSplit";
import Settlement from "./pages/Settlement";
import Admin from "./pages/Admin";
import Events from "./pages/Events";
import Hopper from "./pages/Hopper";
import Travel from "./pages/Travel";
import AIAssistant from "./pages/AIAssistant";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Search from "./pages/Search";
import Transport from "./pages/Transport";
import Activity from "./pages/Activity";
import RideChat from "./pages/RideChat";
import DirectChat from "./pages/DirectChat";
import ProfileEdit from "./pages/ProfileEdit";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  console.log("🔐 ProtectedRoute check:", {
    path: location.pathname,
    isLoading,
    isAuthenticated,
    profileComplete: user?.profile_complete
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("🚫 Not authenticated, redirecting to /auth");
    return <Navigate to="/auth" replace />;
  }

  // CRITICAL FIX: Don't redirect if we are ALREADY on the profile setup page
  if (user && !user.profile_complete && location.pathname !== "/profile-setup") {
    console.log("📝 Profile incomplete, redirecting to /profile-setup");
    return <Navigate to="/profile-setup" replace />;
  }

  // If profile IS complete but user tries to go to setup, optional: redirect to home?
  // For now, removing this restriction or just letting them access it to edit is safer.

  console.log("✅ Access granted to:", location.pathname);
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  console.log("🔓 AuthRoute check:", { isLoading, isAuthenticated, user: user?.email, profileComplete: user?.profile_complete });

  if (isLoading) {
    console.log("⏳ AuthRoute: Still loading...");
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If user is fully authenticated with profile complete, redirect to home
  if (isAuthenticated) {
    if (user?.profile_complete) {
      console.log("✅ AuthRoute: Already authenticated, redirecting to /");
      return <Navigate to="/" replace />;
    } else {
      console.log("⚠️ AuthRoute: Authenticated but profile incomplete, redirecting to /profile-setup");
      return <Navigate to="/profile-setup" replace />;
    }
  }

  console.log("🔓 AuthRoute: Showing auth page");
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
    <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
    <Route path="/hopper" element={<ProtectedRoute><Hopper /></ProtectedRoute>} />
    <Route path="/travel" element={<ProtectedRoute><Travel /></ProtectedRoute>} />
    <Route path="/ai" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
    <Route path="/create" element={<ProtectedRoute><CreateRide /></ProtectedRoute>} />
    <Route path="/create-split" element={<ProtectedRoute><CreateSplit /></ProtectedRoute>} />
    <Route path="/split/:shareToken" element={<ViewSplit />} />
    <Route path="/settlement" element={<ProtectedRoute><Settlement /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
    <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/profile-edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
    <Route path="/transport" element={<ProtectedRoute><Transport /></ProtectedRoute>} />
    <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
    <Route path="/ride-chat" element={<ProtectedRoute><RideChat /></ProtectedRoute>} />
    <Route path="/chat/:userId" element={<ProtectedRoute><DirectChat /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  useEffect(() => {
    // Run diagnostics once on mount to help user
    console.log("🚀 Auto-running Supabase diagnostics...");
    debugSupabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
