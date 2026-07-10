"use client";

import { useState, useEffect } from "react";
import { Plus, Camera } from "lucide-react";
import { motion } from "motion/react";
import { Section, Kpi } from "@/components/ledgr/primitives";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ReceiptScanner } from "@/components/expenses/receipt-scanner";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { fadeInUp } from "@/lib/animations";
import type { Expense } from "@/lib/types";

const ExpensesPage = () => {
  const { state, summary } = useTax();
  const [formOpen, setFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [initialSearch, setInitialSearch] = useState("");

  // ponytail: window.location over useSearchParams — no Suspense boundary needed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("scan") === "1") setScannerOpen(true);
    else if (params.get("add") === "1") setFormOpen(true);
    const q = params.get("q");
    if (q) setInitialSearch(q);
  }, []);

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingExpense(null);
  };

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const scanned = state.expenses.filter((e) => e.receiptDataUrl).length;
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
        eyebrow="Expenses"
        title="Every receipt, on the record."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
              aria-label="Scan receipt with AI"
            >
              <Camera className="h-4 w-4" /> Scan receipt
            </button>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
              aria-label="Add new expense"
            >
              <Plus className="h-4 w-4" /> Add expense
            </button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        <div className="surface p-8 text-center">
          <p className="font-serif text-2xl">
            No expenses in FY {state.settings.financialYear} yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">
            Snap a receipt and the AI fills in the details, or add one manually.
            Every expense feeds your refund estimate.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
            >
              <Camera className="h-4 w-4" /> Scan a receipt
            </button>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add manually
            </button>
          </div>
        </div>
      ) : (
        <ExpenseTable onEdit={handleEdit} initialSearch={initialSearch} />
      )}

      <ExpenseForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        editingExpense={editingExpense}
      />

      <ReceiptScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onExpenseCreated={() => {}}
      />
    </motion.div>
  );
};

export default ExpensesPage;
