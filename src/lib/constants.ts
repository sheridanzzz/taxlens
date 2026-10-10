import type {
  AssetType,
  Expense,
  ExpenseCategory,
  FinancialYear,
} from "./types";

// Plain helpers live here, not in utils.ts, so this file (and everything the
// iOS app shares from src/lib) stays free of web-only dependencies.

// YYYY-MM-DD in the user's own timezone. toISOString() is UTC, which is still
// yesterday in Australia until 10–11am — so local dates must never go through it.
export const toLocalDate = (d: Date = new Date()) => d.toLocaleDateString("en-CA")

// the receipt scanner stamps notes with "AI scan:" — single source of truth
// for the AI-scanned markers across dashboard, expenses KPI, and table rows
export const isAiScanned = (e: Pick<Expense, "notes">) => e.notes?.startsWith("AI scan:") ?? false

export const INSTANT_DEDUCTION_THRESHOLD = 300;

/**
 * Only physical kit hits the $300 rule. A $1,500 course, donation or agent fee
 * is deductible in full the year you pay it — it has no effective life.
 */
export const DEPRECIABLE_CATEGORIES: ExpenseCategory[] = [
  "computer_equipment",
  "office_furniture",
  "tools_equipment",
  "other",
];

// 70c/hr per ATO PCG 2023/1 (as amended) from FY 2024-25 onward.
// ponytail: scalar because the rate is identical across every supported FY;
// make it per-FY like TAX_BRACKETS when a year diverges.
export const WFH_FIXED_RATE_PER_HOUR = 0.70;

export const EXPENSE_CATEGORIES: Record<
  ExpenseCategory,
  { label: string; description: string; icon: string }
> = {
  computer_equipment: {
    label: "Computer Equipment & Peripherals",
    description: "Laptops, monitors, keyboards, mice, cables, adapters",
    icon: "Monitor",
  },
  software_subscriptions: {
    label: "Software & Subscriptions",
    description: "IDEs, cloud services, GitHub, domain names, hosting",
    icon: "Code",
  },
  internet_phone: {
    label: "Internet & Phone",
    description: "Work portion of internet and mobile phone bills",
    icon: "Wifi",
  },
  electricity: {
    label: "Electricity & Gas",
    description: "Energy used for working from home; included in the fixed rate",
    icon: "Zap",
  },
  stationery_consumables: {
    label: "Stationery & Computer Consumables",
    description: "Paper, pens and printer ink; included in the fixed rate",
    icon: "Pencil",
  },
  office_furniture: {
    label: "Office Furniture",
    description: "Desk, chair, monitor arm, standing desk converter",
    icon: "Armchair",
  },
  professional_development: {
    label: "Professional Development",
    description: "Courses, books, conferences, certifications",
    icon: "GraduationCap",
  },
  union_fees: {
    label: "Union & Professional Fees",
    description: "Union fees, professional association memberships",
    icon: "Users",
  },
  tools_equipment: {
    label: "Tools & Equipment",
    description: "USB drives, cables, toolkits, testing devices",
    icon: "Wrench",
  },
  clothing: {
    label: "Protective / Branded Clothing",
    description: "Company-branded or protective work clothing",
    icon: "Shirt",
  },
  travel: {
    label: "Travel",
    description: "Travel between workplaces, client visits",
    icon: "Car",
  },
  car_km: {
    label: "Car (cents per km)",
    description: "Work kilometres in your own car, 5,000 km cap",
    icon: "Car",
  },
  donations: {
    label: "Gifts & Donations",
    description: "Donations of $2+ to deductible gift recipients",
    icon: "HeartHandshake",
  },
  tax_affairs: {
    label: "Managing Tax Affairs",
    description: "Accountant fees, tax agent charges, this app",
    icon: "Receipt",
  },
  other: {
    label: "Other Work-Related",
    description: "Any other work-related expenses",
    icon: "MoreHorizontal",
  },
};

export const ASSET_EFFECTIVE_LIVES: Record<
  AssetType,
  { label: string; years: number }
> = {
  laptop: { label: "Laptop / Notebook", years: 4 },
  desktop: { label: "Desktop Computer", years: 4 },
  monitor: { label: "Monitor / Display", years: 4 },
  desk: { label: "Desk", years: 10 },
  office_chair: { label: "Office Chair", years: 10 },
  headphones: { label: "Headphones / Headset", years: 3 },
  keyboard_mouse: { label: "Keyboard / Mouse", years: 3 },
  printer: { label: "Printer / Scanner", years: 5 },
  webcam: { label: "Webcam", years: 4 },
  microphone: { label: "Microphone", years: 4 },
  external_drive: { label: "External Drive / SSD", years: 5 },
  other: { label: "Other", years: 5 },
};

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  base: number;
}

export const TAX_BRACKETS: Record<FinancialYear, TaxBracket[]> = {
  "2024-25": [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.16, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4288 },
    { min: 135001, max: 190000, rate: 0.37, base: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
  ],
  "2025-26": [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.16, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4288 },
    { min: 135001, max: 190000, rate: 0.37, base: 31288 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
  ],
  // 16% bracket drops to 15% from 1 Jul 2026 (More Cost of Living Tax Cuts Act 2025)
  "2026-27": [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.15, base: 0 },
    { min: 45001, max: 135000, rate: 0.30, base: 4020 },
    { min: 135001, max: 190000, rate: 0.37, base: 31020 },
    { min: 190001, max: Infinity, rate: 0.45, base: 51370 },
  ],
};

