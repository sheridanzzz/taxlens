import { isSupabaseConfigured } from "./env";
import * as local from "./storage-local";
import { createClient } from "@/lib/supabase/client";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
} from "./types";
import { DEFAULT_SETTINGS } from "./constants";

const supabase = () => createClient();

// ── Helpers for snake_case ↔ camelCase mapping (Supabase) ───────────

const toExpense = (row: Record<string, unknown>): Expense => ({
  id: row.id as string,
  date: row.date as string,
  description: row.description as string,
  amount: Number(row.amount),
  category: row.category as Expense["category"],
  claimType: row.claim_type as Expense["claimType"],
  workUsePercent: Number(row.work_use_percent),
  claimableAmount: Number(row.claimable_amount),
  receiptDataUrl: (row.receipt_data_url as string) || undefined,
  notes: (row.notes as string) || undefined,
  financialYear: row.financial_year as FinancialYear,
  createdAt: row.created_at as string,
});

const fromExpense = (e: Expense, userId: string) => ({
  id: e.id,
  user_id: userId,
  date: e.date,
  description: e.description,
  amount: e.amount,
  category: e.category,
  claim_type: e.claimType,
  work_use_percent: e.workUsePercent,
  claimable_amount: e.claimableAmount,
  receipt_data_url: e.receiptDataUrl ?? null,
  notes: e.notes ?? null,
  financial_year: e.financialYear,
  created_at: e.createdAt,
});

const toAsset = (row: Record<string, unknown>): DepreciatingAsset => ({
  id: row.id as string,
  name: row.name as string,
  assetType: row.asset_type as DepreciatingAsset["assetType"],
  purchaseDate: row.purchase_date as string,
  purchasePrice: Number(row.purchase_price),
  effectiveLifeYears: Number(row.effective_life_years),
  depreciationMethod: row.depreciation_method as DepreciatingAsset["depreciationMethod"],
  workUsePercent: Number(row.work_use_percent),
  financialYear: row.financial_year as FinancialYear,
  createdAt: row.created_at as string,
});

const fromAsset = (a: DepreciatingAsset, userId: string) => ({
  id: a.id,
  user_id: userId,
  name: a.name,
  asset_type: a.assetType,
  purchase_date: a.purchaseDate,
  purchase_price: a.purchasePrice,
  effective_life_years: a.effectiveLifeYears,
  depreciation_method: a.depreciationMethod,
  work_use_percent: a.workUsePercent,
  financial_year: a.financialYear,
  created_at: a.createdAt,
});

const toWfhEntry = (row: Record<string, unknown>): WfhEntry => ({
  id: row.id as string,
  date: row.date as string,
  hours: Number(row.hours),
  financialYear: row.financial_year as FinancialYear,
});

const fromWfhEntry = (e: WfhEntry, userId: string) => ({
  id: e.id,
  user_id: userId,
  date: e.date,
  hours: e.hours,
  financial_year: e.financialYear,
});

const toWfhActualCost = (row: Record<string, unknown>): WfhActualCost => ({
  id: row.id as string,
  category: row.category as string,
  annualCost: Number(row.annual_cost),
  workUsePercent: Number(row.work_use_percent),
  financialYear: row.financial_year as FinancialYear,
});

const fromWfhActualCost = (c: WfhActualCost, userId: string) => ({
  id: c.id,
  user_id: userId,
  category: c.category,
  annual_cost: c.annualCost,
  work_use_percent: c.workUsePercent,
  financial_year: c.financialYear,
});

const toSettings = (row: Record<string, unknown>): UserSettings => ({
  financialYear: row.financial_year as FinancialYear,
  annualIncome: Number(row.annual_income),
  occupation: row.occupation as string,
  taxResidentStatus: row.tax_resident_status as UserSettings["taxResidentStatus"],
  defaultWorkUsePercent: Number(row.default_work_use_percent),
  wfhMethod: row.wfh_method as UserSettings["wfhMethod"],
  depreciationMethod: row.depreciation_method as UserSettings["depreciationMethod"],
});

const fromSettings = (s: UserSettings, userId: string) => ({
  user_id: userId,
  financial_year: s.financialYear,
  annual_income: s.annualIncome,
  occupation: s.occupation,
  tax_resident_status: s.taxResidentStatus,
  default_work_use_percent: s.defaultWorkUsePercent,
  wfh_method: s.wfhMethod,
  depreciation_method: s.depreciationMethod,
});

const getUserId = async (): Promise<string> => {
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
};

// ── Expenses ────────────────────────────────────────────────────────

export const getExpenses = async (fy?: FinancialYear): Promise<Expense[]> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.getExpenses(fy));
  }
  let query = supabase().from("expenses").select("*").order("date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data } = await query;
  return (data ?? []).map(toExpense);
};

