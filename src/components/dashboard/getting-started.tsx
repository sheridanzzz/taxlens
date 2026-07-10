"use client";

import Link from "next/link";
import { ScanLine, Plus, Home } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { cardHover } from "@/lib/animations";

const ACTIONS = [
  {
    href: "/expenses?scan=1",
    icon: ScanLine,
    title: "Scan a receipt",
    detail: "AI reads it and suggests the claim",
  },
  {
    href: "/expenses?add=1",
    icon: Plus,
    title: "Add an expense",
    detail: "Enter a deduction manually",
  },
  {
    href: "/wfh",
    icon: Home,
    title: "Log WFH hours",
    detail: "67c per hour, bulk-log a whole period",
  },
] as const;

// Shown when the selected FY has no data — covers both the first-run journey
// and the "switched FY and everything vanished" confusion.
export const GettingStarted = () => {
  const { state } = useTax();
  const prefersReduced = useReducedMotion();

  const empty =
    state.expenses.length === 0 &&
    state.assets.length === 0 &&
    state.wfhEntries.length === 0;
  if (!empty) return null;

  return (
    <motion.div
      className="surface p-5"
      {...(prefersReduced ? {} : cardHover)}
    >
      <div className="eyebrow">
        <span className="text-gold">•</span> Getting started
      </div>
      <p className="mt-1 font-serif text-2xl">
        Nothing in FY {state.settings.financialYear} yet
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Start with whichever is closest to hand — everything feeds your refund
        estimate.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:border-gold/60"
          >
            <a.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div>
              <p className="text-xs font-medium text-foreground">{a.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</p>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
};
