export type FinancialYear = "2024-25" | "2025-26" | "2026-27";

export type ClaimType = "full" | "depreciation";

export type DepreciationMethod = "diminishing" | "prime_cost";

export type WfhMethod = "fixed_rate" | "actual_cost";

export type ExpenseCategory =
  | "computer_equipment"
  | "software_subscriptions"
  | "internet_phone"
  | "office_furniture"
  | "professional_development"
  | "union_fees"
  | "tools_equipment"
  | "clothing"
  | "travel"
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
  receiptDataUrl?: string;
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

export interface UserSettings {
  financialYear: FinancialYear;
  annualIncome: number;
  occupation: string;
  taxResidentStatus: "resident" | "non_resident" | "working_holiday";
  defaultWorkUsePercent: number;
  wfhMethod: WfhMethod;
  depreciationMethod: DepreciationMethod;
}

export interface TaxSummary {
  totalExpenses: number;
  totalFullClaims: number;
  totalDepreciationClaims: number;
  totalWfhDeduction: number;
  totalDeductions: number;
  estimatedTaxSaved: number;
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
