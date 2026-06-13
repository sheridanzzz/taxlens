"use client";

import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { formatCurrency } from "@/lib/tax-calculator";
import { getDepreciationSchedule, calculateDiminishingValue, calculatePrimeCost } from "@/lib/depreciation";
import type { DepreciatingAsset } from "@/lib/types";

interface DepreciationChartProps {
  asset: DepreciatingAsset;
  currentFy: string;
}

export const DepreciationChart = ({ asset, currentFy }: DepreciationChartProps) => {
  const schedule = getDepreciationSchedule(asset);

  if (schedule.length === 0) return null;

  const currentFyLabel = `FY ${currentFy}`;
  const totalClaimable = schedule.reduce((sum, r) => sum + r.deduction, 0);
  const maxDeduction = Math.max(...schedule.map((r) => r.deduction));

  const tips = useMemo(() => {
    const result: string[] = [];
    const altMethod = asset.depreciationMethod === "diminishing" ? "prime_cost" : "diminishing";
    const altFirstYear =
      altMethod === "diminishing"
        ? calculateDiminishingValue(asset.purchasePrice, asset.effectiveLifeYears, 365, 0) * (asset.workUsePercent / 100)
        : calculatePrimeCost(asset.purchasePrice, asset.effectiveLifeYears, 365) * (asset.workUsePercent / 100);
    const currentFirstYear = schedule[0]?.deduction ?? 0;

    if (altFirstYear > currentFirstYear) {
      result.push(
        `Switching to ${altMethod === "diminishing" ? "Diminishing Value" : "Prime Cost"} would give you ${formatCurrency(altFirstYear - currentFirstYear)} more in the first full year.`
      );
    }

    if (asset.workUsePercent < 100) {
      result.push(
        `If your work use increases, update the percentage to claim more. Keep records to justify the change.`
      );
    }

    if (schedule.length > 0) {
      const lastYear = schedule[schedule.length - 1];
      if (lastYear.remaining > 0 && lastYear.remaining < 300) {
        result.push(
          `When the remaining value drops below $300, you can write off the entire balance in that year (low-value pool rule).`
        );
      }
    }

    result.push(
      `If you dispose of this asset before it's fully depreciated, you may need to include a balancing adjustment in your return.`
    );

    return result;
  }, [asset, schedule]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium">Deduction schedule</p>
        <p className="text-[11px] text-muted-foreground">
          Total: <span className="stat-number font-semibold text-foreground">{formatCurrency(totalClaimable)}</span>
          <span className="text-muted-foreground/50"> over {schedule.length} yrs</span>
        </p>
      </div>

      <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
        {schedule.map((row) => {
          const isCurrent = row.year === currentFyLabel;
          const heightPct = maxDeduction > 0 ? (row.deduction / maxDeduction) * 100 : 0;

          return (
            <div
              key={row.year}
              className="group relative flex flex-1 flex-col items-center"
              style={{ height: "100%" }}
            >
              <div className="relative mt-auto w-full" style={{ height: `${Math.max(heightPct, 2)}%` }}>
                <div
                  className={`absolute inset-0 rounded-t-[3px] transition-opacity ${
                    isCurrent
                      ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                      : "bg-gradient-to-t from-primary/25 to-primary/10 group-hover:from-primary/40 group-hover:to-primary/20"
                  }`}
                />
                <div
                  className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[9px] font-medium text-popover-foreground opacity-0 shadow-lg ring-1 ring-border/50 transition-opacity group-hover:opacity-100"
                  role="tooltip"
                >
                  {formatCurrency(row.deduction)}
                </div>
              </div>
              <span className={`mt-1.5 text-[8px] leading-none ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground/50"}`}>
                {row.year.replace("FY ", "").split("-")[0]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/40">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 bg-muted/30 px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
          <span>Financial Year</span>
          <span className="text-right">Deduction</span>
          <span className="text-right">Remaining</span>
        </div>
        <div className="divide-y divide-border/30">
          {schedule.map((row) => {
            const isCurrent = row.year === currentFyLabel;
            return (
              <div
                key={row.year}
                className={`grid grid-cols-[1fr_auto_auto] gap-x-6 px-3 py-1.5 text-[11px] transition-colors ${
                  isCurrent ? "bg-primary/5" : "hover:bg-muted/20"
                }`}
              >
                <span className={isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {row.year}
                  {isCurrent && (
                    <span className="ml-1.5 inline-block rounded-sm bg-primary/10 px-1 py-px text-[8px] font-medium text-primary">
                      current
                    </span>
                  )}
                </span>
                <span className={`stat-number text-right ${isCurrent ? "font-semibold text-primary" : "font-medium"}`}>
                  {formatCurrency(row.deduction)}
                </span>
                <span className="stat-number text-right text-muted-foreground/60">
                  {formatCurrency(row.remaining)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {tips.length > 0 && (
        <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
            <Lightbulb className="h-3 w-3" />
            Tips to maximize savings
          </div>
          <ul className="mt-1.5 space-y-1 pl-[18px]">
            {tips.map((tip, i) => (
              <li key={i} className="text-[10px] leading-relaxed text-muted-foreground list-disc">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
