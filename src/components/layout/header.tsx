"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, Plus, ScanLine, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LedgrLogo } from "@/components/LedgrLogo";

import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { useLaunchers } from "./app-shell";
import { FINANCIAL_YEARS } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { state, updateSettings } = useTax();
  const { user, signOut, cloudEnabled } = useAuth();
  const { openScanner, openExpenseForm } = useLaunchers();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const handleFinancialYearChange = async (value: string | null) => {
    if (!value) return;
    await updateSettings({
      ...state.settings,
      financialYear: value as FinancialYear,
    });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (q) router.push(`/expenses?q=${encodeURIComponent(q)}`);
  };

  const userInitials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="relative z-20 flex h-[4.5rem] shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu className="h-[18px] w-[18px]" />
      </Button>

      <div className="mr-auto lg:hidden">
        <LedgrLogo size="md" href="/dashboard" />
      </div>

      <form
        onSubmit={handleSearch}
        role="search"
        className="relative hidden max-w-2xl flex-1 md:block"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          name="q"
          placeholder="Search expenses…"
          aria-label="Search expenses"
          aria-keyshortcuts="/"
          className="h-10 w-full rounded-lg border border-border bg-surface/80 pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border/80 focus:border-gold/60"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:block">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
      <Select
        value={state.settings.financialYear}
        onValueChange={handleFinancialYearChange}
      >
        <SelectTrigger
          className="hidden h-10 w-auto rounded-lg border border-border bg-transparent px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground lg:flex"
          aria-label="Select financial year"
        >
          FY {state.settings.financialYear}
        </SelectTrigger>
        <SelectContent>
          {FINANCIAL_YEARS.map((fy) => (
            <SelectItem key={fy.value} value={fy.value}>
              {fy.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        onClick={() => router.push("/expenses")}
        className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-surface hover:text-foreground md:hidden"
        aria-label="Search expenses"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        onClick={openExpenseForm}
        className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-border px-3.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground xl:inline-flex"
        aria-label="Add expense"
      >
        <Plus className="h-4 w-4" />
        Add expense
      </button>

      <button
        onClick={openScanner}
        className="btn-press inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-gold px-3 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_oklch(0.82_0.16_82/12%)] hover:opacity-90 sm:px-4"
        aria-label="Scan receipt with AI"
      >
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline">Scan receipt</span>
      </button>

      {cloudEnabled && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-gold to-chart-5 text-[11px] font-semibold text-primary-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </header>
  );
};
