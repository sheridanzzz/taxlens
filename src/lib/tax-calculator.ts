import {
  TAX_BRACKETS,
  MEDICARE_LEVY_RATE,
  WFH_FIXED_RATE_PER_HOUR,
} from "./constants";
import type {
  FinancialYear,
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  TaxSummary,
  CategoryBreakdown,
  ExpenseCategory,
} from "./types";
import { EXPENSE_CATEGORIES } from "./constants";
import { calculateCurrentYearDepreciation } from "./depreciation";

export const calculateTaxPayable = (
  taxableIncome: number,
  financialYear: FinancialYear,
  isResident: boolean = true
): number => {
  if (taxableIncome <= 0) return 0;

  const brackets = TAX_BRACKETS[financialYear];
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome >= bracket.min) {
      if (taxableIncome <= bracket.max) {
        tax = bracket.base + (taxableIncome - bracket.min + 1) * bracket.rate;
        break;
      }
    }
  }

  if (isResident && taxableIncome > 18200) {
    tax += taxableIncome * MEDICARE_LEVY_RATE;
  }

  return Math.round(tax * 100) / 100;
};

export const calculateWfhDeductionFixedRate = (
  entries: WfhEntry[]
): number => {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  return Math.round(totalHours * WFH_FIXED_RATE_PER_HOUR * 100) / 100;
};

export const calculateWfhDeductionActualCost = (
  costs: WfhActualCost[]
): number => {
  return costs.reduce(
    (sum, c) => sum + (c.annualCost * c.workUsePercent) / 100,
    0
  );
};

export const calculateTotalExpenseDeductions = (
  expenses: Expense[]
): number => {
  return expenses
    .filter((e) => e.claimType === "full")
    .reduce((sum, e) => sum + e.claimableAmount, 0);
};

export const calculateTotalDepreciationDeductions = (
  assets: DepreciatingAsset[],
  financialYear: FinancialYear
): number => {
  return assets.reduce((sum, asset) => {
    const yearDeduction = calculateCurrentYearDepreciation(asset, financialYear);
    return sum + yearDeduction;
  }, 0);
};

export const calculateTaxSummary = (
  expenses: Expense[],
  assets: DepreciatingAsset[],
  wfhEntries: WfhEntry[],
  wfhActualCosts: WfhActualCost[],
  annualIncome: number,
  financialYear: FinancialYear,
  wfhMethod: "fixed_rate" | "actual_cost",
  isResident: boolean = true
): TaxSummary => {
  const totalFullClaims = calculateTotalExpenseDeductions(expenses);
  const totalDepreciationClaims = calculateTotalDepreciationDeductions(
    assets,
    financialYear
  );

  const totalWfhDeduction =
    wfhMethod === "fixed_rate"
      ? calculateWfhDeductionFixedRate(wfhEntries)
      : calculateWfhDeductionActualCost(wfhActualCosts);

  const totalDeductions =
    totalFullClaims + totalDepreciationClaims + totalWfhDeduction;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const taxableIncome = Math.max(0, annualIncome - totalDeductions);
  const taxPayable = calculateTaxPayable(taxableIncome, financialYear, isResident);
  const taxPayableWithoutDeductions = calculateTaxPayable(
    annualIncome,
    financialYear,
    isResident
  );
  const estimatedTaxSaved = taxPayableWithoutDeductions - taxPayable;

  return {
    totalExpenses,
    totalFullClaims,
    totalDepreciationClaims,
    totalWfhDeduction,
    totalDeductions,
    estimatedTaxSaved: Math.round(estimatedTaxSaved * 100) / 100,
    taxableIncome,
    taxPayable,
    taxPayableWithoutDeductions,
  };
};

const ASSET_TYPE_TO_CATEGORY: Record<string, ExpenseCategory> = {
  laptop: "computer_equipment",
  desktop: "computer_equipment",
  monitor: "computer_equipment",
  keyboard_mouse: "computer_equipment",
  webcam: "computer_equipment",
  microphone: "computer_equipment",
  external_drive: "computer_equipment",
  headphones: "computer_equipment",
  printer: "computer_equipment",
  desk: "office_furniture",
  office_chair: "office_furniture",
  other: "other",
};

export const getCategoryBreakdown = (
  expenses: Expense[],
  assets?: DepreciatingAsset[],
  financialYear?: FinancialYear
): CategoryBreakdown[] => {
  const map = new Map<ExpenseCategory, { amount: number; count: number }>();

  for (const expense of expenses) {
    const existing = map.get(expense.category) || { amount: 0, count: 0 };
    map.set(expense.category, {
      amount: existing.amount + expense.claimableAmount,
      count: existing.count + 1,
    });
  }

  if (assets && financialYear) {
    for (const asset of assets) {
      const category = ASSET_TYPE_TO_CATEGORY[asset.assetType] ?? "other";
      const yearDeduction = calculateCurrentYearDepreciation(asset, financialYear);
      const existing = map.get(category) || { amount: 0, count: 0 };
      map.set(category, {
        amount: existing.amount + yearDeduction,
        count: existing.count + 1,
      });
    }
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      label: EXPENSE_CATEGORIES[category].label,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
};

export const MONTH_LABELS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

// Deductions bucketed per FY month (Jul..Jun). Full-claim expenses and WFH
// at their entry date; asset depreciation at purchase month (prior-year
// purchases land in Jul, the start of the FY the claim accrues from).
export const getMonthlyDeductionTotals = (
  expenses: Expense[],
  assets: DepreciatingAsset[],
  wfhEntries: WfhEntry[],
  wfhMethod: "fixed_rate" | "actual_cost",
  financialYear: FinancialYear
): { month: string; key: string; amount: number }[] => {
  const startYear = Number(financialYear.slice(0, 4));
  const keys = MONTH_LABELS.map((_, i) => {
    const m = ((i + 6) % 12) + 1;
    const y = m >= 7 ? startYear : startYear + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });

  const totals = new Map(keys.map((k) => [k, 0]));
  for (const e of expenses) {
    if (e.claimType !== "full") continue;
    const k = e.date.slice(0, 7);
    if (totals.has(k)) totals.set(k, totals.get(k)! + e.claimableAmount);
  }
  if (wfhMethod === "fixed_rate") {
    for (const w of wfhEntries) {
      const k = w.date.slice(0, 7);
      if (totals.has(k))
        totals.set(k, totals.get(k)! + w.hours * WFH_FIXED_RATE_PER_HOUR);
    }
  }
  for (const a of assets) {
    const yearDeduction = calculateCurrentYearDepreciation(a, financialYear);
    if (yearDeduction <= 0) continue;
    const purchaseKey = a.purchaseDate.slice(0, 7);
    const k = totals.has(purchaseKey) ? purchaseKey : keys[0];
    totals.set(k, totals.get(k)! + yearDeduction);
  }

  return keys.map((key, i) => ({
    month: MONTH_LABELS[i],
    key,
    amount: Math.round(totals.get(key)! * 100) / 100,
  }));
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatPercent = (value: number): string => {
  return `${value}%`;
};
