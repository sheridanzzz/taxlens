"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  X,
  Info,
  ReceiptText,
  Tags,
  Paperclip,
  Check,
} from "lucide-react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isCoveredByFixedRate } from "@/lib/tax-calculator";
import { useTax } from "@/context/tax-context";
import { neonGetExpenseReceipt } from "@/lib/storage-actions";
import {
  ASSET_EFFECTIVE_LIVES,
  CAR_KM_CAP,
  CAR_RATE_PER_KM,
  DEPRECIABLE_CATEGORIES,
  EXPENSE_CATEGORIES,
  FINANCIAL_YEARS,
  FY_DATE_RANGES,
  getDefaultDateForFinancialYear,
  getFinancialYearForDate,
  INSTANT_DEDUCTION_THRESHOLD,
} from "@/lib/constants";
import type {
  AssetType,
  DepreciatingAsset,
  Expense,
  ExpenseCategory,
  ClaimType,
  FinancialYear,
} from "@/lib/types";

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
  const { state, addExpense, updateExpense, addAsset } = useTax();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("computer_equipment");
  const [date, setDate] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("full");
  const [workUsePercent, setWorkUsePercent] = useState("100");
  const [notes, setNotes] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [monthly, setMonthly] = useState(false);
  const [assetType, setAssetType] = useState<AssetType>("laptop");
  const [kilometres, setKilometres] = useState("");
  const [fy, setFy] = useState<FinancialYear>(state.settings.financialYear);
  // distinguishes "user removed the receipt" from "payload not hydrated yet"
  const [receiptRemoved, setReceiptRemoved] = useState(false);

  function resetForm() {
    setSaveError("");
    setDescription("");
    setAmount("");
    setCategory("computer_equipment");
    setDate(getDefaultDateForFinancialYear(state.settings.financialYear));
    setFy(state.settings.financialYear);
    setClaimType("full");
    setWorkUsePercent(state.settings.defaultWorkUsePercent.toString());
    setNotes("");
    setReceiptDataUrl(undefined);
    setReceiptRemoved(false);
    setMonthly(false);
    setAssetType("laptop");
    setKilometres("");
  }

  // Car expenses are rate × km, not a receipt total. Keep amount in sync.
  const carRate = CAR_RATE_PER_KM[fy];
  const cappedKm = Math.min(parseFloat(kilometres) || 0, CAR_KM_CAP);
  const isCarKm = category === "car_km";

  /* Form state intentionally follows the record selected by the parent dialog. */
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
      setFy(editingExpense.financialYear);
      setReceiptRemoved(false);
      // cloud list rows carry a flag, not the image — hydrate it for editing
      if (!editingExpense.receiptDataUrl && editingExpense.hasReceipt) {
        neonGetExpenseReceipt(editingExpense.id).then(
          (data) => data && setReceiptDataUrl(data)
        );
      }
    } else {
      resetForm();
    }
    // resetForm is deliberately recreated with the current FY defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpense, open]);

  const mustDepreciate =
    parseFloat(amount) > INSTANT_DEDUCTION_THRESHOLD &&
    DEPRECIABLE_CATEGORIES.includes(category);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (parseFloat(value) > 0) {
      setClaimType(
        parseFloat(value) > INSTANT_DEDUCTION_THRESHOLD &&
          DEPRECIABLE_CATEGORIES.includes(category)
          ? "depreciation"
          : "full"
      );
    }
  };

  const handleCategoryChange = (next: ExpenseCategory) => {
    setCategory(next);
    if (next === "car_km") {
      setWorkUsePercent("100");
      setClaimType("full");
      return;
    }
    if (parseFloat(amount) > 0) {
      setClaimType(
        parseFloat(amount) > INSTANT_DEDUCTION_THRESHOLD &&
          DEPRECIABLE_CATEGORIES.includes(next)
          ? "depreciation"
          : "full"
      );
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptDataUrl(ev.target?.result as string);
      setReceiptRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptDataUrl(undefined);
    setReceiptRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveForm = async () => {

    const numAmount = isCarKm ? cappedKm * carRate : parseFloat(amount);
    const numWorkUse = parseFloat(workUsePercent);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // A depreciating item deducts nothing as an expense row — the deduction is
    // calculated on the asset register. Register it, and keep the expense row
    // as the receipt/evidence record (claimable stays $0, so no double count).
    // ponytail: one-way link — editing the expense later won't move the asset.
    if (claimType === "depreciation" && !editingExpense) {
      await addAsset({
        id: uuidv4(),
        name: description.trim(),
        assetType,
        purchaseDate: date,
        purchasePrice: numAmount,
        effectiveLifeYears: ASSET_EFFECTIVE_LIVES[assetType].years,
        depreciationMethod: state.settings.depreciationMethod,
        workUsePercent: numWorkUse,
        financialYear: fy,
        createdAt: new Date().toISOString(),
      } satisfies DepreciatingAsset);
    }

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
      hasReceipt: !receiptRemoved && !!editingExpense?.hasReceipt,
      notes: notes.trim() || undefined,
      financialYear: fy,
      createdAt: editingExpense?.createdAt || new Date().toISOString(),
    };

    if (editingExpense) {
      await updateExpense(expense);
    } else if (monthly && claimType === "full") {
      const dates = monthlyDates(date, fy);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await saveForm();
    } catch {
      setSaveError("Couldn’t save the expense. Your changes are still here — please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const fyRange = FY_DATE_RANGES[fy];
  const coveredByFixedRate = isCoveredByFixedRate({ category }, state.settings.wfhMethod);
  const claimablePreview =
    coveredByFixedRate ? 0 : claimType === "full"
      ? (isCarKm ? cappedKm * carRate : parseFloat(amount) || 0) *
        ((parseFloat(workUsePercent) || 0) / 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94dvh,920px)] w-full flex-col gap-0 overflow-hidden rounded-xl border border-border bg-popover p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 sm:px-7">
          <div className="mb-1 flex items-center gap-2 text-gold">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-gold/30 bg-gold-soft">
              <ReceiptText className="h-4 w-4" />
            </span>
            <span className="eyebrow text-gold">
              {editingExpense ? "Update record" : "Manual entry"}
            </span>
          </div>
          <DialogTitle className="font-serif text-3xl leading-tight">
            {editingExpense ? "Edit expense" : "Add an expense"}
          </DialogTitle>
          <DialogDescription className="max-w-xl text-[13px] leading-relaxed">
            Record the purchase first, then confirm how it should be treated for
            tax. Ledgr calculates the claimable amount automatically.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
            <section aria-labelledby="purchase-details-heading">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-soft text-gold">
                  <span className="font-mono text-[11px]">01</span>
                </span>
                <div>
                  <h3
                    id="purchase-details-heading"
                    className="text-sm font-medium"
                  >
                    Purchase details
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    What you bought, when, and how much you paid.
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-surface/50 p-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-description">Description</Label>
                  <Input
                    id="expense-description"
                    placeholder="e.g. MacBook Pro M3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">
                      {isCarKm ? "Work kilometres" : "Amount (AUD)"}
                    </Label>
                    {isCarKm ? (
                      <>
                        <Input
                          id="expense-amount"
                          type="number"
                          step="1"
                          min="1"
                          max={CAR_KM_CAP}
                          placeholder="0"
                          value={kilometres}
                          onChange={(e) => setKilometres(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          {cappedKm.toLocaleString()} km × {carRate * 100}c ={" "}
                          <span className="text-foreground">
                            ${(cappedKm * carRate).toFixed(2)}
                          </span>
                          {cappedKm >= CAR_KM_CAP && " · capped at 5,000 km"}
                        </p>
                      </>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="expense-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          className="pl-7 font-mono"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-date">Purchase date</Label>
                    <Input
                      id="expense-date"
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        const dateFy = getFinancialYearForDate(e.target.value);
                        if (dateFy) setFy(dateFy);
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="expense-fy">Financial year</Label>
                    <Select
                      value={fy}
                      onValueChange={(v) => setFy(v as FinancialYear)}
                    >
                      <SelectTrigger id="expense-fy">
                        {FINANCIAL_YEARS.find((f) => f.value === fy)?.label ?? fy}
                      </SelectTrigger>
                      <SelectContent>
                        {FINANCIAL_YEARS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {fyRange.start} to {fyRange.end}
                    </p>
                  </div>

                  {!editingExpense && claimType === "full" && (
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={monthly}
                        onChange={(e) => setMonthly(e.target.checked)}
                        className="h-4 w-4 accent-[var(--color-gold)]"
                      />
                      <span>
                        Repeat monthly
                        {monthly && date && (
                          <span className="text-foreground">
                            {" "}
                            · {monthlyDates(date, fy).length} entries
                          </span>
                        )}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="tax-treatment-heading">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-soft text-gold">
                  <span className="font-mono text-[11px]">02</span>
                </span>
                <div>
                  <h3
                    id="tax-treatment-heading"
                    className="text-sm font-medium"
                  >
                    Tax treatment
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Categorise the expense and confirm its work-related portion.
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-surface/50 p-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-category">ATO category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) =>
                      handleCategoryChange(v as ExpenseCategory)
                    }
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
                      <Label htmlFor="expense-claim-type">Claim method</Label>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            Items ≤ ${INSTANT_DEDUCTION_THRESHOLD} can usually be
                            claimed immediately. Eligible items above the
                            threshold are added to the asset register.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={claimType}
                      onValueChange={(v) => setClaimType(v as ClaimType)}
                    >
                      <SelectTrigger id="expense-claim-type">
                        <span>
                          {claimType === "full"
                            ? "Immediate deduction"
                            : "Depreciate over time"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">
                          Immediate deduction
                        </SelectItem>
                        <SelectItem value="depreciation">
                          Depreciate over time
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="expense-work-use">Work use</Label>
                      <span className="font-mono text-xs text-gold">
                        {workUsePercent || 0}%
                      </span>
                    </div>
                    <Input
                      id="expense-work-use"
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={workUsePercent}
                      onChange={(e) => setWorkUsePercent(e.target.value)}
                    />
                  </div>
                </div>

                {claimType === "depreciation" && !editingExpense && (
                  <div className="space-y-2">
                    <Label htmlFor="expense-asset-type">Asset type</Label>
                    <Select
                      value={assetType}
                      onValueChange={(v) => setAssetType(v as AssetType)}
                    >
                      <SelectTrigger id="expense-asset-type">
                        <span>{ASSET_EFFECTIVE_LIVES[assetType].label}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ASSET_EFFECTIVE_LIVES).map(([key, a]) => (
                          <SelectItem key={key} value={key}>
                            {a.label} — {a.years}yr life
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mustDepreciate && (
                      <p className="text-xs text-muted-foreground">
                        This will also be added to Assets so its deduction can be
                        tracked across financial years.
                      </p>
                    )}
                  </div>
                )}

                {coveredByFixedRate && (
                  <p className="rounded-lg bg-butter/50 px-4 py-3 text-sm text-plum">
                    <strong>Covered by your 70c rate.</strong> The fixed rate already
                    includes internet and phone, so this won’t add to your deductions.
                    Switch to the actual cost method under WFH hours to claim it.
                  </p>
                )}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-gold/25 bg-gold-soft/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Tags className="h-4 w-4 text-gold" />
                    <span>
                      {claimType === "full"
                        ? "Claimable this year"
                        : "Added to asset register"}
                    </span>
                  </div>
                  <span className="font-serif text-2xl tabular text-gold">
                    {claimType === "full"
                      ? `$${claimablePreview.toFixed(2)}`
                      : "Schedule"}
                  </span>
                </div>
              </div>
            </section>

            <section aria-labelledby="evidence-heading">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-soft text-gold">
                  <span className="font-mono text-[11px]">03</span>
                </span>
                <div>
                  <h3 id="evidence-heading" className="text-sm font-medium">
                    Evidence & notes
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Optional, but useful if the ATO asks how the claim was worked
                    out.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border border-border bg-surface/50 p-4 sm:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-2">
                  <Label>Receipt</Label>
                  {receiptDataUrl ? (
                    <div className="relative inline-block">
                      {/* Data URLs and authenticated receipt payloads cannot use next/image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={receiptDataUrl}
                        alt="Receipt"
                        className="h-28 w-auto rounded-lg border border-border object-cover"
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
                        accept="image/*,.pdf,application/pdf"
                        onChange={handleReceiptUpload}
                        className="hidden"
                        id="receipt-upload"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2/40 px-4 text-center text-xs text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground"
                      >
                        <Paperclip className="h-4 w-4 text-gold" />
                        <span>Attach receipt</span>
                        <span className="text-[10px]">Image or PDF</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-notes">Notes</Label>
                  <Textarea
                    id="expense-notes"
                    placeholder="Business purpose, work-use calculation, or anything your accountant should know…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="min-h-24 resize-none"
                  />
                </div>
              </div>
            </section>
          </div>

          {saveError && <p role="alert" className="px-5 py-3 text-sm text-negative sm:px-7">{saveError}</p>}
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-popover/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Check className="h-3.5 w-3.5 text-positive" />
              FY {fy}
            </p>
            <div className="flex gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gold text-primary-foreground hover:bg-gold/90 sm:flex-none"
              >
                {saving ? "Saving…" : editingExpense ? "Save changes" : "Add expense"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
