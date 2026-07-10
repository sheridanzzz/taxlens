"use client";

import { useState } from "react";
import { Pencil, Trash2, Receipt, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatCurrency } from "@/lib/tax-calculator";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { Expense, ExpenseCategory } from "@/lib/types";

interface ExpenseTableProps {
  onEdit: (expense: Expense) => void;
}

export const ExpenseTable = ({ onEdit }: ExpenseTableProps) => {
  const { state, removeExpense } = useTax();
  const prefersReduced = useReducedMotion();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search expenses"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === "all"
                ? "bg-mint text-foreground"
                : "bg-[rgba(22,51,0,0.06)] text-ink-soft hover:bg-[rgba(22,51,0,0.1)] dark:bg-white/5 dark:text-muted-foreground"
            }`}
            aria-label="Show all categories"
            tabIndex={0}
          >
            All
          </button>
          {categories.map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === key
                  ? "bg-mint text-foreground"
                  : "bg-[rgba(22,51,0,0.06)] text-ink-soft hover:bg-[rgba(22,51,0,0.1)] dark:bg-white/5 dark:text-muted-foreground"
              }`}
              aria-label={`Filter by ${cat.label}`}
              tabIndex={0}
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
        <div className="overflow-x-auto rounded-xl border border-border bg-card dark:border-border dark:bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Claimable</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody
              variants={staggerContainer}
              initial={prefersReduced ? false : "initial"}
              animate="animate"
            >
              {filtered.map((expense) => (
                <motion.tr
                  key={expense.id}
                  variants={staggerItem}
                  className="border-b border-border transition-colors hover:bg-background dark:border-[rgba(255,255,255,0.04)] dark:hover:bg-secondary"
                >
                  <TableCell className="whitespace-nowrap text-sm text-ink-soft dark:text-muted-foreground">
                    {new Date(expense.date).toLocaleDateString("en-AU")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="max-w-[200px] truncate text-sm font-medium text-foreground dark:text-foreground">
                        {expense.description}
                      </span>
                      {expense.receiptDataUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setReceiptUrl(expense.receiptDataUrl || null)
                          }
                          aria-label="View receipt"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-[rgba(22,51,0,0.06)] text-xs text-ink-soft dark:bg-white/5 dark:text-muted-foreground"
                    >
                      {EXPENSE_CATEGORIES[expense.category]?.label
                        .split(" ")
                        .slice(0, 2)
                        .join(" ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-ink-soft dark:text-muted-foreground">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-foreground dark:text-foreground">
                    {formatCurrency(expense.claimableAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-xs ${
                        expense.claimType === "full"
                          ? "bg-mint text-foreground"
                          : "bg-[rgba(22,51,0,0.06)] text-ink-soft dark:bg-white/5 dark:text-muted-foreground"
                      }`}
                    >
                      {expense.claimType === "full" ? "Full" : "Deprec."}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </motion.tr>
              ))}
            </motion.tbody>
          </Table>
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
