import { ASSET_EFFECTIVE_LIVES, EXPENSE_CATEGORIES, FY_DATE_RANGES } from "./constants";
import type { DepreciatingAsset, Expense, UserSettings, WfhEntry, WfhActualCost, CgtTransaction, RentalProperty, RentalTransaction } from "./types";

const number = (value: number, min: number, max = Infinity) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error("Enter a valid amount or percentage.");
};
const text = (value: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error("A required field is missing.");
};
const date = (value: string, fy: string) => {
  const range = FY_DATE_RANGES[fy as keyof typeof FY_DATE_RANGES];
  if (!range || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value ||
      value < range.start || value > range.end) throw new Error("The date must be within the selected financial year.");
};

export const validateExpense = (e: Expense): Expense => {
  if (!e || !EXPENSE_CATEGORIES[e.category] || !["full", "depreciation"].includes(e.claimType))
    throw new Error("Invalid expense category or claim method.");
  text(e.id); text(e.description); date(e.date, e.financialYear);
  number(e.amount, 0.01); number(e.workUsePercent, 0, 100);
  if (e.kilometres !== undefined) number(e.kilometres, 0);
  if (e.receiptDataUrl !== undefined &&
      (!/^data:(image\/(png|jpeg|jpg|webp|gif)|application\/pdf|message\/rfc822);base64,/.test(e.receiptDataUrl) || e.receiptDataUrl.length > 20_000_000))
    throw new Error("Use a supported image, PDF or original receipt email under 15 MB.");
  return { ...e, description: e.description.trim(),
    claimableAmount: e.claimType === "full" ? Math.round(e.amount * e.workUsePercent) / 100 : 0 };
};

export const validateAsset = (a: DepreciatingAsset): DepreciatingAsset => {
  if (!a || !ASSET_EFFECTIVE_LIVES[a.assetType] || !["diminishing", "prime_cost"].includes(a.depreciationMethod))
    throw new Error("Invalid asset type or depreciation method.");
  text(a.id); text(a.name); date(a.purchaseDate, a.financialYear);
  number(a.purchasePrice, 0.01); number(a.workUsePercent, 0, 100); number(a.effectiveLifeYears, 1, 100);
  return a;
};

export const validateSettings = (s: UserSettings): UserSettings => {
  if (!s || !FY_DATE_RANGES[s.financialYear] ||
      !["resident", "non_resident", "working_holiday"].includes(s.taxResidentStatus) ||
      !["fixed_rate", "actual_cost"].includes(s.wfhMethod) ||
      !["diminishing", "prime_cost"].includes(s.depreciationMethod)) throw new Error("Invalid tax settings.");
  number(s.annualIncome, 0); number(s.defaultWorkUsePercent, 0, 100);
  for (const [key, value] of Object.entries(s.taxOptions ?? {})) {
    if (["medicareExempt", "workingHolidayResident", "workingHolidayTreatyResident"].includes(key)) {
      if (typeof value !== "boolean") throw new Error("Invalid tax setting.");
    } else if (value !== undefined) number(value as number, 0);
  }
  return s;
};

export const validateWfhEntry = (e: WfhEntry) => {
  text(e.id); date(e.date, e.financialYear); number(e.hours, 0.01, 24); return e;
};
export const validateWfhActualCost = (c: WfhActualCost) => {
  text(c.id); text(c.category); number(c.annualCost, 0.01); number(c.workUsePercent, 0, 100);
  if (!FY_DATE_RANGES[c.financialYear]) throw new Error("Invalid financial year."); return c;
};
export const validateCgtTransaction = (t: CgtTransaction) => {
  text(t.id); text(t.asset);
  if (!["crypto", "share"].includes(t.kind) || !["buy", "sell"].includes(t.side) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(Date.parse(t.date)) ||
      new Date(t.date).toISOString().slice(0, 10) !== t.date) throw new Error("Invalid trade details.");
  number(t.quantity, Number.MIN_VALUE); number(t.unitPrice, 0); number(t.fee, 0); return t;
};
export const validateRentalProperty = (p: RentalProperty) => {
  text(p.id); text(p.address); number(p.ownershipPercent, 0, 100); return p;
};
export const validateRentalTransaction = (t: RentalTransaction) => {
  text(t.id); text(t.propertyId); text(t.description); date(t.date, t.financialYear);
  if (!["income", "expense"].includes(t.kind)) throw new Error("Invalid rental transaction.");
  number(t.amount, 0.01); number(t.deductiblePercent, 0, 100); return t;
};

export const validateBackup = (json: string) => {
  const data = JSON.parse(json);
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      !["expenses", "assets", "settings", "wfhEntries", "cgtTransactions", "rentalProperties"].some((key) => key in data))
    throw new Error("Invalid backup file.");
  const validators = { expenses: validateExpense, assets: validateAsset, wfhEntries: validateWfhEntry,
    wfhActualCosts: validateWfhActualCost, cgtTransactions: validateCgtTransaction,
    rentalProperties: validateRentalProperty, rentalTransactions: validateRentalTransaction };
  for (const [key, validate] of Object.entries(validators)) {
    if (!(key in data)) continue;
    if (!Array.isArray(data[key])) throw new Error("Invalid backup records.");
    data[key] = data[key].map((value: unknown) => (validate as (record: unknown) => unknown)(value));
  }
  if (data.settings) data.settings = validateSettings(data.settings);
  return data as {
    expenses?: Expense[]; assets?: DepreciatingAsset[]; wfhEntries?: WfhEntry[];
    wfhActualCosts?: WfhActualCost[]; cgtTransactions?: CgtTransaction[];
    rentalProperties?: RentalProperty[]; rentalTransactions?: RentalTransaction[]; settings?: UserSettings;
  };
};
