"use client";

import Link from "next/link";
import { ScanLine, Plus, Home } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useLaunchers } from "@/components/layout/app-shell";
import { useTax } from "@/context/tax-context";
import { cardHover } from "@/lib/animations";

const ACTIONS = [
  {
    tint: "bg-butter",
    action: "scan",
    icon: ScanLine,
    title: "Scan a receipt",
    detail: "AI reads it and suggests the claim",
  },
  {
    tint: "bg-mint",
    action: "add",
    icon: Plus,
    title: "Add an expense",
    detail: "Enter a deduction manually",
  },
  {
    tint: "bg-pink",
    href: "/wfh",
    icon: Home,
    title: "Log WFH hours",
    detail: "70c per hour, bulk-log a whole period",
  },
] as const;

// Shown when the selected FY has no data — covers both the first-run journey
// and the "switched FY and everything vanished" confusion.
export const GettingStarted = () => {
  const { state } = useTax();
  const { openScanner, openExpenseForm } = useLaunchers();
  const prefersReduced = useReducedMotion();

  const empty =
    state.expenses.length === 0 &&
    state.assets.length === 0 &&
    state.wfhEntries.length === 0;
  if (!empty) return null;

  return (
    <motion.div
      className="surface p-6"
      {...(prefersReduced ? {} : cardHover)}
    >
      <div className="eyebrow">Getting started</div>
      <p className="mt-1 font-serif text-3xl font-black text-plum">
        Your FY {state.settings.financialYear} pot is empty
      </p>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Start with whatever’s closest to hand — it all goes in the pot.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {ACTIONS.map((a) => {
          const className = `group flex items-center gap-3 rounded-[20px] p-4 text-left transition-transform hover:-translate-y-0.5 ${a.tint}`;
          const body = (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white">
                <a.icon className="h-5 w-5 text-plum" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[15px] font-extrabold text-plum">{a.title}</p>
                <p className="mt-0.5 text-[13px] font-medium text-plum/80">{a.detail}</p>
              </div>
            </>
          );
          return "href" in a ? (
            <Link key={a.title} href={a.href} className={className}>
              {body}
            </Link>
          ) : (
            <button
              key={a.title}
              onClick={a.action === "scan" ? openScanner : openExpenseForm}
              className={className}
            >
              {body}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};
