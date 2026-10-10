import { isSupabaseConfigured, isNeonConfigured } from "./env";
import * as local from "./storage-local";
import * as neonActions from "./storage-actions";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
  CgtTransaction,
  RentalProperty,
  RentalTransaction,
} from "./types";
import { DEFAULT_SETTINGS, FY_DATE_RANGES } from "./constants";
import { applyCarClaimCaps, findLinkedAsset } from "./expense-claims";
import { packTaxOptions, unpackTaxOptions } from "./tax-time";
import { validateExpense, validateAsset, validateSettings, validateWfhEntry, validateWfhActualCost, validateCgtTransaction, validateRentalProperty, validateRentalTransaction, validateBackup } from "./validation";

const isNeonBackend = () => isNeonConfigured() && !isSupabaseConfigured();

// ── Lazy Supabase import (only when configured) ───────────────────

const supabase = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@/lib/supabase/client");
  return createClient();
};

// ── Supabase row mappers ──────────────────────────────────────────

type Row = Record<string, unknown>;
const timestamp = (value: unknown): string => new Date(value as string).toISOString();

const toExpense = (row: Row): Expense => ({
  id: row.id as string,
  date: row.date as string,
  description: row.description as string,
  amount: Number(row.amount),
  category: row.category as Expense["category"],
  claimType: row.claim_type as Expense["claimType"],
  workUsePercent: Number(row.work_use_percent),
  claimableAmount: Number(row.claimable_amount),
  assetId: (row.asset_id as string) || undefined,
  carId: (row.car_id as string) || undefined,
  kilometres: row.kilometres == null ? undefined : Number(row.kilometres),
  hasReceipt: Boolean(row.receipt_data_url),
  receiptDataUrl: (row.receipt_data_url as string) || undefined,
  reviewStatus: (row.review_status as Expense["reviewStatus"]) ?? undefined,
  notes: (row.notes as string) || undefined,
  financialYear: row.financial_year as FinancialYear,
  createdAt: timestamp(row.created_at),
});


const toAsset = (row: Row): DepreciatingAsset => ({
  id: row.id as string,
  name: row.name as string,
  assetType: row.asset_type as DepreciatingAsset["assetType"],
  purchaseDate: row.purchase_date as string,
  purchasePrice: Number(row.purchase_price),
  effectiveLifeYears: Number(row.effective_life_years),
  depreciationMethod: row.depreciation_method as DepreciatingAsset["depreciationMethod"],
  workUsePercent: Number(row.work_use_percent),
  financialYear: row.financial_year as FinancialYear,
  createdAt: timestamp(row.created_at),
});


