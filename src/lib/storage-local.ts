/**
 * Browser localStorage persistence when Supabase is not configured.
 */
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
import { validateExpense, validateAsset, validateSettings, validateWfhEntry, validateWfhActualCost, validateCgtTransaction, validateRentalProperty, validateRentalTransaction, validateBackup } from "./validation";

const KEYS = {
  expenses: "taxlens_expenses",
  assets: "taxlens_assets",
  wfhEntries: "taxlens_wfh_entries",
  wfhActualCosts: "taxlens_wfh_actual_costs",
  settings: "taxlens_settings",
  cgt: "taxlens_cgt_transactions",
  rentalProperties: "ledgr_rental_properties",
  rentalTransactions: "ledgr_rental_transactions",
} as const;

const getItem = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(fallback) && !Array.isArray(value) ? fallback : value;
  } catch {
    return fallback;
  }
};

const setItem = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

const commit = (values: Record<string, unknown>): void => {
  const before = Object.keys(values).map((key) => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, value] of Object.entries(values)) setItem(key, value);
  } catch (error) {
    for (const [key, value] of before) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw error;
  }
};

export const getExpenses = (fy?: FinancialYear): Expense[] => {
  const all = getItem<Expense[]>(KEYS.expenses, []);
  const assets = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  const linked = all.map((e) => e.claimType === "depreciation" && !e.assetId ?
    { ...e, assetId: findLinkedAsset(e, assets, all)?.id } : e);
  return applyCarClaimCaps(fy ? linked.filter((e) => e.financialYear === fy) : linked);
};

export const saveExpense = (expense: Expense, asset?: DepreciatingAsset): void => {
  expense = validateExpense(expense);
  const all = getItem<Expense[]>(KEYS.expenses, []);
  let assets = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  const idx = all.findIndex((e) => e.id === expense.id);
  const oldAssetId = idx >= 0 ? findLinkedAsset(all[idx], assets, all)?.id ??
    (all[idx].claimType === "depreciation" ? expense.assetId : undefined) : undefined;
  if (expense.claimType === "depreciation") {
    const linked = assets.find((a) => a.id === expense.assetId);
    const candidate = asset ?? (linked && { ...linked, name: expense.description,
      purchaseDate: expense.date, purchasePrice: expense.amount, workUsePercent: expense.workUsePercent,
      financialYear: expense.financialYear });
    if (!candidate || candidate.id !== expense.assetId) throw new Error("Select the asset linked to this receipt.");
    validateAsset(candidate);
    if (candidate.name !== expense.description || candidate.purchaseDate !== expense.date ||
        candidate.purchasePrice !== expense.amount || candidate.workUsePercent !== expense.workUsePercent ||
        candidate.financialYear !== expense.financialYear) throw new Error("Asset and receipt details must match.");
    if (all.some((e) => e.id !== expense.id && e.assetId === candidate.id))
      throw new Error("This asset already has a receipt record.");
    assets = [...assets.filter((a) => a.id !== candidate.id), candidate];
  } else expense = { ...expense, assetId: undefined };
  if (oldAssetId && oldAssetId !== expense.assetId) assets = assets.filter((a) => a.id !== oldAssetId);
  if (idx >= 0 && expense.hasReceipt && expense.receiptDataUrl === undefined)
    expense = { ...expense, receiptDataUrl: all[idx].receiptDataUrl };
  if (idx >= 0 && !("reviewStatus" in expense)) expense = { ...expense, reviewStatus: all[idx].reviewStatus };
  if (idx >= 0) {
    all[idx] = expense;
  } else {
    all.push(expense);
  }
  commit({ [KEYS.expenses]: all, [KEYS.assets]: assets });
};

