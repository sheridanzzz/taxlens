import { sql } from "@/lib/neon";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
} from "./types";
import { DEFAULT_SETTINGS } from "./constants";

type Row = Record<string, unknown>;

const toExpense = (r: Row): Expense => ({
  id: r.id as string,
  date: r.date as string,
  description: r.description as string,
  amount: Number(r.amount),
  category: r.category as Expense["category"],
  claimType: r.claim_type as Expense["claimType"],
  workUsePercent: Number(r.work_use_percent),
  claimableAmount: Number(r.claimable_amount),
  receiptDataUrl: (r.receipt_data_url as string) || undefined,
  notes: (r.notes as string) || undefined,
  financialYear: r.financial_year as FinancialYear,
  createdAt: r.created_at as string,
});

const toAsset = (r: Row): DepreciatingAsset => ({
  id: r.id as string,
  name: r.name as string,
  assetType: r.asset_type as DepreciatingAsset["assetType"],
  purchaseDate: r.purchase_date as string,
  purchasePrice: Number(r.purchase_price),
  effectiveLifeYears: Number(r.effective_life_years),
  depreciationMethod: r.depreciation_method as DepreciatingAsset["depreciationMethod"],
  workUsePercent: Number(r.work_use_percent),
  financialYear: r.financial_year as FinancialYear,
  createdAt: r.created_at as string,
});

const toWfhEntry = (r: Row): WfhEntry => ({
  id: r.id as string,
  date: r.date as string,
  hours: Number(r.hours),
  financialYear: r.financial_year as FinancialYear,
});

const toWfhActualCost = (r: Row): WfhActualCost => ({
  id: r.id as string,
  category: r.category as string,
  annualCost: Number(r.annual_cost),
  workUsePercent: Number(r.work_use_percent),
  financialYear: r.financial_year as FinancialYear,
});

const toSettings = (r: Row): UserSettings => ({
  financialYear: r.financial_year as FinancialYear,
  annualIncome: Number(r.annual_income),
  occupation: r.occupation as string,
  taxResidentStatus: r.tax_resident_status as UserSettings["taxResidentStatus"],
  defaultWorkUsePercent: Number(r.default_work_use_percent),
  wfhMethod: r.wfh_method as UserSettings["wfhMethod"],
  depreciationMethod: r.depreciation_method as UserSettings["depreciationMethod"],
});

// ── Expenses ───────────────────────────────────────────────────────

export const getExpenses = async (userId: string, fy?: FinancialYear): Promise<Expense[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM expenses WHERE user_id = ${userId} AND financial_year = ${fy} ORDER BY date DESC`
    : await db`SELECT * FROM expenses WHERE user_id = ${userId} ORDER BY date DESC`;
  return rows.map(toExpense);
};

export const saveExpense = async (userId: string, e: Expense): Promise<void> => {
  const db = sql();
  await db`INSERT INTO expenses (id, user_id, date, description, amount, category, claim_type, work_use_percent, claimable_amount, receipt_data_url, notes, financial_year, created_at)
     VALUES (${e.id}, ${userId}, ${e.date}, ${e.description}, ${e.amount}, ${e.category}, ${e.claimType}, ${e.workUsePercent}, ${e.claimableAmount}, ${e.receiptDataUrl ?? null}, ${e.notes ?? null}, ${e.financialYear}, ${e.createdAt})
     ON CONFLICT (id) DO UPDATE SET
       date=EXCLUDED.date, description=EXCLUDED.description, amount=EXCLUDED.amount,
       category=EXCLUDED.category, claim_type=EXCLUDED.claim_type, work_use_percent=EXCLUDED.work_use_percent,
       claimable_amount=EXCLUDED.claimable_amount, receipt_data_url=EXCLUDED.receipt_data_url,
       notes=EXCLUDED.notes, financial_year=EXCLUDED.financial_year`;
};

export const deleteExpense = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM expenses WHERE id = ${id} AND user_id = ${userId}`;
};

// ── Assets ─────────────────────────────────────────────────────────

