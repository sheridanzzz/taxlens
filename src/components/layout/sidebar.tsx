"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Home,
  TrendingDown,
  FileText,
  Settings,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { LedgrLogo } from "@/components/LedgrLogo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Track",
    items: [
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/assets", label: "Depreciation", icon: TrendingDown },
      { href: "/wfh", label: "Work From Home", icon: Home },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/reports", label: "Reports", icon: FileText },
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
  const prefersReduced = useReducedMotion();

  let globalIndex = 0;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-[rgba(14,15,12,0.08)] bg-white transition-transform duration-200 dark:border-[rgba(255,255,255,0.06)] dark:bg-[#0e0f0c] lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <LedgrLogo size="md" />
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
          className="flex-1 overflow-y-auto px-3 pt-1"
          aria-label="Main navigation"
        >
          {NAV_SECTIONS.map((section, sectionIdx) => (
            <div key={section.label}>
              <p
                className={cn(
                  "mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#868685]",
                  sectionIdx === 0 ? "mt-2" : "mt-5"
                )}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  const idx = globalIndex++;

                  return (
                    <motion.div
                      key={item.href}
                      initial={
                        prefersReduced
                          ? false
                          : { x: -20, opacity: 0 }
                      }
                      animate={{ x: 0, opacity: 1 }}
                      transition={{
                        delay: idx * 0.05,
                        duration: 0.3,
                        ease: "easeOut",
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] transition-colors",
                          isActive
                            ? "bg-[#e2f6d5] font-semibold text-[#163300] dark:bg-[#163300]/20 dark:text-[#9fe870]"
                            : "text-[#454745] hover:bg-[#f4f5f2] dark:text-[#868685] dark:hover:bg-white/5"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute bottom-0 left-0 top-0 w-[3px] rounded-r-full bg-[#9fe870]"
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30,
                            }}
                          />
                        )}
                        <Icon
                          className="h-[18px] w-[18px] shrink-0"
                          strokeWidth={1.75}
                        />
                        <span>{item.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-[rgba(14,15,12,0.08)] px-4 py-3 dark:border-[rgba(255,255,255,0.06)]">
          <p className="text-[12px] font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
            FY 2025-26
          </p>
          <p className="mt-0.5 text-[11px] text-[#868685]">
            67c/hr WFH &middot; Instant write-off
          </p>
        </div>
      </aside>
    </>
  );
};
