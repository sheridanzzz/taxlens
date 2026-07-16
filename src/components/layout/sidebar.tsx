"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Clock3,
  Package,
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
import { formatCurrency } from "@/lib/tax-calculator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV: { href: string; label: string; icon: typeof ScanLine; ai?: boolean }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/wfh", label: "WFH hours", icon: Clock3 },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/expenses?scan=1", label: "AI scan", icon: ScanLine, ai: true },
  { href: "/ask", label: "Ask AI", icon: MessageCircleQuestion, ai: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar = ({ open, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const { state, summary } = useTax();
  const { cloudEnabled, user } = useAuth();

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
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <LedgrLogo size="lg" />
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
          className="flex flex-1 flex-col gap-1 px-3 py-4"
          aria-label="Main navigation"
        >
          <div className="eyebrow px-3 pb-2">FY {state.settings.financialYear}</div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4", item.ai && "text-gold")} strokeWidth={1.5} />
                <span>{item.label}</span>
                {item.ai && !active && <Sparkles className="ml-auto h-3 w-3 text-gold/70" />}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-md bg-surface-2 p-3">
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