const toWfhEntry = (row: Row): WfhEntry => ({
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

const toWfhActualCost = (row: Row): WfhActualCost => ({
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

const toRentalProperty = (row: Row): RentalProperty => ({
  id: row.id as string,
  address: row.address as string,
  ownershipPercent: Number(row.ownership_percent),
  acquiredDate: (row.acquired_date as string) || undefined,
  notes: (row.notes as string) || undefined,
  createdAt: timestamp(row.created_at),
});

const fromRentalProperty = (property: RentalProperty, userId: string) => ({
  id: property.id,
  user_id: userId,
  address: property.address,
  ownership_percent: property.ownershipPercent,
  acquired_date: property.acquiredDate ?? null,
  notes: property.notes ?? null,
  created_at: property.createdAt,
});

const toRentalTransaction = (row: Row): RentalTransaction => ({
  id: row.id as string,
  propertyId: row.property_id as string,
  date: row.date as string,
  kind: row.kind as RentalTransaction["kind"],
  category: row.category as RentalTransaction["category"],
  description: row.description as string,
  amount: Number(row.amount),
  deductiblePercent: Number(row.deductible_percent),
  financialYear: row.financial_year as FinancialYear,
  notes: (row.notes as string) || undefined,
  createdAt: timestamp(row.created_at),
});

const fromRentalTransaction = (
  transaction: RentalTransaction,
  userId: string
) => ({
  id: transaction.id,
  user_id: userId,
  property_id: transaction.propertyId,
  date: transaction.date,
  kind: transaction.kind,
  category: transaction.category,
  description: transaction.description,
  amount: transaction.amount,
  deductible_percent: transaction.deductiblePercent,
  financial_year: transaction.financialYear,
  notes: transaction.notes ?? null,
  created_at: transaction.createdAt,
});

const toSettings = (row: Row): UserSettings => ({
  financialYear: row.financial_year as FinancialYear,
  annualIncome: Number(row.annual_income),
  occupation: row.occupation as string,
  taxResidentStatus: row.tax_resident_status as UserSettings["taxResidentStatus"],
  defaultWorkUsePercent: Number(row.default_work_use_percent),
  wfhMethod: row.wfh_method as UserSettings["wfhMethod"],
  depreciationMethod: row.depreciation_method as UserSettings["depreciationMethod"],
  hasHelpDebt: Boolean(row.has_help_debt),
  hasPrivateHospitalCover: Boolean(row.has_private_hospital_cover),
  ...unpackTaxOptions(row.tax_options),
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
  has_help_debt: s.hasHelpDebt,
  has_private_hospital_cover: s.hasPrivateHospitalCover,
  tax_options: packTaxOptions(s),
});

const getSupabaseUserId = async (): Promise<string> => {
  const { data, error } = await supabase().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
};

// ── Expenses ────────────────────────────────────────────────────────

export const getExpenses = async (fy?: FinancialYear): Promise<Expense[]> => {
  if (isNeonBackend()) return neonActions.neonGetExpenses(fy);
  if (!isSupabaseConfigured()) return Promise.resolve(local.getExpenses(fy));
  let query = supabase().from("expenses").select("*").order("date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data, error } = await query;
  if (error) throw error;
  return applyCarClaimCaps((data ?? []).map(toExpense));
};

export const saveExpense = async (expense: Expense, asset?: DepreciatingAsset): Promise<void> => {
  expense = validateExpense(expense);
  if (asset) validateAsset(asset);
  if (isNeonBackend()) return neonActions.neonSaveExpense(expense, asset);
  if (!isSupabaseConfigured()) { local.saveExpense(expense, asset); return; }
  const userId = await getSupabaseUserId();
  const { error } = await supabase().rpc("ledger_save_expense", {
    p_user: userId, p_expense: expense, p_asset: asset ?? null,
  });
  if (error) throw error;
};

export const getExpenseReceipt = async (id: string): Promise<string | null> => {
  if (isNeonBackend()) return neonActions.neonGetExpenseReceipt(id);
  if (!isSupabaseConfigured()) return local.getExpenses().find((e) => e.id === id)?.receiptDataUrl ?? null;
  const { data, error } = await supabase().from("expenses").select("receipt_data_url").eq("id", id).single();
  if (error) throw error;
  return data?.receipt_data_url ?? null;
};

export const getExpenseReceipts = async (ids: string[]): Promise<Record<string, string | null>> => {
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every(id => typeof id === "string" && id.length <= 100))
    throw new Error("Invalid receipt selection.");
  if (!ids.length) return {};
  if (isNeonBackend()) return neonActions.neonGetExpenseReceipts(ids);
  if (!isSupabaseConfigured()) return Object.fromEntries(local.getExpenses().filter(e => ids.includes(e.id)).map(e => [e.id, e.receiptDataUrl ?? null]));
  const { data, error } = await supabase().from("expenses").select("id,receipt_data_url").eq("user_id", await getSupabaseUserId()).in("id", ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: Row) => [r.id as string, (r.receipt_data_url as string) || null]));
};

export const deleteExpense = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteExpense(id);
  if (!isSupabaseConfigured()) { local.deleteExpense(id); return; }
  const { error } = await supabase().rpc("ledger_delete_expense", { p_user: await getSupabaseUserId(), p_id: id });
  if (error) throw error;
};

export const getAssets = async (fy?: FinancialYear): Promise<DepreciatingAsset[]> => {
  if (isNeonBackend()) return neonActions.neonGetAssets(fy);
  if (!isSupabaseConfigured()) return local.getAssets(fy);
  let query = supabase().from("assets").select("*").order("purchase_date", { ascending: false });
  if (fy) query = query.lte("purchase_date", FY_DATE_RANGES[fy].end);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toAsset);
};

export const saveAsset = async (asset: DepreciatingAsset): Promise<void> => {
  validateAsset(asset);
  if (isNeonBackend()) return neonActions.neonSaveAsset(asset);
  if (!isSupabaseConfigured()) { local.saveAsset(asset); return; }
  const { error } = await supabase().rpc("ledger_save_asset", { p_user: await getSupabaseUserId(), p_asset: asset });
  if (error) throw error;
};

export const deleteAsset = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteAsset(id);
  if (!isSupabaseConfigured()) { local.deleteAsset(id); return; }
  const { error } = await supabase().rpc("ledger_delete_asset", { p_user: await getSupabaseUserId(), p_id: id });
  if (error) throw error;
};

// ── WFH Entries ─────────────────────────────────────────────────────

