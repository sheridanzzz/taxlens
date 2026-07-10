"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ASSET_EFFECTIVE_LIVES,
  FY_DATE_RANGES,
  getDefaultDateForFinancialYear,
  INSTANT_DEDUCTION_THRESHOLD,
} from "@/lib/constants";
import type { DepreciatingAsset, AssetType, DepreciationMethod } from "@/lib/types";

interface AssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAsset?: DepreciatingAsset | null;
}

export const AssetForm = ({
  open,
  onOpenChange,
  editingAsset,
}: AssetFormProps) => {
  const { state, addAsset, updateAsset } = useTax();

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("laptop");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [effectiveLife, setEffectiveLife] = useState("4");
  const [depreciationMethod, setDepreciationMethod] =
    useState<DepreciationMethod>("diminishing");
  const [workUsePercent, setWorkUsePercent] = useState("100");

  function resetForm() {
    setName("");
    setAssetType("laptop");
    setPurchasePrice("");
    setPurchaseDate(getDefaultDateForFinancialYear(state.settings.financialYear));
    setEffectiveLife("4");
    setDepreciationMethod(state.settings.depreciationMethod);
    setWorkUsePercent(state.settings.defaultWorkUsePercent.toString());
  }

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setAssetType(editingAsset.assetType);
      setPurchasePrice(editingAsset.purchasePrice.toString());
      setPurchaseDate(editingAsset.purchaseDate);
      setEffectiveLife(editingAsset.effectiveLifeYears.toString());
      setDepreciationMethod(editingAsset.depreciationMethod);
      setWorkUsePercent(editingAsset.workUsePercent.toString());
    } else {
      resetForm();
    }
  }, [editingAsset, open]);

  useEffect(() => {
    const life = ASSET_EFFECTIVE_LIVES[assetType];
    if (life) {
      setEffectiveLife(life.years.toString());
      if (!name || Object.values(ASSET_EFFECTIVE_LIVES).some((a) => a.label === name)) {
        setName(life.label);
      }
    }
  }, [assetType]);

  const price = parseFloat(purchasePrice);
  const showThresholdWarning = !isNaN(price) && price <= INSTANT_DEDUCTION_THRESHOLD;
  const fyRange = FY_DATE_RANGES[state.settings.financialYear];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numPrice = parseFloat(purchasePrice);
    if (isNaN(numPrice) || numPrice <= 0) return;

    const asset: DepreciatingAsset = {
      id: editingAsset?.id || uuidv4(),
      name: name.trim(),
      assetType,
      purchaseDate,
      purchasePrice: numPrice,
      effectiveLifeYears: parseFloat(effectiveLife),
      depreciationMethod,
      workUsePercent: parseFloat(workUsePercent) || 100,
      financialYear: state.settings.financialYear,
      createdAt: editingAsset?.createdAt || new Date().toISOString(),
    };

    if (editingAsset) {
      await updateAsset(asset);
    } else {
      await addAsset(asset);
    }

    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingAsset ? "Edit Asset" : "Add Depreciating Asset"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asset-type">Asset Type</Label>
            <Select
              value={assetType}
              onValueChange={(v) => setAssetType(v as AssetType)}
            >
              <SelectTrigger id="asset-type">
                <span>{ASSET_EFFECTIVE_LIVES[assetType]?.label ?? assetType} ({ASSET_EFFECTIVE_LIVES[assetType]?.years ?? "?"} yr)</span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_EFFECTIVE_LIVES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label} ({val.years} yr effective life)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-name">Name / Description</Label>
            <Input
              id="asset-name"
              placeholder="e.g. Dell UltraSharp U2723QE"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-price">Purchase Price ($)</Label>
              <Input
                id="asset-price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
              />
              {showThresholdWarning && (
                <p className="text-xs text-amber-500">
                  Items ≤ ${INSTANT_DEDUCTION_THRESHOLD} can be claimed fully as
                  an expense instead.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-date">Purchase Date</Label>
              <Input
                id="asset-date"
                type="date"
                min={fyRange.start}
                max={fyRange.end}
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {state.settings.financialYear} runs from {fyRange.start} to {fyRange.end}.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="asset-life">Effective Life (years)</Label>
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      ATO effective life determines how many years you
                      depreciate the asset over. Pre-filled based on asset type.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="asset-life"
                type="number"
                min="1"
                max="40"
                step="1"
                value={effectiveLife}
                onChange={(e) => setEffectiveLife(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="asset-method">Method</Label>
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Diminishing Value gives larger deductions early on -- best for IT gear that loses value quickly. Prime Cost spreads it evenly. For laptops and monitors, Diminishing Value usually maximises your refund.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={depreciationMethod}
                onValueChange={(v) =>
                  setDepreciationMethod(v as DepreciationMethod)
                }
              >
                <SelectTrigger id="asset-method">
                  <span>{depreciationMethod === "diminishing" ? "Diminishing Value" : "Prime Cost"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diminishing">Diminishing Value</SelectItem>
                  <SelectItem value="prime_cost">Prime Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="asset-work-use">Work Use %</Label>
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Only the work-related portion is deductible. If you use this asset exclusively for work, set 100%. Mixed personal/work use should reflect your actual split.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="asset-work-use"
                type="number"
                min="1"
                max="100"
                value={workUsePercent}
                onChange={(e) => setWorkUsePercent(e.target.value)}
              />
            </div>
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
              {editingAsset ? "Update" : "Add Asset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
