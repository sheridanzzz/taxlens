"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion } from "motion/react";
import {
  Building2,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Info,
} from "lucide-react";
import { Section, Kpi, Card, Pill } from "@/components/ledgr/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useTax } from "@/context/tax-context";
import {
  RENTAL_CATEGORIES,
  calculateRentalSummary,
  rentalCategoriesFor,
} from "@/lib/rental";
import {
  getDefaultDateForFinancialYear,
  getFinancialYearForDate,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/tax-calculator";
import { fadeInUp } from "@/lib/animations";
import type {
  RentalCategory,
  RentalProperty,
  RentalTransaction,
  RentalTransactionKind,
} from "@/lib/types";

const RentalPage = () => {
  const {
    state,
    rental,
    addRentalProperty,
    removeRentalProperty,
    addRentalTransaction,
    removeRentalTransaction,
  } = useTax();
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(
    null
  );

  const [address, setAddress] = useState("");
  const [ownership, setOwnership] = useState("100");
  const [acquiredDate, setAcquiredDate] = useState("");
  const [propertyNotes, setPropertyNotes] = useState("");

  const [propertyId, setPropertyId] = useState("");
  const [kind, setKind] = useState<RentalTransactionKind>("income");
  const [category, setCategory] = useState<RentalCategory>("rent");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [deductiblePercent, setDeductiblePercent] = useState("100");
  const [transactionNotes, setTransactionNotes] = useState("");

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const openTransaction = (forProperty?: string) => {
    const selected = forProperty ?? state.rentalProperties[0]?.id ?? "";
    setPropertyId(selected);
    setKind("income");
    setCategory("rent");
    setDescription("Rent received");
    setAmount("");
    setDate(getDefaultDateForFinancialYear(state.settings.financialYear));
    setDeductiblePercent("100");
    setTransactionNotes("");
    setTransactionOpen(true);
  };

  const changeKind = (next: RentalTransactionKind) => {
    setKind(next);
    if (next === "income") {
      setCategory("rent");
      setDescription("Rent received");
      setDeductiblePercent("100");
    } else {
      setCategory("loan_interest");
      setDescription("");
    }
  };

  const handleAddProperty = async (event: React.FormEvent) => {
    event.preventDefault();
    const percent = Math.min(100, Math.max(0, Number(ownership)));
    if (!address.trim() || percent <= 0) return;
    const property: RentalProperty = {
      id: uuidv4(),
      address: address.trim(),
      ownershipPercent: percent,
      acquiredDate: acquiredDate || undefined,
      notes: propertyNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await addRentalProperty(property);
    setAddress("");
    setOwnership("100");
    setAcquiredDate("");
    setPropertyNotes("");
    setPropertyOpen(false);
  };

  const handleAddTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!propertyId || !description.trim() || numericAmount <= 0 || !date) return;
    const transaction: RentalTransaction = {
      id: uuidv4(),
      propertyId,
      date,
      kind,
      category,
      description: description.trim(),
      amount: numericAmount,
      deductiblePercent:
        kind === "income"
          ? 100
          : Math.min(100, Math.max(0, Number(deductiblePercent))),
      financialYear:
        getFinancialYearForDate(date) ?? state.settings.financialYear,
      notes: transactionNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await addRentalTransaction(transaction);
    setTransactionOpen(false);
  };

  const propertyById = new Map(
    state.rentalProperties.map((property) => [property.id, property])
  );

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Section
        eyebrow={`Rental property · FY ${state.settings.financialYear}`}
        title="Rental income, kept separate."
        description="Track rent and deductible property costs independently from employment expenses. Ownership share is applied automatically."
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={() => setPropertyOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <Building2 className="h-4 w-4" />
              Add property
            </button>
            <button
              onClick={() => openTransaction()}
              disabled={state.rentalProperties.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add entry
            </button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi
          label="Assessable rent"
          value={formatCurrency(rental.assessableIncome)}
          hint="after ownership share"
        />
        <Kpi
          label="Rental deductions"
          value={formatCurrency(rental.deductibleExpenses)}
          hint="claimable this FY"
          positive={rental.deductibleExpenses > 0}
        />
        <Kpi
          label="Net rental result"
          value={formatCurrency(rental.netResult)}
          hint={rental.netResult < 0 ? "net rental loss" : "net rental income"}
        />
        <Kpi
          label="Properties"
          value={String(state.rentalProperties.length)}
          hint={`${state.rentalTransactions.length} ledger entries`}
        />
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/25 bg-gold-soft/15 p-4 text-[13px]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p className="text-muted-foreground">
          This ledger handles common rental income and immediately deductible
          costs. Capital works, depreciating assets, borrowing costs and loan
          principal need separate tax treatment—confirm those with your
          accountant before recording them here.
        </p>
      </div>

      {state.rentalProperties.length === 0 ? (
        <Card className="py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gold/30 bg-gold-soft text-gold">
            <Building2 className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-serif text-2xl">Add your first property</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Each property gets its own ledger, ownership share, income and
            deductions.
          </p>
          <button
            onClick={() => setPropertyOpen(true)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add rental property
          </button>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.rentalProperties.map((property) => {
              const transactions = state.rentalTransactions.filter(
                (transaction) => transaction.propertyId === property.id
              );
              const summary = calculateRentalSummary([property], transactions);
              return (
                <Card key={property.id} className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="eyebrow">Rental property</div>
                      <h2 className="mt-1 truncate font-serif text-xl">
                        {property.address}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {property.ownershipPercent}% ownership
                      </p>
                    </div>
                    <button
                      onClick={() => setDeletePropertyId(property.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-negative/10 hover:text-negative"
                      aria-label={`Delete ${property.address}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Income</dt>
                      <dd className="mt-1 font-mono tabular">
                        {formatCurrency(summary.assessableIncome)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Deductions</dt>
                      <dd className="mt-1 font-mono tabular">
                        {formatCurrency(summary.deductibleExpenses)}
                      </dd>
                    </div>
                  </dl>
                  <button
                    onClick={() => openTransaction(property.id)}
                    className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-sm hover:bg-surface-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add ledger entry
                  </button>
                </Card>
              );
            })}
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
              <div>
                <div className="eyebrow">Property ledger</div>
                <h2 className="mt-1 font-serif text-2xl">
                  Income and expenses
                </h2>
              </div>
              <Pill tone="muted">
                {state.rentalTransactions.length} entr
                {state.rentalTransactions.length === 1 ? "y" : "ies"}
              </Pill>
            </div>

            {state.rentalTransactions.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No rental entries in this financial year.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {state.rentalTransactions.map((transaction) => {
                  const property = propertyById.get(transaction.propertyId);
                  const ownership = (property?.ownershipPercent ?? 100) / 100;
                  const taxAmount =
                    transaction.kind === "income"
                      ? transaction.amount * ownership
                      : transaction.amount *
                        ownership *
                        (transaction.deductiblePercent / 100);
                  return (
                    <div
                      key={transaction.id}
                      className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:px-5"
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full ${
                          transaction.kind === "income"
                            ? "bg-positive/10 text-positive"
                            : "bg-gold-soft text-gold"
                        }`}
                      >
                        {transaction.kind === "income" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm">
                          {transaction.description}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {property?.address} ·{" "}
                          {RENTAL_CATEGORIES[transaction.category]?.label} ·{" "}
                          {new Date(
                            `${transaction.date}T00:00:00`
                          ).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm tabular">
                          {transaction.kind === "income" ? "+" : "−"}
                          {formatCurrency(transaction.amount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          tax amount {formatCurrency(taxAmount)}
                        </div>
                      </div>
                      <button
                        onClick={() => setDeleteTransactionId(transaction.id)}
                        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-negative/10 hover:text-negative"
                        aria-label={`Delete ${transaction.description}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog open={propertyOpen} onOpenChange={setPropertyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">
              Add rental property
            </DialogTitle>
            <DialogDescription>
              Ownership share is applied to income and deductions in tax
              calculations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProperty} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rental-address">Property address</Label>
              <Input
                id="rental-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="12 Example Street, Melbourne VIC"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rental-ownership">Your ownership</Label>
                <div className="relative">
                  <Input
                    id="rental-ownership"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={ownership}
                    onChange={(event) => setOwnership(event.target.value)}
                    className="pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rental-acquired">Acquired (optional)</Label>
                <Input
                  id="rental-acquired"
                  type="date"
                  value={acquiredDate}
                  onChange={(event) => setAcquiredDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rental-property-notes">Notes (optional)</Label>
              <Textarea
                id="rental-property-notes"
                value={propertyNotes}
                onChange={(event) => setPropertyNotes(event.target.value)}
                placeholder="Loan reference, agent, co-owner details…"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPropertyOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gold text-primary-foreground hover:bg-gold/90"
              >
                Add property
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">
              Add rental ledger entry
            </DialogTitle>
            <DialogDescription>
              Enter the full property amount. Ledgr applies your ownership
              percentage automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-1">
              {(["income", "expense"] as RentalTransactionKind[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => changeKind(option)}
                    className={`h-9 rounded-md text-sm capitalize ${
                      kind === option
                        ? "bg-surface text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {option}
                  </button>
                )
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-property">Property</Label>
              <Select value={propertyId} onValueChange={(value) => setPropertyId(value ?? "")}>
                <SelectTrigger id="rental-property">
                  {propertyById.get(propertyId)?.address ?? "Select property"}
                </SelectTrigger>
                <SelectContent>
                  {state.rentalProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rental-category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as RentalCategory)
                  }
                >
                  <SelectTrigger id="rental-category">
                    {RENTAL_CATEGORIES[category]?.label}
                  </SelectTrigger>
                  <SelectContent>
                    {rentalCategoriesFor(kind).map(([value, item]) => (
                      <SelectItem key={value} value={value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rental-date">Date</Label>
                <Input
                  id="rental-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-description">Description</Label>
              <Input
                id="rental-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={
                  kind === "income"
                    ? "e.g. August rent"
                    : "e.g. Quarterly council rates"
                }
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rental-amount">Amount (AUD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="rental-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="pl-7 font-mono"
                    required
                  />
                </div>
              </div>
              {kind === "expense" && (
                <div className="space-y-2">
                  <Label htmlFor="rental-deductible">
                    Deductible portion
                  </Label>
                  <div className="relative">
                    <Input
                      id="rental-deductible"
                      type="number"
                      min="0"
                      max="100"
                      value={deductiblePercent}
                      onChange={(event) =>
                        setDeductiblePercent(event.target.value)
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-notes">Notes (optional)</Label>
              <Textarea
                id="rental-notes"
                value={transactionNotes}
                onChange={(event) => setTransactionNotes(event.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransactionOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gold text-primary-foreground hover:bg-gold/90"
              >
                Add {kind}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletePropertyId}
        onOpenChange={(open) => !open && setDeletePropertyId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this property?</AlertDialogTitle>
            <AlertDialogDescription>
              The property and every income or expense entry linked to it will
              be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletePropertyId)
                  await removeRentalProperty(deletePropertyId);
                setDeletePropertyId(null);
              }}
            >
              Delete property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTransactionId}
        onOpenChange={(open) => !open && setDeleteTransactionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ledger entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the rental calculation for FY{" "}
              {state.settings.financialYear}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTransactionId)
                  await removeRentalTransaction(deleteTransactionId);
                setDeleteTransactionId(null);
              }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default RentalPage;
