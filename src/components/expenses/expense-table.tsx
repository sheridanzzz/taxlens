"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, Receipt, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ledgr/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTax } from "@/context/tax-context";
import { neonGetExpenseReceipt } from "@/lib/storage-actions";
import { formatCurrency } from "@/lib/tax-calculator";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { isAiScanned } from "@/lib/utils";
import type { Expense } from "@/lib/types";

interface ExpenseTableProps {
  onEdit: (expense: Expense) => void;
  initialSearch?: string;
}

export const ExpenseTable = ({ onEdit, initialSearch = "" }: ExpenseTableProps) => {
  const { state, removeExpense } = useTax();
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // header search lands after mount via ?q= — adopt it when it arrives
  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  const categories = Object.entries(EXPENSE_CATEGORIES);

  const filtered = state.expenses
    .filter((e) => {
      const matchesSearch = e.description
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await removeExpense(deleteId);
      setDeleteId(null);
    }
  };

  const statusFor = (e: Expense) => {
    if (e.claimType === "depreciation")
      return { label: "Depreciate", tone: "muted" as const };
    if (e.workUsePercent < 100)
      return { label: `Apportioned ${e.workUsePercent}%`, tone: "positive" as const };
    return { label: "Deductible", tone: "positive" as const };
  };

  return (
    <div className="surface p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-gold/60"
            aria-label="Search expenses"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`h-9 rounded-md border px-3 text-sm ${
              categoryFilter === "all"
                ? "border-gold/60 text-gold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Show all categories"
          >
            All
          </button>
          {categories.map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`h-9 rounded-md border px-3 text-sm ${
                categoryFilter === key
                  ? "border-gold/60 text-gold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              aria-label={`Filter by ${cat.label}`}
            >
              {cat.label.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] text-muted-foreground">
            No expenses match your filters
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-border">
                <th className="py-3 text-left font-normal">Date</th>
                <th className="py-3 text-left font-normal">Description</th>
                <th className="py-3 text-left font-normal">Category</th>
                <th className="py-3 text-left font-normal">Status</th>
                <th className="py-3 text-right font-normal">Amount</th>
                <th className="py-3 text-right font-normal">Claimable</th>
                <th className="py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((expense) => {
                const status = statusFor(expense);
                return (
                  <tr
                    key={expense.id}
                    className="border-b border-border hover:bg-surface-2/40"
                  >
                    <td className="whitespace-nowrap py-3 tabular text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[220px] truncate">
                          {expense.description}
                        </span>
                        {isAiScanned(expense) && (
                          <span title="AI scanned">
                            <Sparkles className="h-3 w-3 text-gold" />
                          </span>
                        )}
                        {(expense.receiptDataUrl || expense.hasReceipt) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={async () =>
                              setReceiptUrl(
                                expense.receiptDataUrl ??
                                  (await neonGetExpenseReceipt(expense.id))
                              )
                            }
                            aria-label="View receipt"
                          >
                            <Receipt className="h-3.5 w-3.5 text-gold" />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {EXPENSE_CATEGORIES[expense.category]?.label
                        .split(" ")
                        .slice(0, 2)
                        .join(" ")}
                    </td>
                    <td className="py-3">
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </td>
                    <td className="py-3 text-right font-mono tabular text-muted-foreground">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="py-3 text-right font-mono tabular">
                      {formatCurrency(expense.claimableAmount)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(expense)}
                          aria-label={`Edit ${expense.description}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(expense.id)}
                          aria-label={`Delete ${expense.description}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The expense will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!receiptUrl}
        onOpenChange={(open) => !open && setReceiptUrl(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptUrl && (
            <img
              src={receiptUrl}
              alt="Receipt"
              className="w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
