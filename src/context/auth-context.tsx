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

  useEffect(() => {
    const init = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    };

    init();
  }, []);

  const signOut = useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const mapped = user ? { id: user.id, email: user.email ?? "" } : null;

  return (
    <AuthContext.Provider
      value={{ user: mapped, loading, cloudEnabled: true, signOut }}
    >
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
