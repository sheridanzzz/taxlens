import { CAR_KM_CAP, CAR_RATE_PER_KM, DEPRECIABLE_CATEGORIES, INSTANT_DEDUCTION_THRESHOLD } from "./constants";
import type { DepreciatingAsset, Expense, ExpenseCategory } from "./types";
import { isWfhRunningCost } from "./wfh-running-costs";

export const mustDepreciate = (amount: number, category: ExpenseCategory, description = "") =>
  amount > INSTANT_DEDUCTION_THRESHOLD && DEPRECIABLE_CATEGORIES.includes(category) &&
  !isWfhRunningCost({ category, description });

export const findLinkedAsset = (e: Expense, assets: DepreciatingAsset[], expenses: Expense[]) => {
  if (e.assetId) return assets.find((a) => a.id === e.assetId);
  if (e.claimType !== "depreciation") return undefined;
  const matches = assets.filter((a) => a.name.trim().toLowerCase() === e.description.trim().toLowerCase() &&
    a.purchaseDate === e.date && a.purchasePrice === e.amount);
  if (matches.length !== 1 || expenses.some((other) => other.id !== e.id &&
    (other.assetId === matches[0].id || (other.claimType === "depreciation" &&
      other.description.trim().toLowerCase() === e.description.trim().toLowerCase() &&
      other.date === e.date && other.amount === e.amount)))) return undefined;
  return matches[0];
};

/** Allocate one cap per car/year in stable date order, including legacy rows. */
export const applyCarClaimCaps = (expenses: Expense[]): Expense[] => {
  const remaining = new Map<string, number>();
  const claims = new Map<string, number>();
  const ordered = [...expenses].sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const e of ordered) {
    if (e.category !== "car_km") continue;
    const key = `${e.financialYear}:${e.carId?.trim().toUpperCase() || "DEFAULT"}`;
    const rate = CAR_RATE_PER_KM[e.financialYear];
    const km = Math.max(0, e.kilometres ?? e.amount / rate);
    const available = remaining.get(key) ?? CAR_KM_CAP;
    const eligible = e.claimType === "full" && e.workUsePercent > 0;
    const claimedKm = eligible ? Math.min(km, available) : 0;
    remaining.set(key, available - claimedKm);
    claims.set(e.id, Math.round(claimedKm * rate * 100) / 100);
  }
  return expenses.map((e) => claims.has(e.id) ? { ...e, claimableAmount: claims.get(e.id)! } : e);
};
