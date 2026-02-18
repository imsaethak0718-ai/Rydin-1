import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

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
  upi_id?: string;
  avatar_url?: string;
  identity_verified: boolean;
  email_confirmed_at?: string | null;
}

interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Constants ──────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ylyxhdlncslvqdkhzohs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlseXhoZGxuY3NsdnFka2h6b2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzc5OTYsImV4cCI6MjA4MzcxMzk5Nn0.0aojeH-5LFapXOVJbpAkrHFM2_zDosGI_wI9fws8wEM";
const PROFILE_FETCH_TIMEOUT_MS = 4000;

// ─── Direct REST helper (bypasses Supabase JS client & RLS hangs) ───────────

async function fetchProfileViaREST(
  userId: string,
  accessToken: string
): Promise<Record<string, any> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS);

  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("REST profile fetch failed:", response.status, response.statusText);
      return null;
    }

    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0];
    }
    return null; // no profile row found
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.warn("⏰ Profile REST fetch timed out after", PROFILE_FETCH_TIMEOUT_MS, "ms");
    } else {
      console.error("REST profile fetch error:", err);
    }
    return null;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ──── Core: fetch or create profile ────────────────────────────────────

  const fetchProfile = async (supabaseUser: SupabaseUser, currentSession: Session) => {
    console.log("🔄 fetchProfile started for:", supabaseUser.id);

    const accessToken = currentSession.access_token;

    // Step 1: Try to read profile via direct REST (immune to RLS hangs)
    const data = await fetchProfileViaREST(supabaseUser.id, accessToken);

    if (data) {
      // Profile exists — map it
      const profile: Profile = {
        id: data.id,
        email: data.email || supabaseUser.email || "",
        name: data.name || supabaseUser.user_metadata?.full_name || "",
        phone: data.phone,
        department: data.department,
        year: data.year,
        gender: data.gender,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        trust_score: data.trust_score ?? 4.0,
        profile_complete: !!data.profile_complete,
        upi_id: data.upi_id,
        avatar_url: data.avatar_url || undefined,
        identity_verified: !!data.identity_verified,
        email_confirmed_at: supabaseUser.email_confirmed_at,
      };
      setUser(profile);
      console.log("✅ Profile loaded. profile_complete =", profile.profile_complete);

      // Recalculate trust score in background (fire-and-forget)
      import('@/lib/trustScore').then(({ recalculateTrustScore }) => {
        recalculateTrustScore(profile.id).then(newScore => {
          if (newScore !== profile.trust_score) {
            setUser(prev => prev ? { ...prev, trust_score: newScore } : prev);
          }
        });
      }).catch(() => { }); // Silent fail

      return;
    }

    // Step 2: REST returned null — either timed out, RLS blocked, or new user.
    // Try to create a new profile (upsert on conflict).
    console.log("📝 No profile found via REST. Attempting upsert for new user...");

    const newProfile: Profile = {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      name: supabaseUser.user_metadata?.full_name || "User",
      trust_score: 4.0,
      profile_complete: false,
      identity_verified: false,
    };

    // Use direct REST for the upsert too, to avoid the same RLS hang
    try {
      const upsertUrl = `${SUPABASE_URL}/rest/v1/profiles`;
      const upsertController = new AbortController();
      const upsertTimeout = setTimeout(() => upsertController.abort(), 4000);

      const upsertResp = await fetch(upsertUrl, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.full_name || "User",
          trust_score: 4.0,
          profile_complete: false,
        }),
        signal: upsertController.signal,
      });

      clearTimeout(upsertTimeout);

      if (upsertResp.ok) {
        console.log("✅ New profile created via REST upsert");
      } else {
        console.warn("⚠️ Profile upsert returned:", upsertResp.status, await upsertResp.text());
      }
    } catch (upsertErr: any) {
      if (upsertErr.name === "AbortError") {
        console.warn("⏰ Profile upsert timed out");
      } else {
        console.error("❌ Profile upsert error:", upsertErr);
      }
    }

    setUser(newProfile);
    console.log("🆕 Set new user profile (profile_complete = false)");
  };

  // ──── Auth initialization ──────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (mounted && currentSession?.user) {
          const email = currentSession.user.email || "";
          // ── SRM domain check ──
          if (!email.toLowerCase().endsWith("@srmist.edu.in")) {
            console.warn("🚫 Non-SRM session blocked on init:", email);
            await supabase.auth.signOut();
            localStorage.setItem("rydin:blocked_email", email);
            if (mounted) setIsLoading(false);
            return;
          }
          // ── Email verification check ──
          if (!currentSession.user.email_confirmed_at) {
            console.warn("📧 Unverified email, blocking session:", email);
            await supabase.auth.signOut();
            localStorage.setItem("rydin:pending_verification", email);
            if (mounted) setIsLoading(false);
            return;
          }
          setSession(currentSession);
          await fetchProfile(currentSession.user, currentSession);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          console.log("🏁 Auth initialization complete. isLoading = false");
        }
      }
    };

    // Safety net: force loading to end after 6 seconds no matter what
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("⏰ Safety timeout reached — forcing isLoading = false");
        setIsLoading(false);
      }
    }, 6000);

    initializeAuth().finally(() => clearTimeout(safetyTimer));

    // Listen to auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("🔔 Auth state change:", event);
      if (!mounted) return;

      // ── SRM domain enforcement for OAuth (Google) ──────────────────────
      if (newSession?.user) {
        const email = newSession.user.email || "";
        if (!email.toLowerCase().endsWith("@srmist.edu.in")) {
          console.warn("🚫 Non-SRM email blocked:", email);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          localStorage.setItem("rydin:blocked_email", email);
          return;
        }
        // ── Block unverified email signups ──
        if (!newSession.user.email_confirmed_at) {
          console.warn("📧 Unverified signup session, blocking:", email);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          localStorage.setItem("rydin:pending_verification", email);
          return;
        }
      }
      // ───────────────────────────────────────────────────────────────────

      setSession(newSession);

      if (newSession?.user) {
        await fetchProfile(newSession.user, newSession);
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // ──── Auth actions ─────────────────────────────────────────────────────

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    if (error) throw new Error(error.message);
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const loginWithGoogle = async () => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  // ──── Profile update ───────────────────────────────────────────────────

  const updateProfile = async (data: Partial<Profile>) => {
    if (!session?.user) return;

    const updates: Record<string, unknown> = {
      ...data,
      profile_complete: true,
      updated_at: new Date().toISOString(),
    };

    // Optimistic local update
    setUser((prev) => (prev ? { ...prev, ...updates } as Profile : null));

    try {
      // Use direct REST for the update too
      const updateUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(updates),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        console.log("✅ Profile updated via REST");
      } else {
        const errText = await resp.text();
        console.warn("⚠️ Profile update response:", resp.status, errText);

        // Fallback: try RPC
        console.log("🔄 Trying RPC fallback...");
        const { error: rpcError } = await supabase.rpc("update_profile_safe", {
          p_name: data.name || "",
          p_department: data.department || "",
          p_year: data.year || "",
          p_phone: data.phone || "",
          p_gender: (data.gender || "") as string,
          p_emergency_contact_name: data.emergency_contact_name || "",
          p_emergency_contact_phone: data.emergency_contact_phone || "",
        });

        if (rpcError) {
          console.error("❌ RPC fallback failed:", rpcError);
        } else {
          console.log("✅ Profile updated via RPC fallback");
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.warn("⏰ Profile update timed out — local state already updated");
      } else {
        console.error("❌ Profile update error:", err);
      }
    }

    // Always ensure local state reflects completion
    setUser((prev) => (prev ? { ...prev, ...updates } as Profile : null));
  };

  // ──── Refresh ──────────────────────────────────────────────────────────

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user, session);
    }
  };

  // ──── Render ───────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session?.user,
        isLoading,
        signUp,
        verifyOtp,
        login,
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
