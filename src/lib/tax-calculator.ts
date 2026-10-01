import {
  TAX_BRACKETS,
  MEDICARE_LEVY_RATE,
  WFH_FIXED_RATE_PER_HOUR,
  MLS_TIERS,
  HELP_THRESHOLDS,
  MEDICARE_LOW_INCOME_THRESHOLD,
  HELP_2024_25_BANDS,
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
  WfhMethod,
  UserSettings,
  TaxOptions,
} from "./types";
import { applyCarClaimCaps } from "./expense-claims";
import { EXPENSE_CATEGORIES } from "./constants";
import { calculateCurrentYearDepreciation } from "./depreciation";

/** Extra liabilities that also move when deductions move. */
export interface LiabilityOptions extends TaxOptions {
  hasHelpDebt?: boolean;
  hasPrivateHospitalCover?: boolean;
  netRentalLoss?: number;
}

type Residency = boolean | UserSettings["taxResidentStatus"];
const residentRates = (status: Residency, options: LiabilityOptions) =>
  status === true || status === "resident" ||
  (status === "working_holiday" && !!options.workingHolidayResident && !!options.workingHolidayTreatyResident);

export const calculateLowIncomeTaxOffset = (income: number): number => {
  if (income <= 37500) return 700;
  if (income <= 45000) return 700 - (income - 37500) * 0.05;
  return Math.max(0, 325 - (income - 45000) * 0.015);
};

export const calculateMedicareLevy = (income: number, fy: FinancialYear): number =>
  Math.max(0, Math.min(income * MEDICARE_LEVY_RATE,
    (income - MEDICARE_LOW_INCOME_THRESHOLD[fy]) * 0.1));

const investmentAddbacks = (o: LiabilityOptions) => Math.max(0, o.netRentalLoss ?? 0) +
  Math.max(0, o.otherNetInvestmentLosses ?? 0);
const commonAddbacks = (o: LiabilityOptions) => investmentAddbacks(o) +
  Math.max(0, o.reportableFringeBenefits ?? 0) + Math.max(0, o.reportableSuperContributions ?? 0);

/** Medicare levy surcharge — 0 with hospital cover or under the tier 1 floor. */
export const calculateMls = (
  taxableIncome: number,
  financialYear: FinancialYear,
  hasPrivateHospitalCover: boolean,
  incomeForThreshold: number = taxableIncome
): number => {
  if (hasPrivateHospitalCover) return 0;
  const tier = MLS_TIERS[financialYear].find((t) => incomeForThreshold > t.over);
  return tier ? taxableIncome * tier.rate : 0;
};

/** Compulsory HELP/HECS repayment for the year. */
export const calculateHelpRepayment = (
  taxableIncome: number,
  financialYear: FinancialYear,
  debtBalance: number = Infinity
): number => {
  if (financialYear === "2024-25") {
    const band = HELP_2024_25_BANDS.find((b) => taxableIncome > b.over);
    return Math.min(Math.max(0, debtBalance), band ? taxableIncome * band.rate : 0);
  }
  // marginal system: rate applies only to income above each step
  const { minimum, upper } = HELP_THRESHOLDS[financialYear];
  const marginal = Math.max(0, Math.min(taxableIncome, upper) - minimum) * 0.15 +
    Math.max(0, taxableIncome - upper) * 0.17;
  return Math.min(marginal, Math.max(0, taxableIncome) * 0.1, Math.max(0, debtBalance));
};