export const MEDICARE_LEVY_RATE = 0.02;

// Medicare Levy Act 1986; the current legislated threshold remains the
// provisional 2026-27 threshold until the next annual amendment is enacted.
export const MEDICARE_LOW_INCOME_THRESHOLD: Record<FinancialYear, number> = {
  "2024-25": 27222,
  "2025-26": 28011,
  "2026-27": 28011,
};

// HESA s154-20 caps the marginal result at 10% of repayment income.
// 2026-27 indexed amounts: government notification C2026G00249, April 2026.
export const HELP_THRESHOLDS: Record<FinancialYear, { minimum: number; upper: number }> = {
  "2024-25": { minimum: 54435, upper: 159664 },
  "2025-26": { minimum: 67000, upper: 125000 },
  "2026-27": { minimum: 69528, upper: 129717 },
};

/**
 * Medicare levy surcharge, singles thresholds on taxable income.
 * ponytail: singles only — family thresholds are ~2x and need a partner/
 * dependants field. Add that when someone lodges as a couple.
 * ponytail: proper MLS income also adds reportable fringe benefits, super and
 * net investment losses; taxable income is the right answer for a plain salary.
 */
export const MLS_TIERS: Record<FinancialYear, { over: number; rate: number }[]> = {
  "2024-25": [
    { over: 151000, rate: 0.015 },
    { over: 113000, rate: 0.0125 },
    { over: 97000, rate: 0.01 },
  ],
  // thresholds indexed from 1 Jul 2025
  "2025-26": [
    { over: 158000, rate: 0.015 },
    { over: 118000, rate: 0.0125 },
    { over: 101000, rate: 0.01 },
  ],
  // Department of Health / privatehealth.gov.au, 2026-27 thresholds.
  "2026-27": [
    { over: 164000, rate: 0.015 },
    { over: 123000, rate: 0.0125 },
    { over: 105000, rate: 0.01 },
  ],
};

/**
 * HELP/HECS compulsory repayment.
 * 2024-25 is the old step system: a percentage of *total* repayment income.
 * 2025-26 onward is the marginal system (Cutting Student Debt reforms):
 * nothing under the threshold, then a rate on the income above each step.
 */
export const HELP_2024_25_BANDS: { over: number; rate: number }[] = [
  { over: 159663, rate: 0.1 },
  { over: 150626, rate: 0.095 },
  { over: 142100, rate: 0.09 },
  { over: 134056, rate: 0.085 },
  { over: 126467, rate: 0.08 },
  { over: 119309, rate: 0.075 },
  { over: 112556, rate: 0.07 },
  { over: 106185, rate: 0.065 },
  { over: 100174, rate: 0.06 },
  { over: 94503, rate: 0.055 },
  { over: 89154, rate: 0.05 },
  { over: 84107, rate: 0.045 },
  { over: 79346, rate: 0.04 },
  { over: 74855, rate: 0.035 },
  { over: 70618, rate: 0.03 },
  { over: 66620, rate: 0.025 },
  { over: 62850, rate: 0.02 },
  { over: 54434, rate: 0.01 },
];

/**
 * Cents-per-kilometre rate for work car use (myTax D1), capped at 5,000 km.
 * 2026-27: ATO Cents per Kilometre Deduction Rate Determination 2026.
 */
export const CAR_RATE_PER_KM: Record<FinancialYear, number> = {
  "2024-25": 0.88,
  "2025-26": 0.88,
  "2026-27": 0.91,
};

export const CAR_KM_CAP = 5000;

export const FINANCIAL_YEARS: { value: FinancialYear; label: string }[] = [
  { value: "2024-25", label: "FY 2024-25 (Jul 2024 - Jun 2025)" },
  { value: "2025-26", label: "FY 2025-26 (Jul 2025 - Jun 2026)" },
  { value: "2026-27", label: "FY 2026-27 (Jul 2026 - Jun 2027)" },
];

export const FY_DATE_RANGES: Record<
  FinancialYear,
  { start: string; end: string }
> = {
  "2024-25": { start: "2024-07-01", end: "2025-06-30" },
  "2025-26": { start: "2025-07-01", end: "2026-06-30" },
  "2026-27": { start: "2026-07-01", end: "2027-06-30" },
};

/** The financial year a date falls in, or undefined if outside all known FYs. */
export const getFinancialYearForDate = (
  date: string
): FinancialYear | undefined =>
  (Object.keys(FY_DATE_RANGES) as FinancialYear[]).find((fy) => {
    const { start, end } = FY_DATE_RANGES[fy];
    return date >= start && date <= end;
  });

export const DEFAULT_SETTINGS = {
  // today's FY, falling back to the newest supported year
  financialYear:
    getFinancialYearForDate(toLocalDate()) ??
    FINANCIAL_YEARS[FINANCIAL_YEARS.length - 1].value,
  annualIncome: 0,
  occupation: "",
  taxResidentStatus: "resident" as const,
  defaultWorkUsePercent: 100,
  wfhMethod: "fixed_rate" as const,
  depreciationMethod: "diminishing" as const,
  hasHelpDebt: false,
  hasPrivateHospitalCover: false,
};

/**
 * Returns today when it falls within the selected FY, otherwise the nearest
 * date in that FY. This keeps new records in the period the user is viewing.
 */
export const getDefaultDateForFinancialYear = (
  financialYear: FinancialYear
): string => {
  const { start, end } = FY_DATE_RANGES[financialYear];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (today < start) return start;
  if (today > end) return end;
  return today;
};
