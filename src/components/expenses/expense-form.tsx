"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Upload, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTax } from "@/context/tax-context";
import {
  EXPENSE_CATEGORIES,
  FY_DATE_RANGES,
  getDefaultDateForFinancialYear,
  INSTANT_DEDUCTION_THRESHOLD,
} from "@/lib/constants";
import type { Expense, ExpenseCategory, ClaimType } from "@/lib/types";

// ponytail: no recurrence engine — monthly subs expand into plain expense
// rows at save time, one per month until the FY ends (30 Jun)
const monthlyDates = (startIso: string, fy: string): string[] => {
  const end = `${Number(fy.slice(0, 4)) + 1}-06-30`;
  const [y, m, d] = startIso.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 0; ; i++) {
    let dt = new Date(y, m - 1 + i, d);
    if (dt.getDate() !== d) dt = new Date(y, m + i, 0); // clamp to month end
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (iso > end) break;
    dates.push(iso);
  }
  return dates;
};

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingExpense?: Expense | null;
}

export const ExpenseForm = ({
  open,
  onOpenChange,
  editingExpense,
}: ExpenseFormProps) => {
  const { state, addExpense, updateExpense } = useTax();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("computer_equipment");
  const [date, setDate] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("full");
  const [workUsePercent, setWorkUsePercent] = useState("100");
  const [notes, setNotes] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [monthly, setMonthly] = useState(false);

  function resetForm() {
    setDescription("");
    setAmount("");
    setCategory("computer_equipment");
    setDate(getDefaultDateForFinancialYear(state.settings.financialYear));
    setClaimType("full");
    setWorkUsePercent(state.settings.defaultWorkUsePercent.toString());
    setNotes("");
    setReceiptDataUrl(undefined);
    setMonthly(false);
  }

  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description);
      setAmount(editingExpense.amount.toString());
      setCategory(editingExpense.category);
      setDate(editingExpense.date);
      setClaimType(editingExpense.claimType);
      setWorkUsePercent(editingExpense.workUsePercent.toString());
      setNotes(editingExpense.notes || "");
      setReceiptDataUrl(editingExpense.receiptDataUrl);
    } else {
      resetForm();
    }
  }, [editingExpense, open]);

  useEffect(() => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      setClaimType(
        numAmount <= INSTANT_DEDUCTION_THRESHOLD ? "full" : "depreciation"
      );
    }
  }, [amount]);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptDataUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    const numWorkUse = parseFloat(workUsePercent);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const claimableAmount =
      claimType === "full"
        ? Math.round(numAmount * (numWorkUse / 100) * 100) / 100
        : 0;

    const expense: Expense = {
      id: editingExpense?.id || uuidv4(),
      date,
      description: description.trim(),
      amount: numAmount,
      category,
      claimType,
      workUsePercent: numWorkUse,
      claimableAmount,
      receiptDataUrl,
      notes: notes.trim() || undefined,
      financialYear: state.settings.financialYear,
      createdAt: editingExpense?.createdAt || new Date().toISOString(),
    };

    if (editingExpense) {
      await updateExpense(expense);
    } else if (monthly && claimType === "full") {
      const dates = monthlyDates(date, state.settings.financialYear);
      for (let i = 0; i < dates.length; i++) {
        await addExpense({
          ...expense,
          id: i === 0 ? expense.id : uuidv4(),
          date: dates[i],
          // receipt on the first entry only — one invoice is the evidence
          receiptDataUrl: i === 0 ? receiptDataUrl : undefined,
        });
      }
    } else {
      await addExpense(expense);
    }

    onOpenChange(false);
    resetForm();
  };

  const fyRange = FY_DATE_RANGES[state.settings.financialYear];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingExpense ? "Edit Expense" : "Add Expense"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="e.g. MacBook Pro M3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount ($)</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                min={fyRange.start}
                max={fyRange.end}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {state.settings.financialYear} runs from {fyRange.start} to {fyRange.end}.
              </p>
            </div>
          </div>

          {!editingExpense && claimType === "full" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={monthly}
                onChange={(e) => setMonthly(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>
                Repeats monthly (subscription) — adds an entry each month
                until 30 Jun
                {monthly && date && (
                  <span className="text-foreground">
                    {" "}
                    · {monthlyDates(date, state.settings.financialYear).length}{" "}
                    entries
                  </span>
                )}
              </span>
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ExpenseCategory)}
            >
              <SelectTrigger id="expense-category">
                <span>{EXPENSE_CATEGORIES[category]?.label ?? category}</span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="expense-claim-type">Claim Type</Label>
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Items ≤ ${INSTANT_DEDUCTION_THRESHOLD} can be claimed
                      fully in the year purchased. Items &gt; $
                      {INSTANT_DEDUCTION_THRESHOLD} must be depreciated over
                      their effective life.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {parseFloat(amount) > INSTANT_DEDUCTION_THRESHOLD ? (
                <div className="flex h-9 items-center rounded-md border border-border/50 bg-muted/30 px-3">
                  <span className="text-sm text-muted-foreground">Depreciation (required over ${INSTANT_DEDUCTION_THRESHOLD})</span>
                </div>
              ) : (
                <Select
                  value={claimType}
                  onValueChange={(v) => setClaimType(v as ClaimType)}
                >
                  <SelectTrigger id="expense-claim-type">
                    <span>{claimType === "full" ? "Full Claim (Instant)" : "Depreciation"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Claim (Instant)</SelectItem>
                    <SelectItem value="depreciation">Depreciation</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="expense-work-use">Work Use %</Label>
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      The percentage of this item used for work. If used 100% for work, enter 100. If shared personal/work, enter your estimated work-use portion (e.g. 70%).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="expense-work-use"
                type="number"
                min="1"
                max="100"
                value={workUsePercent}
                onChange={(e) => setWorkUsePercent(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Receipt</Label>
            {receiptDataUrl ? (
              <div className="relative inline-block">
                <img
                  src={receiptDataUrl}
                  alt="Receipt"
                  className="h-24 w-auto rounded-lg border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6"
                  onClick={handleRemoveReceipt}
                  aria-label="Remove receipt"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptUpload}
                  className="hidden"
                  id="receipt-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload receipt"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Receipt
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-notes">Notes (optional)</Label>
            <Textarea
              id="expense-notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingExpense ? "Update" : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
