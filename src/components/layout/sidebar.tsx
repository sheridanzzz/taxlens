"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Clock3,
  Package,
  Building2,
  CandlestickChart,
  FileBarChart2,
  MessageCircleQuestion,
  ScanLine,
  Settings,
  X,
  LogOut,
} from "lucide-react";
import { LedgrLogo } from "@/components/LedgrLogo";
import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { useLaunchers } from "./app-shell";
import { formatCurrency } from "@/lib/tax-calculator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: typeof ScanLine }[];
}[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/wfh", label: "WFH hours", icon: Clock3 },
      { href: "/assets", label: "Assets", icon: Package },
      { href: "/rental", label: "Rental property", icon: Building2 },
      { href: "/investments", label: "Crypto & shares", icon: CandlestickChart },
    ],
  },
  {
    label: "Tax tools",
    items: [
      { href: "/reports", label: "Reports", icon: FileBarChart2 },
      { href: "/ask", label: "Ask a question", icon: MessageCircleQuestion },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar = ({ open, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const { state, summary } = useTax();
  const { cloudEnabled, user, signOut } = useAuth();
  const { openScanner } = useLaunchers();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const content = (
    <>
        <div className="flex h-[4.5rem] items-center justify-between px-6">
          <LedgrLogo size="lg" href="/dashboard" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav
          className="flex flex-1 flex-col overflow-y-auto px-3 py-4"
          aria-label="Main navigation"
        >
          {/* an action, not a destination — it opens in place, wherever you are */}
          <button
            onClick={() => {
              onClose();
              openScanner();
            }}
            className="btn-press mb-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-4 text-[15px] font-extrabold text-plum shadow-[3px_3px_0_var(--color-plum)] transition-colors"
            aria-label="Scan receipt"
          >
            <ScanLine className="h-[18px] w-[18px]" strokeWidth={2.2} />
            <span>Scan a receipt</span>
          </button>

          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? "mt-5" : ""}>
              <div className="eyebrow px-4 pb-2">{group.label}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex min-h-10 items-center gap-3 rounded-full px-4 text-[15px] font-semibold transition-colors",
                        active
                          ? "bg-plum text-white"
                          : "text-foreground/80 hover:bg-surface-2 hover:text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn("h-[18px] w-[18px]", active && "text-butter")}
                        strokeWidth={2}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3">
          {cloudEnabled && user && (
            <div className="mb-3 flex items-center gap-2 px-1 sm:hidden">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user.email}</span>
              <button onClick={signOut} className="flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-bold text-plum hover:bg-surface-2"><LogOut className="h-4 w-4" /> Sign out</button>
            </div>
          )}
          <div className="rounded-[22px] bg-plum p-4 text-white">
            <div className="text-[13px] font-bold text-butter">
              Est. tax savings · FY {state.settings.financialYear}
            </div>
            <div className="mt-1 font-serif text-3xl font-black tabular">
              {formatCurrency(summary.estimatedTaxSaved)}
            </div>
            <div className="mt-1 text-xs font-medium text-lav">
              {cloudEnabled && user
                ? "Synced to your account"
                : "Saved in this browser"}
            </div>
          </div>
        </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-[16.5rem] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">{content}</aside>
      <Sheet open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
        <SheetContent side="left" showCloseButton={false} className="gap-0 bg-sidebar data-[side=left]:w-[18rem] max-w-[88vw]" finalFocus={() => document.getElementById("sidebar-toggle")}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate your workspace and tax tools.</SheetDescription>
          {content}
        </SheetContent>
      </Sheet>
    </>
  );
};
