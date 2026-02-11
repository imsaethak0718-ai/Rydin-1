import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import SMSVerification from "./pages/SMSVerification";
import ProfileSetup from "./pages/ProfileSetup";
import CreateRide from "./pages/CreateRide";
import Events from "./pages/Events";
import Hopper from "./pages/Hopper";
import Travel from "./pages/Travel";
import AIAssistant from "./pages/AIAssistant";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user && !user.profile_complete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If user is fully authenticated with profile complete, redirect to home
  if (isAuthenticated && user?.profile_complete) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
    <Route path="/auth-callback" element={<AuthCallback />} />
    <Route path="/sms-verification" element={<ProtectedRoute><SMSVerification /></ProtectedRoute>} />
    <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
    <Route path="/hopper" element={<ProtectedRoute><Hopper /></ProtectedRoute>} />
    <Route path="/travel" element={<ProtectedRoute><Travel /></ProtectedRoute>} />
    <Route path="/ai" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
    <Route path="/create" element={<ProtectedRoute><CreateRide /></ProtectedRoute>} />
    <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
