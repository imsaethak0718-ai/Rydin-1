import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string;
  name: string;
  department?: string;
  year?: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  trust_score: number;
  profile_complete: boolean;
}

interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (supabaseUser: SupabaseUser) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", supabaseUser.id)
      .maybeSingle();

    if (data) {
      setUser({
        id: data.id,
        email: data.email || supabaseUser.email || "",
        name: data.name || "",
        department: data.department,
        year: data.year,
        phone: data.phone,
        gender: data.gender,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        trust_score: data.trust_score ?? 4.0,
        profile_complete: data.profile_complete ?? false,
      });
    } else {
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        name: "",
        trust_score: 4.0,
        profile_complete: false,
        emergency_contact_name: undefined,
        emergency_contact_phone: undefined,
      });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          setTimeout(() => fetchProfile(newSession.user), 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        fetchProfile(existingSession.user).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validateEmail = (email: string) => {
    if (!email.endsWith("@srmist.edu.in")) {
      throw new Error("Only @srmist.edu.in emails are allowed");
    }
  };

  const login = async (email: string, password: string) => {
    validateEmail(email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email: string, password: string) => {
    validateEmail(email);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!session?.user) return;
    const updates: Record<string, unknown> = { ...data, profile_complete: true, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", session.user.id);
    if (error) throw error;
    setUser((prev) => prev ? { ...prev, ...updates } as Profile : null);
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        login,
        signup,
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
