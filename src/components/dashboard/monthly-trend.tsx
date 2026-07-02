"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { WFH_FIXED_RATE_PER_HOUR } from "@/lib/constants";
import { cardHover } from "@/lib/animations";

const MONTH_LABELS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export const MonthlyTrend = () => {
  const { state } = useTax();
  const prefersReduced = useReducedMotion();
  const startYear = Number(state.settings.financialYear.slice(0, 4));

  // FY runs Jul..Jun, so month 7-12 belong to startYear, 1-6 to the next
  const keys = MONTH_LABELS.map((_, i) => {
    const m = ((i + 6) % 12) + 1;
    const y = m >= 7 ? startYear : startYear + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });

  const totals = new Map(keys.map((k) => [k, 0]));
  for (const e of state.expenses) {
    if (e.claimType !== "full") continue;
    const k = e.date.slice(0, 7);
    if (totals.has(k)) totals.set(k, totals.get(k)! + e.claimableAmount);
  }
  if (state.settings.wfhMethod === "fixed_rate") {
    for (const w of state.wfhEntries) {
      const k = w.date.slice(0, 7);
      if (totals.has(k))
        totals.set(k, totals.get(k)! + w.hours * WFH_FIXED_RATE_PER_HOUR);
    }
  }

  const values = keys.map((k) => totals.get(k)!);
  const max = Math.max(...values);

  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card"
      {...(prefersReduced ? {} : cardHover)}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-foreground dark:text-foreground">
          Deductions by month
        </p>
        {max > 0 && (
          <p className="text-[11px] text-muted-foreground">
            FY {state.settings.financialYear}
          </p>
        )}
      </div>

      {max === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Add expenses or WFH hours to see your monthly trend
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-12 items-end gap-1.5 sm:gap-2">
          {values.map((v, i) => (
            <div key={keys[i]} className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-24 w-full items-end"
                title={`${MONTH_LABELS[i]}: ${formatCurrency(v)}`}
              >
                <motion.div
                  initial={prefersReduced ? false : { height: 0 }}
                  animate={{ height: `${max > 0 ? Math.max((v / max) * 100, v > 0 ? 4 : 0) : 0}%` }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.5, ease: "easeOut" }}
                  className="w-full rounded-t-[3px] bg-primary dark:bg-primary"
                  style={{ minHeight: v > 0 ? 2 : 0 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {MONTH_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
