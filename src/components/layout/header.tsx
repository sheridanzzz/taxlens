"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, LogOut, HardDrive, Plus } from "lucide-react";
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

const PAGE_SUBTITLES: Record<string, string> = {
  "/dashboard": "FY snapshot",
};

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { theme, setTheme } = useTheme();
  const { state, updateSettings } = useTax();
  const { user, signOut, supabaseEnabled } = useAuth();
  const pathname = usePathname();

  const pageTitle = PAGE_TITLES[pathname] || "Ledgr";
  const subtitle = PAGE_SUBTITLES[pathname];

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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[rgba(14,15,12,0.08)] bg-white/90 px-4 backdrop-blur-md dark:border-[rgba(255,255,255,0.06)] dark:bg-[#0e0f0c]/90 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-medium tracking-tight text-[#0e0f0c] dark:text-[#f4f5f2]">
            {pageTitle}
          </h2>
          {subtitle && (
            <span className="text-[14px] text-[#868685]">
              {state.settings.financialYear} {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={state.settings.financialYear}
          onValueChange={handleFinancialYearChange}
        >
          <SelectTrigger
            className="h-9 w-auto min-w-[170px] rounded-xl border-[rgba(14,15,12,0.12)] bg-white px-3 text-[13px] dark:border-[rgba(255,255,255,0.1)] dark:bg-[#1a1b18]"
            aria-label="Select financial year"
          >
            <span>
              {FINANCIAL_YEARS.find(
                (f) => f.value === state.settings.financialYear
              )?.label ?? state.settings.financialYear}
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

        <motion.button
          whileTap={{ rotate: 180, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          onClick={handleThemeToggle}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#454745] transition-colors hover:bg-[#f4f5f2] dark:text-[#868685] dark:hover:bg-white/5"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </motion.button>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="hidden sm:block"
        >
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#9fe870] px-4 py-2 text-[14px] font-semibold text-[#163300] transition-shadow hover:shadow-[0_4px_20px_rgba(159,232,112,0.3)]"
            aria-label="Add expense"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </Link>
        </motion.div>

        {!supabaseEnabled ? (
          <Badge
            variant="secondary"
            className="h-8 gap-1.5 px-2.5 text-[10px] font-normal"
            title="Data stored in this browser only."
          >
            <HardDrive className="h-3 w-3" aria-hidden />
            Local
          </Badge>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f4f5f2] dark:hover:bg-white/5"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[#e2f6d5] text-[10px] font-medium text-[#163300] dark:bg-[#163300]/20 dark:text-[#9fe870]">
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