export const getWfhEntries = async (fy?: FinancialYear): Promise<WfhEntry[]> => {
  if (isNeonBackend()) return neonActions.neonGetWfhEntries(fy);
  if (!isSupabaseConfigured()) return Promise.resolve(local.getWfhEntries(fy));
  let query = supabase().from("wfh_entries").select("*").order("date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toWfhEntry);
};

export const saveWfhEntry = async (entry: WfhEntry): Promise<void> => {
  validateWfhEntry(entry);
  if (isNeonBackend()) return neonActions.neonSaveWfhEntry(entry);
  if (!isSupabaseConfigured()) { local.saveWfhEntry(entry); return; }
  const userId = await getSupabaseUserId();
  const { error } = await supabase().from("wfh_entries").upsert(fromWfhEntry(entry, userId), { onConflict: "id" });
  if (error) throw error;
};

export const deleteWfhEntry = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteWfhEntry(id);
  if (!isSupabaseConfigured()) { local.deleteWfhEntry(id); return; }
  const { error } = await supabase().from("wfh_entries").delete().eq("id", id);
  if (error) throw error;
};

// ── WFH Actual Costs ────────────────────────────────────────────────

export const getWfhActualCosts = async (fy?: FinancialYear): Promise<WfhActualCost[]> => {
  if (isNeonBackend()) return neonActions.neonGetWfhActualCosts(fy);
  if (!isSupabaseConfigured()) return Promise.resolve(local.getWfhActualCosts(fy));
  let query = supabase().from("wfh_actual_costs").select("*");
  if (fy) query = query.eq("financial_year", fy);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toWfhActualCost);
};

export const saveWfhActualCost = async (cost: WfhActualCost): Promise<void> => {
  validateWfhActualCost(cost);
  if (isNeonBackend()) return neonActions.neonSaveWfhActualCost(cost);
  if (!isSupabaseConfigured()) { local.saveWfhActualCost(cost); return; }
  const userId = await getSupabaseUserId();
  const { error } = await supabase().from("wfh_actual_costs").upsert(fromWfhActualCost(cost, userId), { onConflict: "id" });
  if (error) throw error;
};

export const deleteWfhActualCost = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteWfhActualCost(id);
  if (!isSupabaseConfigured()) { local.deleteWfhActualCost(id); return; }
  const { error } = await supabase().from("wfh_actual_costs").delete().eq("id", id);
  if (error) throw error;
};

// ── CGT transactions ────────────────────────────────────────────────

const toCgtTransaction = (row: Row): CgtTransaction => ({
  id: row.id as string,
  kind: row.kind as CgtTransaction["kind"],
  asset: row.asset as string,
  side: row.side as CgtTransaction["side"],
  date: row.date as string,
  quantity: Number(row.quantity),
  unitPrice: Number(row.unit_price),
  fee: Number(row.fee),
  notes: (row.notes as string) || undefined,
  createdAt: timestamp(row.created_at),
});

const fromCgtTransaction = (t: CgtTransaction, userId: string) => ({
  id: t.id,
  user_id: userId,
  kind: t.kind,
  asset: t.asset,
  side: t.side,
  date: t.date,
  quantity: t.quantity,
  unit_price: t.unitPrice,
  fee: t.fee,
  notes: t.notes ?? null,
  created_at: t.createdAt,
});

// never FY-filtered: FIFO matching needs the whole history
export const getCgtTransactions = async (): Promise<CgtTransaction[]> => {
  if (isNeonBackend()) return neonActions.neonGetCgtTransactions();
  if (!isSupabaseConfigured()) return Promise.resolve(local.getCgtTransactions());
  const { data, error } = await supabase()
    .from("cgt_transactions")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCgtTransaction);
};

export const saveCgtTransaction = async (tx: CgtTransaction): Promise<void> => {
  validateCgtTransaction(tx);
  if (isNeonBackend()) return neonActions.neonSaveCgtTransaction(tx);
  if (!isSupabaseConfigured()) { local.saveCgtTransaction(tx); return; }
  const userId = await getSupabaseUserId();
  const { error } = await supabase().from("cgt_transactions").upsert(fromCgtTransaction(tx, userId), { onConflict: "id" });
  if (error) throw error;
};

export const deleteCgtTransaction = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteCgtTransaction(id);
  if (!isSupabaseConfigured()) { local.deleteCgtTransaction(id); return; }
  const { error } = await supabase().from("cgt_transactions").delete().eq("id", id);
  if (error) throw error;
};

// ── Rental properties ──────────────────────────────────────────────

export const getRentalProperties = async (): Promise<RentalProperty[]> => {
  if (isNeonBackend()) return neonActions.neonGetRentalProperties();
  if (!isSupabaseConfigured()) return Promise.resolve(local.getRentalProperties());
  const { data, error } = await supabase()
    .from("rental_properties")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toRentalProperty);
};

export const saveRentalProperty = async (
  property: RentalProperty
): Promise<void> => {
  validateRentalProperty(property);
  if (isNeonBackend()) return neonActions.neonSaveRentalProperty(property);
  if (!isSupabaseConfigured()) {
    local.saveRentalProperty(property);
    return;
  }
  const userId = await getSupabaseUserId();
  const { error } = await supabase()
    .from("rental_properties")
    .upsert(fromRentalProperty(property, userId), { onConflict: "id" });
  if (error) throw error;
};

