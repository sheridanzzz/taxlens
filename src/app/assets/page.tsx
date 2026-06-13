"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { AssetForm } from "@/components/assets/asset-form";
import { DepreciationTable } from "@/components/assets/depreciation-table";
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import { calculateCurrentYearDepreciation } from "@/lib/depreciation";
import { fadeInUp } from "@/lib/animations";
import type { DepreciatingAsset } from "@/lib/types";

const AssetsPage = () => {
  const { state } = useTax();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<DepreciatingAsset | null>(
    null
  );

  const handleEdit = (asset: DepreciatingAsset) => {
    setEditingAsset(asset);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingAsset(null);
  };

  if (!state.loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalDepreciation = state.assets.reduce(
    (sum, a) =>
      sum +
      calculateCurrentYearDepreciation(a, state.settings.financialYear),
    0
  );

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
            {state.assets.length} assets &middot;{" "}
            <span className="stat-number font-medium text-[#0e0f0c] dark:text-[#f4f5f2]">
              {formatCurrency(totalDepreciation)}
            </span>{" "}
            claimable this year
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setFormOpen(true)}
          aria-label="Add new depreciating asset"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add asset
        </Button>
      </div>

      <DepreciationTable onEdit={handleEdit} />

      <AssetForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        editingAsset={editingAsset}
      />
    </motion.div>
  );
};

export default AssetsPage;