export const deleteExpense = (id: string): void => {
  const all = getItem<Expense[]>(KEYS.expenses, []);
  const expense = all.find((e) => e.id === id);
  const assetId = expense && findLinkedAsset(expense, getAssets(), all)?.id;
  commit({ [KEYS.expenses]: all.filter((e) => e.id !== id),
    [KEYS.assets]: getItem<DepreciatingAsset[]>(KEYS.assets, []).filter((a) => a.id !== assetId) });
};

// see storage-neon.getAssets — depreciation runs past the year of purchase
export const getAssets = (fy?: FinancialYear): DepreciatingAsset[] => {
  const all = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  if (!fy) return all;
  return all.filter((a) => a.purchaseDate <= FY_DATE_RANGES[fy].end);
};

export const saveAsset = (asset: DepreciatingAsset): void => {
  validateAsset(asset);
  const all = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  const previous = [...all];
  const rawExpenses = getItem<Expense[]>(KEYS.expenses, []);
  const idx = all.findIndex((a) => a.id === asset.id);
  if (idx >= 0) {
    all[idx] = asset;
  } else {
    all.push(asset);
  }
  const expenses = rawExpenses.map((e) => findLinkedAsset(e, previous, rawExpenses)?.id === asset.id ? {
    ...e, assetId: asset.id, description: asset.name, amount: asset.purchasePrice, date: asset.purchaseDate,
    financialYear: asset.financialYear, workUsePercent: asset.workUsePercent, claimableAmount: 0,
    reviewStatus: asset.workUsePercent === 0 ? "personal" : "reviewed",
  } : e);
  commit({ [KEYS.assets]: all, [KEYS.expenses]: expenses });
};

export const deleteAsset = (id: string): void => {
  const all = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  const expenses = getItem<Expense[]>(KEYS.expenses, []);
  commit({ [KEYS.assets]: all.filter((a) => a.id !== id),
    [KEYS.expenses]: expenses.map((e) => findLinkedAsset(e, all, expenses)?.id === id ?
      { ...e, assetId: undefined, claimType: "full", workUsePercent: 0, claimableAmount: 0, reviewStatus: "personal" } : e) });
};

export const getWfhEntries = (fy?: FinancialYear): WfhEntry[] => {
  const all = getItem<WfhEntry[]>(KEYS.wfhEntries, []);
  if (!fy) return all;
  return all.filter((e) => e.financialYear === fy);
};

export const saveWfhEntry = (entry: WfhEntry): void => {
  validateWfhEntry(entry);
  const all = getItem<WfhEntry[]>(KEYS.wfhEntries, []);
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.push(entry);
  }
  setItem(KEYS.wfhEntries, all);
};

export const deleteWfhEntry = (id: string): void => {
  const all = getItem<WfhEntry[]>(KEYS.wfhEntries, []);
  setItem(
    KEYS.wfhEntries,
    all.filter((e) => e.id !== id)
  );
};

export const getWfhActualCosts = (fy?: FinancialYear): WfhActualCost[] => {
  const all = getItem<WfhActualCost[]>(KEYS.wfhActualCosts, []);
  if (!fy) return all;
  return all.filter((c) => c.financialYear === fy);
};

export const saveWfhActualCost = (cost: WfhActualCost): void => {
  validateWfhActualCost(cost);
  const all = getItem<WfhActualCost[]>(KEYS.wfhActualCosts, []);
  const idx = all.findIndex((c) => c.id === cost.id);
  if (idx >= 0) {
    all[idx] = cost;
  } else {
    all.push(cost);
  }
  setItem(KEYS.wfhActualCosts, all);
};

export const deleteWfhActualCost = (id: string): void => {
  const all = getItem<WfhActualCost[]>(KEYS.wfhActualCosts, []);
  setItem(
    KEYS.wfhActualCosts,
    all.filter((c) => c.id !== id)
  );
};

// merged over defaults so settings saved before a new field existed still load
// never FY-filtered: FIFO matching needs the whole history to find the parcels
// a sale consumes, which are usually from an earlier year
export const getCgtTransactions = (): CgtTransaction[] =>
  getItem<CgtTransaction[]>(KEYS.cgt, []);

