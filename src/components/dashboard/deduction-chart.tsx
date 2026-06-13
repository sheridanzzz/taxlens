"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { getCategoryBreakdown, formatCurrency } from "@/lib/tax-calculator";
import { cardHover } from "@/lib/animations";

const NAVY_SHADES = [
  "#0f1b3d",
  "#1e3a5f",
  "#3b4660",
  "#5b6478",
  "#9aa5bd",
  "#b6becf",
  "#e7ecf5",
];

export const DeductionChart = () => {
  const { state } = useTax();
  const prefersReduced = useReducedMotion();
  const breakdown = getCategoryBreakdown(
    state.expenses,
    state.assets,
    state.settings.financialYear
  );

  if (breakdown.length === 0) {
    return (
      <motion.div
        className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card"
        {...(prefersReduced ? {} : cardHover)}
      >
        <p className="text-sm font-medium text-foreground dark:text-foreground">
          By category
        </p>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Add expenses to see categories
        </p>
      </motion.div>
    );
  }

  const total = breakdown.reduce((s, b) => s + b.amount, 0);

  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card"
      {...(prefersReduced ? {} : cardHover)}
    >
      <p className="mb-4 text-sm font-medium text-foreground dark:text-foreground">
        By category
      </p>

      <ul className="space-y-4">
        {breakdown.map((b, index) => {
          const pct = total > 0 ? Math.round((b.amount / total) * 100) : 0;
          const label =
            b.label.length > 28 ? `${b.label.slice(0, 26)}…` : b.label;
          const color = NAVY_SHADES[index % NAVY_SHADES.length];

          return (
            <li key={b.category}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground dark:text-foreground">
                  {label}
                </span>
                <span className="stat-number shrink-0 text-sm font-medium tabular-nums text-foreground dark:text-primary">
                  {formatCurrency(b.amount)}
                </span>
              </div>
              <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-secondary dark:bg-white/5">
                <motion.div
                  initial={prefersReduced ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    delay: 0.4 + index * 0.1,
                    duration: 0.6,
                    ease: "easeOut",
                  }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {b.count} item{b.count === 1 ? "" : "s"}
                </span>
                <span className="stat-number">{pct}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
};
