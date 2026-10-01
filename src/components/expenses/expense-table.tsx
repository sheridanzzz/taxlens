"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  Receipt,
  Search,
  ScanLine,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ledgr/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
import { useAsyncAction } from "@/hooks/use-async-action";
import { useTax } from "@/context/tax-context";
import { getExpenseReceipt } from "@/lib/storage";
import { formatCurrency, isCoveredByFixedRate } from "@/lib/tax-calculator";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { isAiScanned } from "@/lib/utils";
import type { Expense } from "@/lib/types";

interface ExpenseTableProps {
  onEdit: (expense: Expense) => void;
  initialSearch?: string;
}

type StatusFilter = "all" | "deductible" | "depreciating" | "personal";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "deductible", label: "Deductible" },
  { value: "depreciating", label: "Depreciating" },
  { value: "personal", label: "Personal" },
];

export const ExpenseTable = ({ onEdit, initialSearch = "" }: ExpenseTableProps) => {
  const { state, removeExpense } = useTax();
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const action = useAsyncAction();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const categories = Object.entries(EXPENSE_CATEGORIES);

  const filtered = state.expenses
    .filter((e) => {
      const query = search.trim().toLowerCase();
      const categoryLabel = EXPENSE_CATEGORIES[e.category]?.label ?? "";
      const matchesSearch =
        !query ||
        e.description.toLowerCase().includes(query) ||
        categoryLabel.toLowerCase().includes(query) ||
        e.notes?.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "all" || e.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "personal" && e.workUsePercent === 0) ||
        (statusFilter === "depreciating" && e.claimType === "depreciation") ||
        (statusFilter === "deductible" &&
          e.workUsePercent > 0 &&
          e.claimType !== "depreciation");
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleConfirmDelete = () => action.run(async () => {
    if (deleteId) {
      await removeExpense(deleteId);
      setDeleteId(null);
    }
  });

  const covered = (e: Expense) => isCoveredByFixedRate(e, state.settings.wfhMethod);
  const statusFor = (e: Expense) => {
    if (covered(e))
      return { label: "Covered by 70c rate", tone: "muted" as const };
    if (e.workUsePercent === 0)
      return { label: "Personal", tone: "muted" as const };
    if (e.claimType === "depreciation")
      return { label: "Depreciate", tone: "muted" as const };
    if (e.workUsePercent < 100)
      return { label: `Apportioned ${e.workUsePercent}%`, tone: "positive" as const };
    return { label: "Deductible", tone: "positive" as const };
  };

  const hasFilters =
    search.trim().length > 0 || categoryFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const openReceipt = (expense: Expense) => action.run(async () => {
    setReceiptUrl(
      expense.receiptDataUrl ?? (await getExpenseReceipt(expense.id))
    );
    if (!expense.receiptDataUrl && !expense.hasReceipt) throw new Error("Receipt not found.");
  });

  return (
    <div className="surface overflow-hidden">
      {!deleteId && action.error && <p role="alert" className="p-4 text-sm text-destructive">{action.error}</p>}
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search description or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-9 text-sm outline-none focus:border-gold/60"
            aria-label="Search expenses"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface-2 p-1"
          aria-label="Filter expenses by status"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`h-8 shrink-0 rounded-md px-3 text-xs transition-colors ${
                statusFilter === filter.value
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={statusFilter === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? "all")}>
          <SelectTrigger
            className="h-10 w-full rounded-lg border-border bg-surface-2 px-3 text-sm xl:w-52"
            aria-label="Filter by category"
          >
            <span className="flex items-center gap-2 truncate">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              {categoryFilter === "all"
                ? "All categories"
                : EXPENSE_CATEGORIES[categoryFilter as keyof typeof EXPENSE_CATEGORIES]?.label}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(([key, category]) => (
              <SelectItem key={key} value={key}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-10 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filtered.length} of {state.expenses.length} expense
            {state.expenses.length === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline">Newest first</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-serif text-xl">No matching expenses</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try a different search or clear the active filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 h-9 rounded-md border border-border px-3 text-sm hover:bg-surface-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
        <div className="divide-y divide-border md:hidden">
          {filtered.map((expense) => {
            const status = statusFor(expense);
            return (
              <article key={expense.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-medium">
                        {expense.description}
                      </h3>
                      {isAiScanned(expense) && (
                        <ScanLine className="h-3 w-3 shrink-0 text-gold" aria-label="AI scanned" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {EXPENSE_CATEGORIES[expense.category]?.label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm tabular">
                      {formatCurrency(expense.amount)}
                    </div>
                    <div className="mt-1">
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <span className="eyebrow">Claimable </span>
                    <span className="ml-1 font-mono text-sm tabular">
                      {formatCurrency(covered(expense) ? 0 : expense.claimableAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(expense.receiptDataUrl || expense.hasReceipt) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2.5"
                        aria-label={`View receipt for ${expense.description}`}
                        onClick={() => openReceipt(expense)}
                      >
                        <Receipt className="mr-1.5 h-3.5 w-3.5 text-gold" />
                        Receipt
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => onEdit(expense)}
                      aria-label={`Edit ${expense.description}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(expense.id)}
                      aria-label={`Delete ${expense.description}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
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
                            <ScanLine className="h-3 w-3 text-gold" />
                          </span>
                        )}
                        {(expense.receiptDataUrl || expense.hasReceipt) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openReceipt(expense)}
                            aria-label={`View receipt for ${expense.description}`}
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
                      {formatCurrency(covered(expense) ? 0 : expense.claimableAmount)}
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
        </>
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
          {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={action.busy} onClick={(event) => { event.preventDefault(); void handleConfirmDelete(); }}>
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
          {receiptUrl?.startsWith("data:application/pdf;") ? (
            <a href={receiptUrl} download="receipt.pdf" className="text-sm underline">Download original PDF receipt</a>
          ) : receiptUrl && (
            // Stored receipt data URLs do not benefit from remote image optimization.
            // eslint-disable-next-line @next/next/no-img-element
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
