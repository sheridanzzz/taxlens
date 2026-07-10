"use client";

import { useState, useEffect } from "react";
import { Plus, Camera } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
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

  // ponytail: window.location over useSearchParams — no Suspense boundary needed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("scan") === "1") setScannerOpen(true);
    else if (params.get("add") === "1") setFormOpen(true);
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
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {state.expenses.length} recorded &middot;{" "}
            <span className="stat-number font-medium text-foreground dark:text-foreground">
              {formatCurrency(summary.totalFullClaims)}
            </span>{" "}
            claimable this year
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan receipt with AI"
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Scan receipt
          </Button>
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
            aria-label="Add new expense"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add expense
          </Button>
        </div>
      </div>

      {state.expenses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center dark:border-border dark:bg-card">
          <p className="text-sm font-medium text-foreground dark:text-foreground">
            No expenses in FY {state.settings.financialYear} yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            Snap a receipt and the AI fills in the details, or add one
            manually. Every expense feeds your refund estimate.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => setScannerOpen(true)}>
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Scan a receipt
            </Button>
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add manually
            </Button>
          </div>
        </div>
      ) : (
        <ExpenseTable onEdit={handleEdit} />
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
