"use client";

import { motion } from "motion/react";
import { WfhCalendar } from "@/components/wfh/wfh-calendar";
import { WfhCalculator } from "@/components/wfh/wfh-calculator";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import {
  calculateWfhDeductionFixedRate,
  calculateWfhDeductionActualCost,
} from "@/lib/tax-calculator";
import { fadeInUp } from "@/lib/animations";

const WfhPage = () => {
  const { state } = useTax();

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const activeDeduction =
    state.settings.wfhMethod === "fixed_rate"
      ? calculateWfhDeductionFixedRate(state.wfhEntries)
      : calculateWfhDeductionActualCost(state.wfhActualCosts);

  const methodLabel =
    state.settings.wfhMethod === "fixed_rate" ? "Fixed rate" : "Actual cost";

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-6"
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <div>
        <p className="text-[13px] text-muted-foreground">
          <span className="stat-number font-medium text-foreground dark:text-foreground">
            {formatCurrency(activeDeduction)}
          </span>{" "}
          total deduction via {methodLabel} method
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WfhCalendar />
        <WfhCalculator />
      </div>
    </motion.div>
  );
};

export default WfhPage;
