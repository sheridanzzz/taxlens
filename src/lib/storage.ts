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

const isNeonBackend = () => isNeonConfigured() && !isSupabaseConfigured();

// ── Lazy Supabase import (only when configured) ───────────────────

const supabase = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@/lib/supabase/client");
  return createClient();
};

// ── Supabase row mappers ──────────────────────────────────────────

type Row = Record<string, unknown>;

const toExpense = (row: Row): Expense => ({
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
  createdAt: row.created_at as string,
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
  createdAt: row.created_at as string,
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
});

const getSupabaseUserId = async (): Promise<string> => {
  const { data } = await supabase().auth.getUser();
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
  return (data ?? []).map(toExpense);
};

export const saveExpense = async (expense: Expense): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveExpense(expense);
  if (!isSupabaseConfigured()) { local.saveExpense(expense); return; }
  const userId = await getSupabaseUserId();
  const { error } = await supabase().from("expenses").upsert(fromExpense(expense, userId), { onConflict: "id" });
  if (error) throw error;
};

export const deleteExpense = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteExpense(id);
  if (!isSupabaseConfigured()) { local.deleteExpense(id); return; }
  await supabase().from("expenses").delete().eq("id", id);
};

// ── Assets ──────────────────────────────────────────────────────────

export const getAssets = async (fy?: FinancialYear): Promise<DepreciatingAsset[]> => {
  if (isNeonBackend()) return neonActions.neonGetAssets(fy);
  if (!isSupabaseConfigured()) return Promise.resolve(local.getAssets(fy));
  let query = supabase().from("assets").select("*").order("purchase_date", { ascending: false });
  // see storage-neon.getAssets — depreciation runs past the year of purchase
  if (fy) query = query.lte("purchase_date", FY_DATE_RANGES[fy].end);
  const { data } = await query;
  return (data ?? []).map(toAsset);
};

export const saveAsset = async (asset: DepreciatingAsset): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveAsset(asset);
  if (!isSupabaseConfigured()) { local.saveAsset(asset); return; }
  const userId = await getSupabaseUserId();
  await supabase().from("assets").upsert(fromAsset(asset, userId), { onConflict: "id" });
};

export const deleteAsset = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteAsset(id);
  if (!isSupabaseConfigured()) { local.deleteAsset(id); return; }
  await supabase().from("assets").delete().eq("id", id);
};

// ── WFH Entries ─────────────────────────────────────────────────────

export const getWfhEntries = async (fy?: FinancialYear): Promise<WfhEntry[]> => {
  if (isNeonBackend()) return neonActions.neonGetWfhEntries(fy);
  if (!isSupabaseConfigured()) return Promise.resolve(local.getWfhEntries(fy));
  let query = supabase().from("wfh_entries").select("*").order("date", { ascending: false });
  if (fy) query = query.eq("financial_year", fy);
  const { data } = await query;
  return (data ?? []).map(toWfhEntry);
};

export const saveWfhEntry = async (entry: WfhEntry): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveWfhEntry(entry);
  if (!isSupabaseConfigured()) { local.saveWfhEntry(entry); return; }
  const userId = await getSupabaseUserId();
  await supabase().from("wfh_entries").upsert(fromWfhEntry(entry, userId), { onConflict: "id" });
};

export const deleteWfhEntry = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteWfhEntry(id);
  if (!isSupabaseConfigured()) { local.deleteWfhEntry(id); return; }
  await supabase().from("wfh_entries").delete().eq("id", id);
};

// ── WFH Actual Costs ────────────────────────────────────────────────

export const getWfhActualCosts = async (fy?: FinancialYear): Promise<WfhActualCost[]> => {
  if (isNeonBackend()) return neonActions.neonGetWfhActualCosts(fy);
  if (!isSupabaseConfigured()) return Promise.resolve(local.getWfhActualCosts(fy));
  let query = supabase().from("wfh_actual_costs").select("*");
  if (fy) query = query.eq("financial_year", fy);
  const { data } = await query;
  return (data ?? []).map(toWfhActualCost);
};

export const saveWfhActualCost = async (cost: WfhActualCost): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveWfhActualCost(cost);
  if (!isSupabaseConfigured()) { local.saveWfhActualCost(cost); return; }
  const userId = await getSupabaseUserId();
  await supabase().from("wfh_actual_costs").upsert(fromWfhActualCost(cost, userId), { onConflict: "id" });
};

export const deleteWfhActualCost = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteWfhActualCost(id);
  if (!isSupabaseConfigured()) { local.deleteWfhActualCost(id); return; }
  await supabase().from("wfh_actual_costs").delete().eq("id", id);
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
  createdAt: row.created_at as string,
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
  const { data } = await supabase()
    .from("cgt_transactions")
    .select("*")
    .order("date", { ascending: true });
  return (data ?? []).map(toCgtTransaction);
};

