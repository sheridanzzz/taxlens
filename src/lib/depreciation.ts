import type { DepreciatingAsset, DepreciationMethod, FinancialYear } from "./types";

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

const getYearsElapsed = (
  purchaseDate: string,
  financialYear: string
): number => {
  const { start: fyStart } = getFyRange(financialYear);
  const purchase = new Date(purchaseDate);

  if (purchase >= fyStart) return 0;

  const diffYears =
    (fyStart.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(diffYears);
};

export const calculateDiminishingValue = (
  cost: number,
  effectiveLife: number,
  daysHeld: number,
  yearsElapsed: number
): number => {
  const rate = 2 / effectiveLife;
  let baseValue = cost;

  for (let i = 0; i < yearsElapsed; i++) {
    baseValue -= baseValue * rate;
    if (baseValue <= 0) return 0;
  }

  return baseValue * (daysHeld / 365) * rate;
};

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

  const yearsElapsed = getYearsElapsed(asset.purchaseDate, financialYear);

  let deduction: number;

  if (asset.depreciationMethod === "diminishing") {
    deduction = calculateDiminishingValue(
      asset.purchasePrice,
      asset.effectiveLifeYears,
      daysHeld,
      yearsElapsed
    );
  } else {
    deduction = calculatePrimeCost(
      asset.purchasePrice,
      asset.effectiveLifeYears,
      daysHeld
    );
  }

  const workPortion = (deduction * asset.workUsePercent) / 100;
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
  const startYear = new Date(asset.purchaseDate).getFullYear();
  let remaining = asset.purchasePrice;

  const rate =
    asset.depreciationMethod === "diminishing"
      ? 2 / asset.effectiveLifeYears
      : 1 / asset.effectiveLifeYears;

  for (let i = 0; i < Math.ceil(asset.effectiveLifeYears) + 1; i++) {
    const year = startYear + i;
    const fy = `${year}-${(year + 1).toString().slice(2)}` as FinancialYear;
    const days = getDaysInFinancialYear(asset.purchaseDate, fy);
    if (days <= 0) continue;

    let deduction: number;
    if (asset.depreciationMethod === "diminishing") {
      deduction = remaining * (days / 365) * rate;
    } else {
      deduction = asset.purchasePrice * (days / 365) * rate;
    }

    deduction = Math.min(deduction, remaining);
    const workDeduction = (deduction * asset.workUsePercent) / 100;
    remaining = Math.max(0, remaining - deduction);

    schedule.push({
      year: `FY ${fy}`,
      deduction: Math.round(workDeduction * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
    });

    if (remaining <= 0) break;
  }

  return schedule;
};