export const getAssets = async (userId: string, fy?: FinancialYear): Promise<DepreciatingAsset[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM assets WHERE user_id = ${userId} AND financial_year = ${fy} ORDER BY purchase_date DESC`
    : await db`SELECT * FROM assets WHERE user_id = ${userId} ORDER BY purchase_date DESC`;
  return rows.map(toAsset);
};

export const saveAsset = async (userId: string, a: DepreciatingAsset): Promise<void> => {
  const db = sql();
  await db`INSERT INTO assets (id, user_id, name, asset_type, purchase_date, purchase_price, effective_life_years, depreciation_method, work_use_percent, financial_year, created_at)
     VALUES (${a.id}, ${userId}, ${a.name}, ${a.assetType}, ${a.purchaseDate}, ${a.purchasePrice}, ${a.effectiveLifeYears}, ${a.depreciationMethod}, ${a.workUsePercent}, ${a.financialYear}, ${a.createdAt})
     ON CONFLICT (id) DO UPDATE SET
       name=EXCLUDED.name, asset_type=EXCLUDED.asset_type, purchase_date=EXCLUDED.purchase_date,
       purchase_price=EXCLUDED.purchase_price, effective_life_years=EXCLUDED.effective_life_years,
       depreciation_method=EXCLUDED.depreciation_method, work_use_percent=EXCLUDED.work_use_percent,
       financial_year=EXCLUDED.financial_year`;
};

export const deleteAsset = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM assets WHERE id = ${id} AND user_id = ${userId}`;
};

// ── WFH Entries ────────────────────────────────────────────────────

export const getWfhEntries = async (userId: string, fy?: FinancialYear): Promise<WfhEntry[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM wfh_entries WHERE user_id = ${userId} AND financial_year = ${fy} ORDER BY date DESC`
    : await db`SELECT * FROM wfh_entries WHERE user_id = ${userId} ORDER BY date DESC`;
  return rows.map(toWfhEntry);
};

export const saveWfhEntry = async (userId: string, e: WfhEntry): Promise<void> => {
  const db = sql();
  await db`INSERT INTO wfh_entries (id, user_id, date, hours, financial_year)
     VALUES (${e.id}, ${userId}, ${e.date}, ${e.hours}, ${e.financialYear})
     ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date, hours=EXCLUDED.hours, financial_year=EXCLUDED.financial_year`;
};

export const deleteWfhEntry = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM wfh_entries WHERE id = ${id} AND user_id = ${userId}`;
};

// ── WFH Actual Costs ───────────────────────────────────────────────

export const getWfhActualCosts = async (userId: string, fy?: FinancialYear): Promise<WfhActualCost[]> => {
  const db = sql();
  const rows = fy
    ? await db`SELECT * FROM wfh_actual_costs WHERE user_id = ${userId} AND financial_year = ${fy}`
    : await db`SELECT * FROM wfh_actual_costs WHERE user_id = ${userId}`;
  return rows.map(toWfhActualCost);
};

export const saveWfhActualCost = async (userId: string, c: WfhActualCost): Promise<void> => {
  const db = sql();
  await db`INSERT INTO wfh_actual_costs (id, user_id, category, annual_cost, work_use_percent, financial_year)
     VALUES (${c.id}, ${userId}, ${c.category}, ${c.annualCost}, ${c.workUsePercent}, ${c.financialYear})
     ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, annual_cost=EXCLUDED.annual_cost, work_use_percent=EXCLUDED.work_use_percent, financial_year=EXCLUDED.financial_year`;
};

export const deleteWfhActualCost = async (userId: string, id: string): Promise<void> => {
  const db = sql();
  await db`DELETE FROM wfh_actual_costs WHERE id = ${id} AND user_id = ${userId}`;
};

// ── Settings ───────────────────────────────────────────────────────

export const getSettings = async (userId: string): Promise<UserSettings> => {
  const db = sql();
  const rows = await db`SELECT * FROM user_settings WHERE user_id = ${userId}`;
  if (!rows[0]) return DEFAULT_SETTINGS;
  return toSettings(rows[0]);
};

export const saveSettings = async (userId: string, s: UserSettings): Promise<void> => {
  const db = sql();
  await db`INSERT INTO user_settings (user_id, financial_year, annual_income, occupation, tax_resident_status, default_work_use_percent, wfh_method, depreciation_method)
     VALUES (${userId}, ${s.financialYear}, ${s.annualIncome}, ${s.occupation}, ${s.taxResidentStatus}, ${s.defaultWorkUsePercent}, ${s.wfhMethod}, ${s.depreciationMethod})
     ON CONFLICT (user_id) DO UPDATE SET
       financial_year=EXCLUDED.financial_year, annual_income=EXCLUDED.annual_income, occupation=EXCLUDED.occupation,
       tax_resident_status=EXCLUDED.tax_resident_status, default_work_use_percent=EXCLUDED.default_work_use_percent,
       wfh_method=EXCLUDED.wfh_method, depreciation_method=EXCLUDED.depreciation_method`;
};