export const saveCgtTransaction = async (tx: CgtTransaction): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveCgtTransaction(tx);
  if (!isSupabaseConfigured()) { local.saveCgtTransaction(tx); return; }
  const userId = await getSupabaseUserId();
  await supabase().from("cgt_transactions").upsert(fromCgtTransaction(tx, userId), { onConflict: "id" });
};

export const deleteCgtTransaction = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteCgtTransaction(id);
  if (!isSupabaseConfigured()) { local.deleteCgtTransaction(id); return; }
  await supabase().from("cgt_transactions").delete().eq("id", id);
};

// ── Rental properties ──────────────────────────────────────────────

export const getRentalProperties = async (): Promise<RentalProperty[]> => {
  if (isNeonBackend()) return neonActions.neonGetRentalProperties();
  if (!isSupabaseConfigured()) return Promise.resolve(local.getRentalProperties());
  const { data } = await supabase()
    .from("rental_properties")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []).map(toRentalProperty);
};

export const saveRentalProperty = async (
  property: RentalProperty
): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveRentalProperty(property);
  if (!isSupabaseConfigured()) {
    local.saveRentalProperty(property);
    return;
  }
  const userId = await getSupabaseUserId();
  await supabase()
    .from("rental_properties")
    .upsert(fromRentalProperty(property, userId), { onConflict: "id" });
};

export const deleteRentalProperty = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteRentalProperty(id);
  if (!isSupabaseConfigured()) {
    local.deleteRentalProperty(id);
    return;
  }
  await supabase().from("rental_transactions").delete().eq("property_id", id);
  await supabase().from("rental_properties").delete().eq("id", id);
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
  const { data } = await query;
  return (data ?? []).map(toRentalTransaction);
};

export const saveRentalTransaction = async (
  transaction: RentalTransaction
): Promise<void> => {
  if (isNeonBackend())
    return neonActions.neonSaveRentalTransaction(transaction);
  if (!isSupabaseConfigured()) {
    local.saveRentalTransaction(transaction);
    return;
  }
  const userId = await getSupabaseUserId();
  await supabase()
    .from("rental_transactions")
    .upsert(fromRentalTransaction(transaction, userId), { onConflict: "id" });
};

export const deleteRentalTransaction = async (id: string): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonDeleteRentalTransaction(id);
  if (!isSupabaseConfigured()) {
    local.deleteRentalTransaction(id);
    return;
  }
  await supabase().from("rental_transactions").delete().eq("id", id);
};

// ── Settings ────────────────────────────────────────────────────────

export const getSettings = async (): Promise<UserSettings> => {
  if (isNeonBackend()) return neonActions.neonGetSettings();
  if (!isSupabaseConfigured()) return Promise.resolve(local.getSettings());
  const { data } = await supabase().from("user_settings").select("*").maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return toSettings(data);
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  if (isNeonBackend()) return neonActions.neonSaveSettings(settings);
  if (!isSupabaseConfigured()) { local.saveSettings(settings); return; }
  const userId = await getSupabaseUserId();
  await supabase().from("user_settings").upsert(fromSettings(settings, userId), { onConflict: "user_id" });
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
      expenses,
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
    const data = JSON.parse(json);
    if (data.expenses) for (const e of data.expenses) await saveExpense(e);
    if (data.assets) for (const a of data.assets) await saveAsset(a);
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
  if (!isSupabaseConfigured() && !isNeonBackend()) {
    local.clearAllData();
    return;
  }
  // For cloud backends, delete all user data by clearing each table
  const [
    expenses,
    assets,
    wfhEntries,
    wfhActualCosts,
    cgt,
    rentalProperties,
    rentalTransactions,
  ] = await Promise.all([
    getExpenses(),
    getAssets(),
    getWfhEntries(),
    getWfhActualCosts(),
    getCgtTransactions(),
    getRentalProperties(),
    getRentalTransactions(),
  ]);
  await Promise.all([
    ...expenses.map((e) => deleteExpense(e.id)),
    ...assets.map((a) => deleteAsset(a.id)),
    ...wfhEntries.map((e) => deleteWfhEntry(e.id)),
    ...wfhActualCosts.map((c) => deleteWfhActualCost(c.id)),
    ...cgt.map((t) => deleteCgtTransaction(t.id)),
    ...rentalTransactions.map((transaction) =>
      deleteRentalTransaction(transaction.id)
    ),
    ...rentalProperties.map((property) => deleteRentalProperty(property.id)),
  ]);
};
