"use client";

import { useState, Fragment } from "react";
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
} from "lucide-react";
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
import { formatCurrency } from "@/lib/tax-calculator";
import {
  calculateCurrentYearDepreciation,
  calculateRemainingValue,
} from "@/lib/depreciation";
import { ASSET_EFFECTIVE_LIVES } from "@/lib/constants";
import { DepreciationChart } from "./depreciation-chart";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { DepreciatingAsset } from "@/lib/types";

interface DepreciationTableProps {
  onEdit: (asset: DepreciatingAsset) => void;
}

export const DepreciationTable = ({ onEdit }: DepreciationTableProps) => {
  const { state, removeAsset } = useTax();
  const prefersReduced = useReducedMotion();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fy = state.settings.financialYear;

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await removeAsset(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (state.assets.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[13px] text-muted-foreground">
          No depreciating assets recorded yet
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card dark:border-border dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">This year</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Work %</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <motion.tbody
            variants={staggerContainer}
            initial={prefersReduced ? false : "initial"}
            animate="animate"
          >
            {state.assets.map((asset) => {
              const yearDeduction = calculateCurrentYearDepreciation(asset, fy);
              const remaining = calculateRemainingValue(asset, fy);
              const isExpanded = expandedId === asset.id;

              return (
                <Fragment key={asset.id}>
                  <motion.tr
                    variants={staggerItem}
                    className="border-b border-border transition-colors hover:bg-background dark:border-[rgba(255,255,255,0.04)] dark:hover:bg-secondary"
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleToggleExpand(asset.id)}
                        aria-label={
                          isExpanded ? "Collapse schedule" : "Expand schedule"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground dark:text-foreground">
                      {asset.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-[rgba(22,51,0,0.06)] text-xs text-ink-soft dark:bg-white/5 dark:text-muted-foreground"
                      >
                        {ASSET_EFFECTIVE_LIVES[asset.assetType]?.label ||
                          asset.assetType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-ink-soft dark:text-muted-foreground">
                      {formatCurrency(asset.purchasePrice)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-foreground dark:text-primary">
                      {formatCurrency(yearDeduction)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-ink-soft dark:text-muted-foreground">
                      {formatCurrency(remaining)}
                    </TableCell>
                    <TableCell className="text-sm text-ink-soft dark:text-muted-foreground">
                      {asset.workUsePercent}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs"
                      >
                        {asset.depreciationMethod === "diminishing"
                          ? "DV"
                          : "PC"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(asset)}
                          aria-label={`Edit ${asset.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(asset.id)}
                          aria-label={`Delete ${asset.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                  {isExpanded && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="bg-secondary p-4 dark:bg-white/[0.02]"
                      >
                        <DepreciationChart asset={asset} currentFy={fy} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </motion.tbody>
        </Table>
      </div>

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
    </>
  );
};
