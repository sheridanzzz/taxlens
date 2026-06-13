"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { getCategoryBreakdown, formatCurrency } from "@/lib/tax-calculator";
import { cardHover } from "@/lib/animations";

const GREEN_SHADES = [
  "#9fe870",
  "#8DD85F",
  "#7BC84E",
  "#639922",
  "#3B6D11",
  "#27500A",
  "#163300",
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
        className="rounded-xl border border-[rgba(14,15,12,0.08)] bg-white p-5 dark:border-[rgba(159,232,112,0.08)] dark:bg-[#1a1b18]"
        {...(prefersReduced ? {} : cardHover)}
      >
        <p className="text-sm font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
          By category
        </p>
        <p className="mt-4 text-[13px] text-[#868685]">
          Add expenses to see categories
        </p>
      </motion.div>
    );
  }

  const total = breakdown.reduce((s, b) => s + b.amount, 0);

  return (
    <motion.div
      className="rounded-xl border border-[rgba(14,15,12,0.08)] bg-white p-5 dark:border-[rgba(159,232,112,0.08)] dark:bg-[#1a1b18]"
      {...(prefersReduced ? {} : cardHover)}
    >
      <p className="mb-4 text-sm font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
        By category
      </p>

      <ul className="space-y-4">
        {breakdown.map((b, index) => {
          const pct = total > 0 ? Math.round((b.amount / total) * 100) : 0;
          const label =
            b.label.length > 28 ? `${b.label.slice(0, 26)}…` : b.label;
          const color = GREEN_SHADES[index % GREEN_SHADES.length];

          return (
            <li key={b.category}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
                  {label}
                </span>
                <span className="stat-number shrink-0 text-sm font-medium tabular-nums text-[#163300] dark:text-[#9fe870]">
                  {formatCurrency(b.amount)}
                </span>
              </div>
              <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#f4f5f2] dark:bg-white/5">
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
              <div className="mt-1 flex justify-between text-[11px] text-[#868685]">
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
