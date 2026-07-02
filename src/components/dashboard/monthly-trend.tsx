"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { formatCurrency, getMonthlyDeductionTotals } from "@/lib/tax-calculator";
import { cardHover } from "@/lib/animations";

export const MonthlyTrend = () => {
  const { state } = useTax();
  const prefersReduced = useReducedMotion();

  const months = getMonthlyDeductionTotals(
    state.expenses,
    state.assets,
    state.wfhEntries,
    state.settings.wfhMethod,
    state.settings.financialYear
  );
  const max = Math.max(...months.map((m) => m.amount));

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
          Add expenses, assets or WFH hours to see your monthly trend
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-12 items-end gap-1.5 sm:gap-2">
          {months.map((m, i) => (
            <div key={m.key} className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-24 w-full items-end"
                title={`${m.month}: ${formatCurrency(m.amount)}`}
              >
                <motion.div
                  initial={prefersReduced ? false : { height: 0 }}
                  animate={{ height: `${Math.max((m.amount / max) * 100, m.amount > 0 ? 4 : 0)}%` }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.5, ease: "easeOut" }}
                  className="w-full rounded-t-[3px] bg-primary dark:bg-primary"
                  style={{ minHeight: m.amount > 0 ? 2 : 0 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {m.month}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
