"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAuth } from "@/context/auth-context";

const SHELL_BYPASS_PATHS = ["/login", "/signup", "/"];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, cloudEnabled } = useAuth();

  const isAuthPage = SHELL_BYPASS_PATHS.includes(pathname);

  if (!cloudEnabled) {
    if (isAuthPage) {
      return <>{children}</>;
    }
    const handleMenuClick = () => setSidebarOpen(true);
    const handleSidebarClose = () => setSidebarOpen(false);
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={handleMenuClick} />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const handleMenuClick = () => setSidebarOpen(true);
  const handleSidebarClose = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={handleMenuClick} />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};
