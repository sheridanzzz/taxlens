"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { LedgrLogo } from "@/components/LedgrLogo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  IconGrid,
  IconReceipt,
  IconWave,
  IconHome,
  IconDoc,
  IconCog,
} from "@/components/dashboard/icons";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <IconGrid /> }],
  },
  {
    label: "Track",
    items: [
      { href: "/expenses", label: "Expenses", icon: <IconReceipt /> },
      { href: "/assets", label: "Depreciation", icon: <IconWave /> },
      { href: "/wfh", label: "Work From Home", icon: <IconHome /> },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/reports", label: "Reports", icon: <IconDoc /> },
      { href: "/settings", label: "Settings", icon: <IconCog /> },
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

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

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
          "fixed inset-y-0 left-0 z-50 flex w-[260px] shrink-0 flex-col justify-between border-r border-border bg-card px-5 py-6 transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div>
          <div className="flex items-center justify-between px-2 pb-8">
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

          <nav className="flex flex-col gap-7" aria-label="Main navigation">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {section.label}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const idx = globalIndex++;

                    return (
                      <li key={item.href}>
                        <motion.div
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
                              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/85 hover:bg-secondary"
                            )}
                            aria-current={active ? "page" : undefined}
                          >
                            <span className={active ? "text-primary-foreground" : "text-muted-foreground"}>
                              {item.icon}
                            </span>
                            {item.label}
                          </Link>
                        </motion.div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="ring-card rounded-2xl bg-background p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            FY 2025-26
          </div>
          <div className="mt-1 text-[14px] font-semibold">67c/hr WFH &middot; Instant write-off</div>
          <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Local &middot; stays in browser
          </div>
        </div>
      </aside>
    </>
  );
};
