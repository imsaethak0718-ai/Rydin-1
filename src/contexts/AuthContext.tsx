import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  department?: string;
  year?: string;
  gender?: "male" | "female" | "other";
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  trust_score: number;
  profile_complete: boolean;
  phone_verified: boolean;
}

interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Google OAuth
  loginWithGoogle: () => Promise<void>;

  // Profile
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (supabaseUserData: SupabaseUser) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", supabaseUserData.id)
        .maybeSingle();

      if (data) {
        const profileData: Profile = {
          id: data.id,
          email: supabaseUserData.email || "",
          name: data.name || "",
          phone: data.phone,
          department: data.department,
          year: data.year,
          gender: data.gender,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          trust_score: data.trust_score ?? 4.0,
          profile_complete: data.profile_complete ?? false,
          phone_verified: data.phone_verified ?? false,
        };
        setUser(profileData);
      } else {
        // New user - create profile entry
        const newProfile: Profile = {
          id: supabaseUserData.id,
          email: supabaseUserData.email || "",
          name: supabaseUserData.user_metadata?.full_name || "",
          trust_score: 4.0,
          profile_complete: false,
          phone_verified: false,
        };

        await supabase.from("profiles").insert({
          id: supabaseUserData.id,
          email: supabaseUserData.email,
          name: supabaseUserData.user_metadata?.full_name || "",
          trust_score: 4.0,
          profile_complete: false,
          phone_verified: false,
        });

        setUser(newProfile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  // Listen to Supabase auth state
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        if (session?.user) {
          await fetchProfile(session.user);
        }
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        if (session?.user) {
          await fetchProfile(session.user);
        } else {
          setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Google OAuth Login
  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Google login error:", error);
      throw new Error(error.message || "Failed to login with Google");
    }
  };


  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!session?.user) return;

    try {
      const updates: Record<string, unknown> = {
        ...data,
        profile_complete: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", session.user.id);

      if (error) throw error;

      setUser((prev) => prev ? { ...prev, ...updates } as Profile : null);
    } catch (error) {
      console.error("Profile update error:", error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session?.user,
        isLoading,
        loginWithGoogle,
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
