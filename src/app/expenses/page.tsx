"use client";

import { useState } from "react";
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
          <p className="text-[13px] text-[#868685]">
            {state.expenses.length} recorded &middot;{" "}
            <span className="stat-number font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
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

      <ExpenseTable onEdit={handleEdit} />

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
