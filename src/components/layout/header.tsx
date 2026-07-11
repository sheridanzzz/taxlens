"use client";

import Link from "next/link";
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

import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { FINANCIAL_YEARS } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { state, updateSettings } = useTax();
  const { user, signOut, cloudEnabled } = useAuth();
  const router = useRouter();

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
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 md:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <form onSubmit={handleSearch} className="relative max-w-2xl flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          placeholder="Search expenses…"
          aria-label="Search expenses"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-gold/60"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
      <Select
        value={state.settings.financialYear}
        onValueChange={handleFinancialYearChange}
      >
        <SelectTrigger
          className="hidden h-9 w-auto rounded-md border border-border bg-transparent px-3 text-sm text-muted-foreground hover:text-foreground sm:flex"
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

      <Link
        href="/expenses?add=1"
        className="hidden h-9 items-center gap-2 whitespace-nowrap rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
        aria-label="Add expense"
      >
        <Plus className="h-4 w-4" />
        Add expense
      </Link>

      <Link
        href="/expenses?scan=1"
        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md bg-gold px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        aria-label="Scan receipt with AI"
      >
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline">Scan receipt</span>
      </Link>

      {cloudEnabled && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface"
            aria-label="User menu"
          >
            <Avatar className="h-7 w-7">
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
