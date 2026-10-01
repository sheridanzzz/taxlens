"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { ReceiptScanner } from "@/components/expenses/receipt-scanner";
import { useAuth } from "@/context/auth-context";
import { useTax } from "@/context/tax-context";

const SHELL_BYPASS_PATHS = ["/login", "/signup", "/"];

/**
 * Scanning a receipt or adding an expense is a thing you do *from* wherever you
 * are — not a place you navigate to. Both dialogs are mounted once in the shell
 * so any launcher opens them in place, with no page change underneath.
 */
const LaunchersContext = createContext<{
  openScanner: () => void;
  openExpenseForm: () => void;
} | null>(null);

export const useLaunchers = () => {
  const ctx = useContext(LaunchersContext);
  if (!ctx) throw new Error("useLaunchers must be used within AppShell");
  return ctx;
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, cloudEnabled } = useAuth();
  const { state } = useTax();

  useEffect(() => {
    if (
      cloudEnabled &&
      !loading &&
      !user &&
      !SHELL_BYPASS_PATHS.includes(pathname)
    ) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [cloudEnabled, loading, pathname, router, user]);

  if (SHELL_BYPASS_PATHS.includes(pathname)) return <>{children}</>;

  if (cloudEnabled) {
    if (loading || !user || !state.loaded) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      );
    }
  }

  return (
    <LaunchersContext.Provider
      value={{
        openScanner: () => setScannerOpen(true),
        openExpenseForm: () => setExpenseFormOpen(true),
      }}
    >
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-md bg-gold px-4 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
          >
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>

      <ReceiptScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onExpenseCreated={() => {}}
      />
      <ExpenseForm open={expenseFormOpen} onOpenChange={setExpenseFormOpen} />
    </LaunchersContext.Provider>
  );
};