export const saveCgtTransaction = (tx: CgtTransaction): void => {
  validateCgtTransaction(tx);
  const all = getItem<CgtTransaction[]>(KEYS.cgt, []);
  const idx = all.findIndex((t) => t.id === tx.id);
  if (idx >= 0) all[idx] = tx;
  else all.push(tx);
  setItem(KEYS.cgt, all);
};

export const deleteCgtTransaction = (id: string): void => {
  setItem(
    KEYS.cgt,
    getItem<CgtTransaction[]>(KEYS.cgt, []).filter((t) => t.id !== id)
  );
};

export const getRentalProperties = (): RentalProperty[] =>
  getItem<RentalProperty[]>(KEYS.rentalProperties, []);

export const saveRentalProperty = (property: RentalProperty): void => {
  validateRentalProperty(property);
  const all = getRentalProperties();
  const index = all.findIndex((item) => item.id === property.id);
  if (index >= 0) all[index] = property;
  else all.push(property);
  setItem(KEYS.rentalProperties, all);
};

export const deleteRentalProperty = (id: string): void => {
  commit({ [KEYS.rentalProperties]: getRentalProperties().filter((property) => property.id !== id),
    [KEYS.rentalTransactions]: getRentalTransactions().filter((transaction) => transaction.propertyId !== id) });
};

export const getRentalTransactions = (
  fy?: FinancialYear
): RentalTransaction[] => {
  const all = getItem<RentalTransaction[]>(KEYS.rentalTransactions, []);
  return fy ? all.filter((transaction) => transaction.financialYear === fy) : all;
};

export const saveRentalTransaction = (
  transaction: RentalTransaction
): void => {
  validateRentalTransaction(transaction);
  const all = getItem<RentalTransaction[]>(KEYS.rentalTransactions, []);
  const index = all.findIndex((item) => item.id === transaction.id);
  if (index >= 0) all[index] = transaction;
  else all.push(transaction);
  setItem(KEYS.rentalTransactions, all);
};

export const deleteRentalTransaction = (id: string): void => {
  setItem(
    KEYS.rentalTransactions,
    getItem<RentalTransaction[]>(KEYS.rentalTransactions, []).filter(
      (transaction) => transaction.id !== id
    )
  );
};

export const getSettings = (): UserSettings => ({
  ...DEFAULT_SETTINGS,
  ...getItem<Partial<UserSettings>>(KEYS.settings, {}),
});

export const saveSettings = (settings: UserSettings): void => {
  setItem(KEYS.settings, validateSettings(settings));
};

export const exportAllData = (): string => {
  const data = {
    expenses: getItem<Expense[]>(KEYS.expenses, []),
    assets: getItem<DepreciatingAsset[]>(KEYS.assets, []),
    wfhEntries: getItem<WfhEntry[]>(KEYS.wfhEntries, []),
    wfhActualCosts: getItem<WfhActualCost[]>(KEYS.wfhActualCosts, []),
    cgtTransactions: getCgtTransactions(),
    rentalProperties: getRentalProperties(),
    rentalTransactions: getRentalTransactions(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
};

export const importAllData = (json: string): boolean => {
  try {
    const data = validateBackup(json);
    const values: Record<string, unknown> = {};
    const keys = { expenses: KEYS.expenses, assets: KEYS.assets, wfhEntries: KEYS.wfhEntries,
      wfhActualCosts: KEYS.wfhActualCosts, cgtTransactions: KEYS.cgt,
      rentalProperties: KEYS.rentalProperties, rentalTransactions: KEYS.rentalTransactions, settings: KEYS.settings };
    for (const [field, key] of Object.entries(keys))
      if (field in data) values[key] = data[field as keyof typeof data];
    commit(values);
    return true;
  } catch {
    return false;
  }
};

export const clearAllData = (): void => {
  Object.values(KEYS).forEach((key) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  });
};
