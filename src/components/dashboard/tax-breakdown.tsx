"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { calculateCurrentYearDepreciation } from "@/lib/depreciation";
import { EXPENSE_CATEGORIES, ASSET_EFFECTIVE_LIVES } from "@/lib/constants";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cardHover } from "@/lib/animations";

export const TaxBreakdown = () => {
  const { summary, state } = useTax();
  const fy = state.settings.financialYear;
  const prefersReduced = useReducedMotion();

  const deductionLines = useMemo(() => {
    const lines: { label: string; amount: number; detail: string }[] = [];

    for (const e of state.expenses) {
      if (e.claimableAmount > 0) {
        lines.push({
          label: e.description,
          amount: e.claimableAmount,
          detail: `Full claim · ${EXPENSE_CATEGORIES[e.category]?.label.split(" ").slice(0, 2).join(" ")}`,
        });
      }
    }

    for (const a of state.assets) {
      const yearDed = calculateCurrentYearDepreciation(a, fy);
      if (yearDed > 0) {
        const method = a.depreciationMethod === "diminishing" ? "DV" : "PC";
        lines.push({
          label: a.name,
          amount: yearDed,
          detail: `Depreciation (${method}) · ${ASSET_EFFECTIVE_LIVES[a.assetType]?.label.split(" ").slice(0, 2).join(" ")}`,
        });
      }
    }

    if (summary.totalWfhDeduction > 0) {
      lines.push({
        label: "Work from home",
        amount: summary.totalWfhDeduction,
        detail:
          state.settings.wfhMethod === "fixed_rate"
            ? "Fixed rate (67c/hr)"
            : "Actual cost method",
      });
    }

    return lines.sort((a, b) => b.amount - a.amount);
  }, [state.expenses, state.assets, state.settings.wfhMethod, summary.totalWfhDeduction, fy]);

  if (state.settings.annualIncome === 0) {
    return (
      <motion.div
        className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card"
        {...(prefersReduced ? {} : cardHover)}
      >
        <p className="text-sm font-medium text-foreground dark:text-foreground">
          Tax impact
        </p>
        <p className="mt-4 text-[13px] text-muted-foreground">
          <Link
            href="/settings"
            className="text-foreground underline underline-offset-2 dark:text-primary"
          >
            Set your income
          </Link>{" "}
          to calculate
        </p>
      </motion.div>
    );
  }

  const savingsPercent =
    summary.taxPayableWithoutDeductions > 0
      ? (summary.estimatedTaxSaved / summary.taxPayableWithoutDeductions) * 100
      : 0;

  const marginalRate =
    summary.totalDeductions > 0 && summary.estimatedTaxSaved > 0
      ? Math.round((summary.estimatedTaxSaved / summary.totalDeductions) * 100)
      : 0;

  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-5 dark:border-border dark:bg-card"
      {...(prefersReduced ? {} : cardHover)}
    >
      <p className="text-sm font-medium text-foreground dark:text-foreground">
        Tax impact
      </p>

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Tax without deductions</span>
            <span className="stat-number text-sm text-muted-foreground line-through decoration-muted-foreground/30">
              {formatCurrency(summary.taxPayableWithoutDeductions)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Tax with deductions</span>
            <span className="stat-number text-sm font-medium text-foreground dark:text-foreground">
              {formatCurrency(summary.taxPayable)}
            </span>
          </div>
        </div>

        <div className="h-px bg-border dark:bg-[rgba(255,255,255,0.06)]" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground dark:text-foreground">
            You save
          </span>
          <span className="stat-number text-xl font-semibold text-foreground dark:text-primary">
            <AnimatedNumber value={summary.estimatedTaxSaved} />
          </span>
        </div>

        {deductionLines.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-ink-soft dark:hover:text-[#a3a5a0]">
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
              How your {formatCurrency(summary.estimatedTaxSaved)} saving breaks down
            </summary>
            <div className="mt-2 space-y-1.5 pl-0.5">
              {deductionLines.map((line, i) => {
                const taxSaved = line.amount * (marginalRate / 100);
                return (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-ink-soft dark:text-muted-foreground">
                        {line.label}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{line.detail}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="stat-number text-[11px] font-medium text-foreground dark:text-primary">
                        −{formatCurrency(taxSaved)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        on {formatCurrency(line.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="mt-1 rounded-lg bg-secondary px-2 py-1.5 dark:bg-white/5">
                <p className="text-[10px] text-muted-foreground">
                  Your marginal rate is ~{marginalRate}% (bracket + Medicare levy). Every $1 you deduct saves you ~${(marginalRate / 100).toFixed(2)} in tax.
                </p>
              </div>
            </div>
          </details>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Savings ratio</span>
            <span className="stat-number">{savingsPercent.toFixed(1)}%</span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-secondary dark:bg-white/5">
            <motion.div
              initial={prefersReduced ? false : { width: 0 }}
              animate={{ width: `${Math.min(savingsPercent, 100)}%` }}
              transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
