import type {
  AssetType,
  ExpenseCategory,
  FinancialYear,
} from "./types";

export const INSTANT_DEDUCTION_THRESHOLD = 300;

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
    getFinancialYearForDate(new Date().toISOString().split("T")[0]) ??
    FINANCIAL_YEARS[FINANCIAL_YEARS.length - 1].value,
  annualIncome: 0,
  occupation: "Software Engineer",
  taxResidentStatus: "resident" as const,
  defaultWorkUsePercent: 100,
  wfhMethod: "fixed_rate" as const,
  depreciationMethod: "diminishing" as const,
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
