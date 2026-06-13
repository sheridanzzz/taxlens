"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTax } from "@/context/tax-context";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { staggerContainer, staggerItem } from "@/lib/animations";

export const SummaryCards = () => {
  const { summary, state } = useTax();
  const prefersReduced = useReducedMotion();

  const metrics = [
    {
      label: "Taxable income",
      value: summary.taxableIncome,
      hint:
        state.settings.annualIncome > 0
          ? "After your deductions"
          : "Set income in Settings",
      green: false,
    },
    {
      label: "Total deductions",
      value: summary.totalDeductions,
      hint: "Claimable this financial year",
      green: true,
    },
    {
      label: "Estimated tax",
      value: summary.taxPayable,
      hint: "With deductions applied",
      green: false,
    },
    {
      label: "Tax saved",
      value: summary.estimatedTaxSaved,
      hint:
        state.settings.annualIncome > 0
          ? "Approx. marginal rate"
          : "Add income to estimate",
      green: true,
    },
  ];

  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      variants={staggerContainer}
      initial={prefersReduced ? false : "initial"}
      animate="animate"
    >
      {metrics.map((m) => (
        <motion.div
          key={m.label}
          variants={staggerItem}
          whileHover={
            prefersReduced
              ? undefined
              : { y: -2, boxShadow: "0 8px 30px rgba(14,15,12,0.06)" }
          }
          transition={{ duration: 0.2 }}
          className="rounded-xl bg-secondary p-4 dark:bg-[#141512]"
        >
          <p className="text-[12px] font-medium text-muted-foreground">{m.label}</p>
          <p
            className={`mt-1 text-[26px] font-semibold tracking-[-0.5px] ${
              m.green
                ? "text-foreground dark:text-primary"
                : "text-foreground dark:text-foreground"
            }`}
          >
            <AnimatedNumber value={m.value} />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{m.hint}</p>
        </motion.div>
      ))}
    </motion.div>
  );
};
