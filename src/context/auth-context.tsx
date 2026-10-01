"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, isNeonConfigured } from "@/lib/env";

interface AuthContextValue {
  user: { id: string; email: string } | null;
  loading: boolean;
  cloudEnabled: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SupabaseAuthInner = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    const init = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (disposed) return;
        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (disposed) return;
          setUser(session?.user ?? null);
          setLoading(false);
        });
        unsubscribe = () => subscription.unsubscribe();
        const { data, error } = await supabase.auth.getUser();
        if (disposed) return;
        if (error) throw error;
        setUser(data.user);
      } catch {
        if (!disposed) setAuthError("Could not verify your session. Reload to try again.");
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void init();
    return () => { disposed = true; unsubscribe?.(); };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      setUser(null);
      // Clear authenticated page and provider state after sign-out.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    } catch {
      setAuthError("Could not sign out. Please try again.");
    }
  }, []);

  const mapped = user ? { id: user.id, email: user.email ?? "" } : null;

  return (
    <AuthContext.Provider
      value={{ user: mapped, loading, cloudEnabled: true, signOut }}
    >
      {authError && <p role="alert" className="m-4 text-sm text-destructive">{authError} <button className="underline" onClick={() => window.location.reload()}>Reload</button></p>}
      {children}
    </AuthContext.Provider>
  );
};

const NeonAuthInner = ({ children }: { children: ReactNode }) => {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const user = session?.user
    ? { id: session.user.id ?? "", email: session.user.email ?? "" }
    : null;

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ redirectTo: "/login" });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, cloudEnabled: true, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

const LocalAuthInner = ({ children }: { children: ReactNode }) => {
  const signOut = useCallback(async () => {}, []);

  return (
    <AuthContext.Provider
      value={{ user: null, loading: false, cloudEnabled: false, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  if (isSupabaseConfigured()) {
    return <SupabaseAuthInner>{children}</SupabaseAuthInner>;
  }
  if (isNeonConfigured()) {
    return <NeonAuthInner>{children}</NeonAuthInner>;
  }
  return <LocalAuthInner>{children}</LocalAuthInner>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
