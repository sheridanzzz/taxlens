"use client";

import { SessionProvider } from "next-auth/react";
import { isNeonConfigured, isSupabaseConfigured } from "@/lib/env";
import type { ReactNode } from "react";

export const AuthSessionProvider = ({ children }: { children: ReactNode }) => {
  if (!isNeonConfigured() || isSupabaseConfigured()) return <>{children}</>;
  return <SessionProvider>{children}</SessionProvider>;
};
