"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Camera } from "lucide-react";
import { motion } from "motion/react";
import { Section, Kpi } from "@/components/ledgr/primitives";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { useLaunchers } from "@/components/layout/app-shell";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { fadeInUp } from "@/lib/animations";
import { isAiScanned } from "@/lib/utils";
import type { Expense } from "@/lib/types";

const ExpensesInner = () => {
  const { state, summary } = useTax();
  const { openScanner, openExpenseForm } = useLaunchers();
  // ?q= is a real navigation (header search); the scan/add launchers are not —
  // those open the shell's dialogs in place.
  const initialSearch = useSearchParams().get("q") ?? "";
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
  };

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const scanned = state.expenses.filter(isAiScanned).length;
  const depreciating = state.expenses.filter((e) => e.claimType === "depreciation").length;
  const avg =
    state.expenses.length > 0
      ? state.expenses.reduce((s, e) => s + e.amount, 0) / state.expenses.length
      : 0;

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Section
        title="Expenses"
        description="Everything you’ve bought for work this year. Scan it, check it, done."
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={openScanner}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Scan receipt with AI"
            >
              <Camera className="h-4 w-4" /> Scan receipt
            </button>
            <button
              onClick={openExpenseForm}
              className="btn-press inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              aria-label="Add new expense"
            >
              <Plus className="h-4 w-4" /> Add expense
            </button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi
          label="Claimable YTD"
          value={formatCurrency(summary.totalFullClaims)}
          hint={`${state.expenses.length} recorded`}
          positive={summary.totalFullClaims > 0}
        />
        <Kpi label="AI-scanned" value={`${scanned}`} hint="receipts on file" />
        <Kpi label="Depreciating" value={`${depreciating}`} hint="claimed over time" />
        <Kpi label="Avg receipt" value={formatCurrency(avg)} />
      </div>

      {state.expenses.length === 0 ? (
        <div className="surface px-5 py-10 text-center sm:p-12">
          <p className="font-serif text-2xl">
            No expenses in FY {state.settings.financialYear} yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">
            Snap a receipt and the AI fills in the details, or add one manually.
            Every expense feeds your refund estimate.
          </p>
          <div className="mx-auto mt-6 grid max-w-sm gap-2 sm:grid-cols-2">
            <button
              onClick={openScanner}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Camera className="h-4 w-4" /> Scan a receipt
            </button>
            <button
              onClick={openExpenseForm}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add manually
            </button>
          </div>
        </div>
      ) : (
        <ExpenseTable
          key={initialSearch}
          onEdit={handleEdit}
          initialSearch={initialSearch}
        />
      )}

      {/* add/scan live in the shell — this one only ever edits */}
      <ExpenseForm
        open={!!editingExpense}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        editingExpense={editingExpense}
      />
    </motion.div>
  );
};

// useSearchParams needs a Suspense boundary for static prerender
const ExpensesPage = () => (
  <Suspense>
    <ExpensesInner />
  </Suspense>
);

export default ExpensesPage;