export const deleteRentalProperty = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteRentalProperty(id);
  if (!isSupabaseConfigured()) {
    local.deleteRentalProperty(id);
    return;
  }
  const { error } = await supabase().from("rental_properties").delete().eq("id", id);
  if (error) throw error;
};

export const getRentalTransactions = async (
  fy?: FinancialYear
): Promise<RentalTransaction[]> => {
  if (isNeonBackend()) return neonActions.neonGetRentalTransactions(fy);
  if (!isSupabaseConfigured())
    return Promise.resolve(local.getRentalTransactions(fy));
  let query = supabase()
    .from("rental_transactions")
    .select("*")
    .order("date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toRentalTransaction);
};

export const saveRentalTransaction = async (
  transaction: RentalTransaction
): Promise<void> => {
  validateRentalTransaction(transaction);
  if (isNeonBackend())
    return neonActions.neonSaveRentalTransaction(transaction);
  if (!isSupabaseConfigured()) {
    local.saveRentalTransaction(transaction);
    return;
  }
  const userId = await getSupabaseUserId();
  const { error } = await supabase()
    .from("rental_transactions")
    .upsert(fromRentalTransaction(transaction, userId), { onConflict: "id" });
  if (error) throw error;
};

export const deleteRentalTransaction = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteRentalTransaction(id);
  if (!isSupabaseConfigured()) {
    local.deleteRentalTransaction(id);
    return;
  }
  const { error } = await supabase().from("rental_transactions").delete().eq("id", id);
  if (error) throw error;
};

// ── Settings ────────────────────────────────────────────────────────

export const getSettings = async (): Promise<UserSettings> => {
  if (isNeonBackend()) return neonActions.neonGetSettings();
  if (!isSupabaseConfigured()) return Promise.resolve(local.getSettings());
  const { data, error } = await supabase().from("user_settings").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  return toSettings(data);
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  settings = validateSettings(settings);
  if (isNeonBackend()) return neonActions.neonSaveSettings(settings);
  if (!isSupabaseConfigured()) { local.saveSettings(settings); return; }
  const userId = await getSupabaseUserId();
  const { error } = await supabase().from("user_settings").upsert(fromSettings(settings, userId), { onConflict: "user_id" });
  if (error) throw error;
};

// ── Export / Import / Clear ─────────────────────────────────────────

export const exportAllData = async (): Promise<string> => {
  const [
    expenses,
    assets,
    wfhEntries,
    wfhActualCosts,
    cgtTransactions,
    rentalProperties,
    rentalTransactions,
    settings,
  ] =
    await Promise.all([
      getExpenses(),
      getAssets(),
      getWfhEntries(),
      getWfhActualCosts(),
      getCgtTransactions(),
      getRentalProperties(),
      getRentalTransactions(),
      getSettings(),
    ]);
  return JSON.stringify(
    {
      expenses: await Promise.all(expenses.map(async (e) => ({ ...e,
        receiptDataUrl: e.receiptDataUrl ?? (e.hasReceipt ? await getExpenseReceipt(e.id) ?? undefined : undefined) }))),
      assets,
      wfhEntries,
      wfhActualCosts,
      cgtTransactions,
      rentalProperties,
      rentalTransactions,
      settings,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
};

export const importAllData = async (json: string): Promise<boolean> => {
  if (!isSupabaseConfigured() && !isNeonBackend()) {
    return Promise.resolve(local.importAllData(json));
  }
  try {
    const data = validateBackup(json);
    if (data.assets) for (const a of data.assets) await saveAsset(a);
    if (data.expenses) for (const e of data.expenses) {
      const expense = e.claimType === "depreciation" && !e.assetId ?
        { ...e, assetId: findLinkedAsset(e, data.assets ?? await getAssets(), data.expenses)?.id } : e;
      await saveExpense(expense);
    }
    if (data.wfhEntries) for (const e of data.wfhEntries) await saveWfhEntry(e);
    if (data.wfhActualCosts) for (const c of data.wfhActualCosts) await saveWfhActualCost(c);
    if (data.cgtTransactions) for (const t of data.cgtTransactions) await saveCgtTransaction(t);
    if (data.rentalProperties)
      for (const property of data.rentalProperties)
        await saveRentalProperty(property);
    if (data.rentalTransactions)
      for (const transaction of data.rentalTransactions)
        await saveRentalTransaction(transaction);
    if (data.settings) await saveSettings(data.settings);
    return true;
  } catch {
    return false;
  }
};

export const clearAllData = async (): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonClearAllData();
  if (!isSupabaseConfigured()) { local.clearAllData(); return; }
  const { error } = await supabase().rpc("ledger_clear_data", { p_user: await getSupabaseUserId() });
  if (error) throw error;
};
