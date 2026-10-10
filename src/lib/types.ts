export type FinancialYear = "2024-25" | "2025-26" | "2026-27";

export type ClaimType = "full" | "depreciation";

export type DepreciationMethod = "diminishing" | "prime_cost";

export type WfhMethod = "fixed_rate" | "actual_cost";

export type ExpenseCategory =
  | "computer_equipment"
  | "software_subscriptions"
  | "internet_phone"
  | "electricity"
  | "stationery_consumables"
  | "office_furniture"
  | "professional_development"
  | "union_fees"
  | "tools_equipment"
  | "clothing"
  | "travel"
  | "car_km"
  | "donations"
  | "tax_affairs"
  | "other";

export type AssetType =
  | "laptop"
  | "desktop"
  | "monitor"
  | "desk"
  | "office_chair"
  | "headphones"
  | "keyboard_mouse"
  | "printer"
  | "webcam"
  | "microphone"
  | "external_drive"
  | "other";

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  claimType: ClaimType;
  workUsePercent: number;
  claimableAmount: number;
  /** Evidence and asset are saved in one transaction. */
  assetId?: string;
  /** Blank identifiers from older records belong to the default car. */
  carId?: string;
  kilometres?: number;
  receiptDataUrl?: string;
  /** Cloud mode: list queries omit the receipt payload and set this instead;
   *  fetch the image on demand via neonGetExpenseReceipt. */
  hasReceipt?: boolean;
  /** Null keeps legacy records undecided; an explicit decision syncs across devices. */
  reviewStatus?: "pending" | "reviewed" | "personal" | null;
  notes?: string;
  financialYear: FinancialYear;
  createdAt: string;
}

export interface DepreciatingAsset {
  id: string;
  name: string;
  assetType: AssetType;
  purchaseDate: string;
  purchasePrice: number;
  effectiveLifeYears: number;
  depreciationMethod: DepreciationMethod;
  workUsePercent: number;
  financialYear: FinancialYear;
  createdAt: string;
}

export interface WfhEntry {
  id: string;
  date: string;
  hours: number;
  financialYear: FinancialYear;
}

export interface WfhActualCost {
  id: string;
  category: string;
  annualCost: number;
  workUsePercent: number;
  financialYear: FinancialYear;
}

export interface RentalProperty {
  id: string;
  address: string;
  ownershipPercent: number;
  acquiredDate?: string;
  notes?: string;
  createdAt: string;
}

export type RentalTransactionKind = "income" | "expense";

export type RentalCategory =
  | "rent"
  | "other_income"
  | "loan_interest"
  | "council_rates"
  | "water_charges"
  | "insurance"
  | "property_agent_fees"
  | "repairs_maintenance"
  | "cleaning"
  | "advertising"
  | "land_tax"
  | "body_corporate"
  | "legal_accounting"
  | "other_expense";

export interface RentalTransaction {
  id: string;
  propertyId: string;
  date: string;
  kind: RentalTransactionKind;
  category: RentalCategory;
  description: string;
  amount: number;
  /** Expense-only apportionment before the property's ownership share. */
  deductiblePercent: number;
  financialYear: FinancialYear;
  notes?: string;
  createdAt: string;
}

export interface UserSettings {
  financialYear: FinancialYear;
  annualIncome: number;
  occupation: string;
  taxResidentStatus: "resident" | "non_resident" | "working_holiday";
  defaultWorkUsePercent: number;
  wfhMethod: WfhMethod;
  depreciationMethod: DepreciationMethod;
  /** Compulsory HELP/HECS repayment falls with taxable income — deductions cut it too. */
  hasHelpDebt: boolean;
  /** No hospital cover above the MLS threshold means an extra 1–1.5%. */
  hasPrivateHospitalCover: boolean;
  taxOptions?: TaxOptions;
  /** Lodging progress per financial year (see lib/tax-time.ts). */
  taxTime?: Partial<Record<FinancialYear, TaxTimeRecord>>;
}

export type RunningCostBill = "electricity" | "phone" | "internet";

export interface TaxTimeRecord {
  /** Total tax withheld, from the income statement. */
  taxWithheld?: number;
  /** One bill held for each running cost the 70c rate covers. */
  bills?: Partial<Record<RunningCostBill, boolean>>;
  /** Mondays of weeks spent in the office or on leave, so they aren't gaps. */
  awayWeeks?: string[];
  /** Days added by "fill from usual week", told apart from days logged at the time. */
  filledDays?: string[];
  /** myTax items already typed in during Lodge mode. */
  entered?: string[];
  lodgedAt?: string;
}

export interface TaxOptions {
  reportableSuperContributions?: number;
  reportableFringeBenefits?: number;
  exemptForeignEmploymentIncome?: number;
  otherNetInvestmentLosses?: number;
  helpDebtBalance?: number;
  medicareExempt?: boolean;
  workingHolidayResident?: boolean;
  workingHolidayTreatyResident?: boolean;
}

export type CgtAssetKind = "crypto" | "share";

/**
 * One side of one trade. Holdings, parcels and gains are all derived from
 * these — there is no separate holdings table to drift out of sync.
 * No financialYear field on purpose: the FY of a disposal comes from its date.
 */
export interface CgtTransaction {
  id: string;
  kind: CgtAssetKind;
  /** Ticker or symbol, uppercased: "BTC", "CBA". */
  asset: string;
  side: "buy" | "sell";
  date: string;
  quantity: number;
  /** AUD per unit at the time of the trade. */
  unitPrice: number;
  /** Brokerage or network fee in AUD. Adds to cost base, reduces proceeds. */
  fee: number;
  notes?: string;
  createdAt: string;
}

export interface TaxSummary {
  totalExpenses: number;
  totalFullClaims: number;
  totalDepreciationClaims: number;
  totalWfhDeduction: number;
  totalDeductions: number;
  estimatedTaxSaved: number;
  /** Net capital gain for the year, after losses and the 50% discount. */
  netCapitalGain: number;
  rentalIncome: number;
  rentalDeductions: number;
  netRentalResult: number;
  taxableIncome: number;
  taxPayable: number;
  taxPayableWithoutDeductions: number;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  count: number;
}

export interface ReceiptScanResult {
  itemName: string;
  amount: number;
  date: string;
  storeName: string;
  suggestedCategory: ExpenseCategory;
  claimType: ClaimType;
  isRelevantToOccupation: boolean;
  relevanceExplanation: string;
  claimAdvice: string;
  suggestedWorkUsePercent: number;
  rawItems?: string[];
  suggestedAssetType?: AssetType;
  suggestedEffectiveLife?: number;
  suggestedDepreciationMethod?: DepreciationMethod;
  depreciationExplanation?: string;
  modelUsed?: string;
}
