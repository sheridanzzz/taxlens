import type { DepreciatingAsset, FinancialYear } from "./types";

/**
 * Diminishing value: deduction = base value × (days held ÷ 365) × (200% ÷ effective life)
 * Prime cost: deduction = cost × (days held ÷ 365) × (100% ÷ effective life)
 */

const getFyRange = (fy: string): { start: Date; end: Date } => {
  const startYear = parseInt(fy.split("-")[0]);
  return {
    start: new Date(`${startYear}-07-01`),
    end: new Date(`${startYear + 1}-06-30`),
  };
};

export const getDaysInFinancialYear = (
  purchaseDate: string,
  financialYear: string
): number => {
  const { start: fyStart, end: fyEnd } = getFyRange(financialYear);
  const purchase = new Date(purchaseDate);

  if (purchase > fyEnd) return 0;

  const startDate = purchase > fyStart ? purchase : fyStart;
  const diffTime = fyEnd.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/** The FY immediately before this one, e.g. "2025-26" -> "2024-25". */
const previousFy = (financialYear: string): string => {
  const startYear = Number(financialYear.slice(0, 4)) - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
};

export const calculateDiminishingValue = (
  baseValue: number,
  effectiveLife: number,
  daysHeld: number
): number => baseValue * (daysHeld / 365) * (2 / effectiveLife);

export const calculatePrimeCost = (
  cost: number,
  effectiveLife: number,
  daysHeld: number
): number => {
  const rate = 1 / effectiveLife;
  return cost * (daysHeld / 365) * rate;
};

export const calculateCurrentYearDepreciation = (
  asset: DepreciatingAsset,
  financialYear: FinancialYear
): number => {
  const daysHeld = getDaysInFinancialYear(asset.purchaseDate, financialYear);
  if (daysHeld <= 0) return 0;

  // Opening value = whatever was left at the end of last FY. Counting whole
  // calendar years elapsed got this wrong for anything bought mid-year, which
  // understated the write-down and so overstated the deduction from year 3 on.
  const opening = calculateRemainingValue(
    asset,
    previousFy(financialYear) as FinancialYear
  );
  if (opening <= 0) return 0;

  const deduction =
    asset.depreciationMethod === "diminishing"
      ? calculateDiminishingValue(opening, asset.effectiveLifeYears, daysHeld)
      : calculatePrimeCost(asset.purchasePrice, asset.effectiveLifeYears, daysHeld);

  // never claim past the asset's remaining value
  const workPortion = (Math.min(deduction, opening) * asset.workUsePercent) / 100;
  return Math.round(workPortion * 100) / 100;
};

export const calculateRemainingValue = (
  asset: DepreciatingAsset,
  financialYear: FinancialYear
): number => {
  const { end: fyEnd } = getFyRange(financialYear);
  const purchase = new Date(asset.purchaseDate);

  if (purchase > fyEnd) return asset.purchasePrice;

  let remaining = asset.purchasePrice;
  const rate =
    asset.depreciationMethod === "diminishing"
      ? 2 / asset.effectiveLifeYears
      : 1 / asset.effectiveLifeYears;

  const fyStartYear = parseInt(financialYear.split("-")[0]);
  const purchaseYear = purchase.getFullYear();
  const loopStart = purchase.getMonth() >= 6 ? purchaseYear : purchaseYear - 1;

  for (let year = loopStart; year <= fyStartYear; year++) {
    const currentFy = `${year}-${(year + 1).toString().slice(2)}`;
    const days = getDaysInFinancialYear(asset.purchaseDate, currentFy);
    if (days <= 0) continue;

    if (asset.depreciationMethod === "diminishing") {
      remaining -= remaining * (days / 365) * rate;
    } else {
      remaining -= asset.purchasePrice * (days / 365) * rate;
    }

    if (remaining <= 0) return 0;
  }

  return Math.round(Math.max(0, remaining) * 100) / 100;
};

export const getDepreciationSchedule = (
  asset: DepreciatingAsset
): { year: string; deduction: number; remaining: number }[] => {
  const schedule: { year: string; deduction: number; remaining: number }[] = [];
  const purchase = new Date(asset.purchaseDate);
  // the FY the asset was bought in — Jul-Dec starts that FY, Jan-Jun the last
  // one. Using the calendar year skipped the first year for anything bought
  // between January and June.
  const startYear =
    purchase.getMonth() >= 6 ? purchase.getFullYear() : purchase.getFullYear() - 1;

  for (let i = 0; i <= Math.ceil(asset.effectiveLifeYears); i++) {
    const year = startYear + i;
    const fy = `${year}-${(year + 1).toString().slice(2)}` as FinancialYear;
    const remaining = calculateRemainingValue(asset, fy);

    schedule.push({
      year: `FY ${fy}`,
      deduction: calculateCurrentYearDepreciation(asset, fy),
      remaining,
    });

    if (remaining <= 0) break;
  }

  return schedule;
};