export const saveExpense = async (expense: Expense): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.saveExpense(expense);
    return;
  }
  const userId = await getUserId();
  await supabase()
    .from("expenses")
    .upsert(fromExpense(expense, userId), { onConflict: "id" });
};

export const deleteExpense = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.deleteExpense(id);
    return;
  }
  await supabase().from("expenses").delete().eq("id", id);
};

// ── Assets ──────────────────────────────────────────────────────────

export const getAssets = async (fy?: FinancialYear): Promise<DepreciatingAsset[]> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.getAssets(fy));
  }
  let query = supabase().from("assets").select("*").order("purchase_date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data } = await query;
  return (data ?? []).map(toAsset);
};

export const saveAsset = async (asset: DepreciatingAsset): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.saveAsset(asset);
    return;
  }
  const userId = await getUserId();
  await supabase()
    .from("assets")
    .upsert(fromAsset(asset, userId), { onConflict: "id" });
};

export const deleteAsset = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.deleteAsset(id);
    return;
  }
  await supabase().from("assets").delete().eq("id", id);
};

// ── WFH Entries ─────────────────────────────────────────────────────

export const getWfhEntries = async (fy?: FinancialYear): Promise<WfhEntry[]> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.getWfhEntries(fy));
  }
  let query = supabase().from("wfh_entries").select("*").order("date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data } = await query;
  return (data ?? []).map(toWfhEntry);
};

export const saveWfhEntry = async (entry: WfhEntry): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.saveWfhEntry(entry);
    return;
  }
  const userId = await getUserId();
  await supabase()
    .from("wfh_entries")
    .upsert(fromWfhEntry(entry, userId), { onConflict: "id" });
};

export const deleteWfhEntry = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.deleteWfhEntry(id);
    return;
  }
  await supabase().from("wfh_entries").delete().eq("id", id);
};

// ── WFH Actual Costs ────────────────────────────────────────────────

export const getWfhActualCosts = async (fy?: FinancialYear): Promise<WfhActualCost[]> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.getWfhActualCosts(fy));
  }
  let query = supabase().from("wfh_actual_costs").select("*");
  if (fy) query = query.eq("financial_year", fy);
  const { data } = await query;
  return (data ?? []).map(toWfhActualCost);
};

export const saveWfhActualCost = async (cost: WfhActualCost): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.saveWfhActualCost(cost);
    return;
  }
  const userId = await getUserId();
  await supabase()
    .from("wfh_actual_costs")
    .upsert(fromWfhActualCost(cost, userId), { onConflict: "id" });
};

export const deleteWfhActualCost = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.deleteWfhActualCost(id);
    return;
  }
  await supabase().from("wfh_actual_costs").delete().eq("id", id);
};

// ── Settings ────────────────────────────────────────────────────────

export const getSettings = async (): Promise<UserSettings> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.getSettings());
  }
  const { data } = await supabase()
    .from("user_settings")
    .select("*")
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return toSettings(data);
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.saveSettings(settings);
    return;
  }
  const userId = await getUserId();
  await supabase()
    .from("user_settings")
    .upsert(fromSettings(settings, userId), { onConflict: "user_id" });
};

// ── Export / Import / Clear ─────────────────────────────────────────

export const exportAllData = async (): Promise<string> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.exportAllData());
  }
  const [expenses, assets, wfhEntries, wfhActualCosts, settings] =
    await Promise.all([
      getExpenses(),
      getAssets(),
      getWfhEntries(),
      getWfhActualCosts(),
      getSettings(),
    ]);
  return JSON.stringify(
    { expenses, assets, wfhEntries, wfhActualCosts, settings, exportedAt: new Date().toISOString() },
    null,
    2
  );
};

export const importAllData = async (json: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(local.importAllData(json));
  }
  try {
    const data = JSON.parse(json);
    if (data.expenses) {
      for (const e of data.expenses) await saveExpense(e);
    }
    if (data.assets) {
      for (const a of data.assets) await saveAsset(a);
    }
    if (data.wfhEntries) {
      for (const e of data.wfhEntries) await saveWfhEntry(e);
    }
    if (data.wfhActualCosts) {
      for (const c of data.wfhActualCosts) await saveWfhActualCost(c);
    }
    if (data.settings) {
      await saveSettings(data.settings);
    }
    return true;
  } catch {
    return false;
  }
};

export const clearAllData = async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    local.clearAllData();
    return;
  }
  const userId = await getUserId();
  await Promise.all([
    supabase().from("expenses").delete().eq("user_id", userId),
    supabase().from("assets").delete().eq("user_id", userId),
    supabase().from("wfh_entries").delete().eq("user_id", userId),
    supabase().from("wfh_actual_costs").delete().eq("user_id", userId),
    supabase().from("user_settings").delete().eq("user_id", userId),
  ]);
};

