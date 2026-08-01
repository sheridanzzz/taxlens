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
  Sparkles,
  X,
} from "lucide-react";
import { LedgrLogo } from "@/components/LedgrLogo";
import { useTax } from "@/context/tax-context";
import { useAuth } from "@/context/auth-context";
import { useLaunchers } from "./app-shell";
import { formatCurrency } from "@/lib/tax-calculator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: typeof ScanLine; ai?: boolean }[];
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
      { href: "/ask", label: "Ask AI", icon: MessageCircleQuestion, ai: true },
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
  const { cloudEnabled, user } = useAuth();
  const { openScanner } = useLaunchers();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[88vw] shrink-0 flex-col border-r border-border bg-sidebar shadow-2xl transition-transform duration-200 lg:static lg:w-[17rem] lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[4.5rem] items-center justify-between border-b border-border px-6">
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
          <div className="eyebrow px-3 pb-2">
            Active ledger · FY {state.settings.financialYear}
          </div>

          {/* an action, not a destination — it opens in place, wherever you are */}
          <button
            onClick={() => {
              onClose();
              openScanner();
            }}
            className="btn-press mb-5 flex min-h-11 items-center gap-3 rounded-lg border border-gold/40 bg-gold/10 px-3 text-sm font-medium text-gold transition-colors hover:bg-gold/15"
            aria-label="Scan receipt with AI"
          >
            <ScanLine className="h-4 w-4" strokeWidth={1.5} />
            <span>Scan receipt</span>
            <Sparkles className="ml-auto h-3 w-3 text-gold/70" />
          </button>

          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? "mt-5" : ""}>
              <div className="eyebrow px-3 pb-2">{group.label}</div>
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
                        "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn("h-4 w-4", item.ai && "text-gold")}
                        strokeWidth={1.5}
                      />
                      <span>{item.label}</span>
                      {item.ai && !active && (
                        <Sparkles className="ml-auto h-3 w-3 text-gold/70" />
                      )}
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg border border-border bg-surface-2/70 p-3.5">
            <div className="eyebrow">Est. tax saved</div>
            <div className="mt-1 font-serif text-2xl tabular">
              {formatCurrency(summary.estimatedTaxSaved)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {cloudEnabled && user
                ? "Synced to your account"
                : "Local · stays in browser"}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
