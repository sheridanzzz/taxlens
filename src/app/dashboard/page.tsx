"use client";

import { motion } from "motion/react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { DeductionChart } from "@/components/dashboard/deduction-chart";
import { MonthlyTrend } from "@/components/dashboard/monthly-trend";
import { DeductionPace } from "@/components/dashboard/deduction-pace";
import { Onboarding } from "@/components/onboarding";
import { RecentExpenses } from "@/components/dashboard/recent-expenses";
import { TaxBreakdown } from "@/components/dashboard/tax-breakdown";
import { useTax } from "@/context/tax-context";
import { fadeInUp } from "@/lib/animations";

const DashboardPage = () => {
  const { state } = useTax();

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-6"
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Onboarding />

      <SummaryCards />

      <div className="grid gap-4 lg:grid-cols-2">
        <DeductionChart />
        <TaxBreakdown />
      </div>

      <DeductionPace />

      <MonthlyTrend />

      <RecentExpenses />
    </motion.div>
  );
};

export default DashboardPage;
