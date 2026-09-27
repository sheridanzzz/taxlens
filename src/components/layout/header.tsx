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
    <header className="relative z-20 flex h-[4.5rem] shrink-0 items-center gap-2 bg-background px-3 sm:gap-3 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 lg:hidden"
        onClick={onMenuClick}
        id="sidebar-toggle"
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
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          name="q"
          placeholder="Search expenses…"
          aria-label="Search expenses"
          aria-keyshortcuts="/"
          className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-12 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-gold"
        />
        <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground xl:block">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
      <Select
        value={state.settings.financialYear}
        onValueChange={handleFinancialYearChange}
      >
        <SelectTrigger
          className="h-11 w-auto rounded-full border border-border bg-surface px-2 text-xs font-bold text-foreground hover:bg-surface-2 sm:px-4 sm:text-sm"
          aria-label="Select financial year"
        >
          <span className="hidden sm:inline">FY </span>{state.settings.financialYear}
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
        className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-foreground hover:bg-surface-2 hidden sm:grid md:hidden"
        aria-label="Search expenses"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        onClick={openExpenseForm}
        className="hidden h-11 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-2 xl:inline-flex"
        aria-label="Add expense"
      >
        <Plus className="h-4 w-4" />
        Add expense
      </button>

      <button
        onClick={openScanner}
        className="btn-press inline-flex h-11 lg:hidden items-center gap-2 whitespace-nowrap rounded-full bg-plum px-4 text-sm font-extrabold text-white hover:opacity-90 sm:px-5"
        aria-label="Scan receipt"
      >
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline">Scan receipt</span>
      </button>

      {cloudEnabled && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="hidden h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 sm:flex"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-pink text-xs font-extrabold text-plum">
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
