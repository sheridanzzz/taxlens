"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
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
import { useTax } from "@/context/tax-context";
import { formatCurrency } from "@/lib/tax-calculator";
import type { CgtAssetKind, CgtTransaction } from "@/lib/types";

interface TradeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: CgtTransaction | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export const TradeForm = ({ open, onOpenChange, editing }: TradeFormProps) => {
  const { addCgtTransaction } = useTax();

  // seeded once on mount — the page remounts this per trade rather than
  // syncing props into state with an effect
  const [kind, setKind] = useState<CgtAssetKind>(editing?.kind ?? "crypto");
  const [asset, setAsset] = useState(editing?.asset ?? "");
  const [side, setSide] = useState<"buy" | "sell">(editing?.side ?? "buy");
  const [date, setDate] = useState(editing?.date ?? today());
  const [quantity, setQuantity] = useState(editing?.quantity.toString() ?? "");
  const [unitPrice, setUnitPrice] = useState(editing?.unitPrice.toString() ?? "");
  const [fee, setFee] = useState(editing?.fee.toString() ?? "");

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const fees = parseFloat(fee) || 0;
  const total = side === "buy" ? qty * price + fees : qty * price - fees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset.trim() || qty <= 0 || price <= 0) return;

    await addCgtTransaction({
      id: editing?.id ?? uuidv4(),
      kind,
      asset: asset.trim().toUpperCase(),
      side,
      date,
      quantity: qty,
      unitPrice: price,
      fee: fees,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit trade" : "Add trade"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trade-kind">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CgtAssetKind)}>
                <SelectTrigger id="trade-kind">
                  <span>{kind === "crypto" ? "Crypto" : "Shares"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="share">Shares</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-asset">
                {kind === "crypto" ? "Coin" : "Ticker"}
              </Label>
              <Input
                id="trade-asset"
                placeholder={kind === "crypto" ? "BTC" : "CBA"}
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-side">Side</Label>
              <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
                <SelectTrigger id="trade-side">
                  <span>{side === "buy" ? "Buy" : "Sell"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-date">Date</Label>
              <Input
                id="trade-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-qty">Quantity</Label>
              <Input
                id="trade-qty"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-price">Price per unit (AUD)</Label>
              <Input
                id="trade-price"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-fee">Fee / brokerage (AUD)</Label>
              <Input
                id="trade-fee"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {side === "buy"
              ? `Cost base: ${formatCurrency(total)} — the fee adds to it.`
              : `Proceeds: ${formatCurrency(total)} — the fee comes off.`}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Update" : "Add trade"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