export const calculateTaxPayable = (
  taxableIncome: number,
  financialYear: FinancialYear,
  isResident: Residency = true,
  options: LiabilityOptions = {}
): number => {
  taxableIncome = Math.max(0, taxableIncome);

  const useResidentRates = residentRates(isResident, options);
  const standardWhm = isResident === "working_holiday" && !useResidentRates;
  const brackets = useResidentRates ? TAX_BRACKETS[financialYear] : standardWhm ? [
    { min: 1, max: 45000, rate: 0.15, base: 0 },
    { min: 45001, max: 135000, rate: 0.3, base: 6750 },
    { min: 135001, max: 190000, rate: 0.37, base: 33750 },
    { min: 190001, max: Infinity, rate: 0.45, base: 54100 },
  ] : [
    { min: 1, max: 135000, rate: 0.3, base: 0 },
    { min: 135001, max: 190000, rate: 0.37, base: 40500 },
    { min: 190001, max: Infinity, rate: 0.45, base: 60850 },
  ];
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.max) {
        tax = bracket.base + (taxableIncome - bracket.min + 1) * bracket.rate;
        break;
    }
  }

  if (useResidentRates) tax = Math.max(0, tax - calculateLowIncomeTaxOffset(taxableIncome));

  const medicareResident = useResidentRates ||
    (isResident === "working_holiday" && !!options.workingHolidayResident);
  if (medicareResident && !options.medicareExempt) {
    tax += calculateMedicareLevy(taxableIncome, financialYear);
    tax += calculateMls(
      taxableIncome + Math.max(0, options.reportableFringeBenefits ?? 0),
      financialYear,
      !!options.hasPrivateHospitalCover,
      taxableIncome + commonAddbacks(options)
    );
  }

  if (options.hasHelpDebt) {
    tax += calculateHelpRepayment(taxableIncome + commonAddbacks(options) +
      Math.max(0, options.exemptForeignEmploymentIncome ?? 0), financialYear, options.helpDebtBalance);
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

// The 70c fixed rate already covers power, internet, phone and stationery, so
// Internet & Phone expenses can't be claimed on top of it — the single most
// common WFH adjustment the ATO makes. On the actual-cost method they count.
export const isCoveredByFixedRate = (
  expense: Pick<Expense, "category">,
  wfhMethod: WfhMethod
) =>
  wfhMethod === "fixed_rate" && expense.category === "internet_phone";

export const calculateTotalExpenseDeductions = (
  expenses: Expense[],
  wfhMethod: WfhMethod
): number => {
  return applyCarClaimCaps(expenses)
    .filter((e) => e.claimType === "full" && !isCoveredByFixedRate(e, wfhMethod))
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
  isResident: Residency = true,
  options: LiabilityOptions = {},
  /** Already netted and discounted — see lib/cgt.ts. Adds to taxable income. */
  netCapitalGain: number = 0,
  /** Ownership-adjusted assessable rent received. */
  rentalIncome: number = 0,
  /** Ownership and private-use adjusted rental expenses. */
  rentalDeductions: number = 0
): TaxSummary => {
  const totalFullClaims = calculateTotalExpenseDeductions(expenses, wfhMethod);
  const liabilityOptions = { ...options, netRentalLoss: Math.max(0, rentalDeductions - rentalIncome) };
  const totalDepreciationClaims = calculateTotalDepreciationDeductions(
    assets,
    financialYear
  );

  const totalWfhDeduction =
    wfhMethod === "fixed_rate"
      ? calculateWfhDeductionFixedRate(wfhEntries)
      : calculateWfhDeductionActualCost(wfhActualCosts);

  const totalDeductions =
    totalFullClaims +
    totalDepreciationClaims +
    totalWfhDeduction +
    rentalDeductions;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // a capital gain is assessable income, so it sits on top of salary before
  // deductions come off — and it can push you into a higher bracket, which is
  // exactly when a deduction is worth most
  const grossIncome = annualIncome + netCapitalGain + rentalIncome;
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);
  const taxPayable = calculateTaxPayable(
    taxableIncome,
    financialYear,
    isResident,
    liabilityOptions
  );
  const taxPayableWithoutDeductions = calculateTaxPayable(
    grossIncome,
    financialYear,
    isResident,
    options
  );
  const estimatedTaxSaved = taxPayableWithoutDeductions - taxPayable;

  return {
    totalExpenses,
    totalFullClaims,
    totalDepreciationClaims,
    totalWfhDeduction,
    totalDeductions,
    estimatedTaxSaved: Math.round(estimatedTaxSaved * 100) / 100,
    netCapitalGain,
    rentalIncome,
    rentalDeductions,
    netRentalResult: Math.round((rentalIncome - rentalDeductions) * 100) / 100,
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
  wfhMethod: WfhMethod,
  assets?: DepreciatingAsset[],
  financialYear?: FinancialYear
): CategoryBreakdown[] => {
  const map = new Map<ExpenseCategory, { amount: number; count: number }>();

  for (const expense of applyCarClaimCaps(expenses)) {
    if (isCoveredByFixedRate(expense, wfhMethod)) continue;
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
