"use client";

import { useState, useRef } from "react";
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
import { useAsyncAction } from "@/hooks/use-async-action";
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

export const AssetForm = (props: AssetFormProps) =>
  props.open ? <AssetFormFields key={props.editingAsset?.id ?? "new"} {...props} /> : null;

const AssetFormFields = ({
  open,
  onOpenChange,
  editingAsset,
}: AssetFormProps) => {
  const { state, addAsset, updateAsset } = useTax();
  const action = useAsyncAction();
  const recordId = useRef(editingAsset?.id ?? uuidv4());

  const [name, setName] = useState(editingAsset?.name ?? ASSET_EFFECTIVE_LIVES.laptop.label);
  const [assetType, setAssetType] = useState<AssetType>(editingAsset?.assetType ?? "laptop");
  const [purchasePrice, setPurchasePrice] = useState(editingAsset?.purchasePrice.toString() ?? "");
  const [purchaseDate, setPurchaseDate] = useState(editingAsset?.purchaseDate ?? getDefaultDateForFinancialYear(state.settings.financialYear));
  const [effectiveLife, setEffectiveLife] = useState((editingAsset?.effectiveLifeYears ?? ASSET_EFFECTIVE_LIVES.laptop.years).toString());
  const [depreciationMethod, setDepreciationMethod] =
    useState<DepreciationMethod>(editingAsset?.depreciationMethod ?? state.settings.depreciationMethod);
  const [workUsePercent, setWorkUsePercent] = useState((editingAsset?.workUsePercent ?? state.settings.defaultWorkUsePercent).toString());

  const handleAssetTypeChange = (value: string | null) => {
    if (!value) return;
    const next = value as AssetType;
    setAssetType(next);
    setEffectiveLife(ASSET_EFFECTIVE_LIVES[next].years.toString());
    if (!name || Object.values(ASSET_EFFECTIVE_LIVES).some((item) => item.label === name)) {
      setName(ASSET_EFFECTIVE_LIVES[next].label);
    }
  };

  const price = parseFloat(purchasePrice);
  const showThresholdWarning = !isNaN(price) && price <= INSTANT_DEDUCTION_THRESHOLD;
  const financialYear = editingAsset?.financialYear ?? state.settings.financialYear;
  const fyRange = FY_DATE_RANGES[financialYear];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await action.run(async () => {
    const numPrice = parseFloat(purchasePrice);
    const numWorkUse = parseFloat(workUsePercent);
    const numLife = parseFloat(effectiveLife);
    if (!Number.isFinite(numPrice) || numPrice <= 0 ||
        !Number.isFinite(numWorkUse) || numWorkUse < 0 || numWorkUse > 100 ||
        !Number.isFinite(numLife) || numLife < 1) return;

    const asset: DepreciatingAsset = {
      id: recordId.current,
      name: name.trim(),
      assetType,
      purchaseDate,
      purchasePrice: numPrice,
      effectiveLifeYears: numLife,
      depreciationMethod,
      workUsePercent: numWorkUse,
      financialYear,
      createdAt: editingAsset?.createdAt || new Date().toISOString(),
    };

    if (editingAsset) {
      await updateAsset(asset);
    } else {
      await addAsset(asset);
    }

    onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !action.busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingAsset ? "Edit Asset" : "Add Depreciating Asset"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
          <div className="space-y-2">
            <Label htmlFor="asset-type">Asset Type</Label>
            <Select
              value={assetType}
              onValueChange={handleAssetTypeChange}
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
                {financialYear} runs from {fyRange.start} to {fyRange.end}.
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
                required
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

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={action.busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={action.busy}>
              {editingAsset ? "Update" : "Add Asset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
