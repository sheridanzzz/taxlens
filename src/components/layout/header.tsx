"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, HardDrive, Plus, ScanLine } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  IconCalendar,
  IconChevron,
  IconMoon,
  IconPlus,
  IconLock,
} from "@/components/dashboard/icons";

import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { FINANCIAL_YEARS } from "@/lib/constants";
import type { FinancialYear } from "@/lib/types";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/expenses": "Expenses",
  "/wfh": "Work From Home",
  "/assets": "Depreciation",
  "/reports": "Reports",
  "/settings": "Settings",
};

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { theme, setTheme } = useTheme();
  const { state, updateSettings } = useTax();
  const { user, signOut, cloudEnabled } = useAuth();
  const pathname = usePathname();

  const pageTitle = PAGE_TITLES[pathname] || "Ledgr";

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleFinancialYearChange = async (value: string | null) => {
    if (!value) return;
    await updateSettings({
      ...state.settings,
      financialYear: value as FinancialYear,
    });
  };

  const userInitials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "?";

  const fyLabel = FINANCIAL_YEARS.find(
    (f) => f.value === state.settings.financialYear
  )?.label ?? state.settings.financialYear;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/85 px-6 py-4 backdrop-blur sm:px-10">
      <div className="flex items-center gap-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Select
          value={state.settings.financialYear}
          onValueChange={handleFinancialYearChange}
        >
          <SelectTrigger
            className="btn-press h-10 w-auto min-w-[170px] rounded-full border-0 bg-secondary px-4 text-[13px] font-semibold text-secondary-foreground"
            aria-label="Select financial year"
          >
            <span className="flex items-center gap-2">
              <IconCalendar /> {fyLabel}
            </span>
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
          onClick={handleThemeToggle}
          className="btn-press grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground"
          aria-label="Toggle theme"
        >
          <IconMoon />
        </button>

        <Link
          href="/expenses?add=1"
          className="btn-press hidden items-center gap-2 whitespace-nowrap rounded-full bg-secondary px-5 py-2.5 text-[14px] font-semibold text-secondary-foreground sm:inline-flex"
          aria-label="Add expense"
        >
          <IconPlus /> Add expense
        </Link>

        <Link
          href="/expenses?scan=1"
          className="btn-press hidden items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 py-2.5 text-[14px] font-bold text-primary-foreground sm:inline-flex"
          aria-label="Scan receipt with AI"
        >
          <ScanLine className="h-4 w-4" /> Scan receipt
        </Link>

        {!cloudEnabled ? (
          <span className="ring-card hidden items-center gap-2 rounded-full bg-background px-3 py-1.5 text-[12px] font-semibold text-muted-foreground sm:inline-flex">
            <IconLock /> Local
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-mint text-[10px] font-medium text-mint-foreground">
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
