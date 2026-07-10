"use client";

import { useState } from "react";
import { Plus, Package, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { Section, Kpi, Card, Pill } from "@/components/ledgr/primitives";
import { Button } from "@/components/ui/button";
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
import { AssetForm } from "@/components/assets/asset-form";
import { DepreciationChart } from "@/components/assets/depreciation-chart";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import {
  calculateCurrentYearDepreciation,
  calculateRemainingValue,
} from "@/lib/depreciation";
import { fadeInUp } from "@/lib/animations";
import type { DepreciatingAsset } from "@/lib/types";

const AssetsPage = () => {
  const { state, removeAsset } = useTax();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<DepreciatingAsset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleEdit = (asset: DepreciatingAsset) => {
    setEditingAsset(asset);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingAsset(null);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await removeAsset(deleteId);
      setDeleteId(null);
    }
  };

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const fy = state.settings.financialYear;
  const totalCost = state.assets.reduce((s, a) => s + a.purchasePrice, 0);
  const thisYear = state.assets.reduce(
    (s, a) => s + calculateCurrentYearDepreciation(a, fy),
    0
  );
  const remaining = state.assets.reduce(
    (s, a) => s + calculateRemainingValue(a, fy),
    0
  );

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
    >
      <Section
        eyebrow="Depreciation"
        title="Assets, drawn up for you."
        action={
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
            aria-label="Add new depreciating asset"
          >
            <Plus className="h-4 w-4" /> Add asset
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Active assets" value={`${state.assets.length}`} hint="on schedule" />
        <Kpi label="Total cost base" value={formatCurrency(totalCost)} />
        <Kpi
          label="Claimable this FY"
          value={formatCurrency(thisYear)}
          positive={thisYear > 0}
        />
        <Kpi label="Remaining to claim" value={formatCurrency(remaining)} hint="future years" />
      </div>

      {state.assets.length === 0 ? (
        <div className="surface p-8 text-center">
          <p className="font-serif text-2xl">
            No depreciating assets in FY {fy} yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">
            Laptops, monitors and phones over $300 are claimed over their
            effective life — add one and Ledgr works out each year&apos;s
            deduction for you.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gold px-4 text-sm text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add your first asset
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {state.assets.map((a) => {
            const yearClaim = calculateCurrentYearDepreciation(a, fy);
            const left = calculateRemainingValue(a, fy);
            const claimedPct = a.purchasePrice > 0
              ? Math.round(((a.purchasePrice - left) / a.purchasePrice) * 100)
              : 0;
            const expanded = expandedId === a.id;
            return (
              <Card key={a.id}>
                <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto_auto]">
                  <div className="grid h-12 w-12 place-items-center rounded-md bg-surface-2">
                    <Package className="h-5 w-5 text-gold" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-serif text-xl">{a.name}</div>
                      <Pill tone="muted">
                        {a.depreciationMethod === "prime_cost"
                          ? "Prime cost"
                          : "Diminishing value"}
                      </Pill>
                      <Pill tone="gold">{a.effectiveLifeYears}yr life</Pill>
                      {a.workUsePercent < 100 && (
                        <Pill tone="muted">{a.workUsePercent}% work use</Pill>
                      )}
                    </div>
                    <div className="mt-1 text-xs tabular text-muted-foreground">
                      Purchased{" "}
                      {new Date(a.purchaseDate).toLocaleDateString("en-AU", {
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · Cost {formatCurrency(a.purchasePrice)}
                    </div>
                    <div className="mt-3 h-1.5 rounded bg-surface-2">
                      <div
                        className="h-full rounded bg-gold"
                        style={{ width: `${claimedPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="eyebrow">This FY</div>
                    <div className="font-serif text-2xl tabular">
                      {formatCurrency(yearClaim)}
                    </div>
                    <div className="text-[11px] tabular text-muted-foreground">
                      {claimedPct}% of cost claimed
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                      aria-label={`${expanded ? "Hide" : "Show"} schedule for ${a.name}`}
                    >
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(a)}
                      aria-label={`Edit ${a.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(a.id)}
                      aria-label={`Delete ${a.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4 border-t border-border pt-4">
                    <DepreciationChart asset={a} currentFy={fy} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AssetForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        editingAsset={editingAsset}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The asset and its depreciation
              schedule will be permanently removed.
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
    </motion.div>
  );
};

export default AssetsPage;
