import type {
  AssetType,
  ExpenseCategory,
  FinancialYear,
} from "./types";

export const INSTANT_DEDUCTION_THRESHOLD = 300;

export const WFH_FIXED_RATE_PER_HOUR = 0.67;

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
};

export const MEDICARE_LEVY_RATE = 0.02;

export const FINANCIAL_YEARS: { value: FinancialYear; label: string }[] = [
  { value: "2024-25", label: "FY 2024-25 (Jul 2024 - Jun 2025)" },
  { value: "2025-26", label: "FY 2025-26 (Jul 2025 - Jun 2026)" },
];

export const DEFAULT_SETTINGS = {
  financialYear: "2025-26" as FinancialYear,
  annualIncome: 0,
  occupation: "Software Engineer",
  taxResidentStatus: "resident" as const,
  defaultWorkUsePercent: 100,
  wfhMethod: "fixed_rate" as const,
  depreciationMethod: "diminishing" as const,
};

export const FY_DATE_RANGES: Record<
  FinancialYear,
  { start: string; end: string }
> = {
  "2024-25": { start: "2024-07-01", end: "2025-06-30" },
  "2025-26": { start: "2025-07-01", end: "2026-06-30" },
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
