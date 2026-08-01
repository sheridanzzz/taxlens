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
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setItem = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const getExpenses = (fy?: FinancialYear): Expense[] => {
  const all = getItem<Expense[]>(KEYS.expenses, []);
  if (!fy) return all;
  return all.filter((e) => e.financialYear === fy);
};

export const saveExpense = (expense: Expense): void => {
  const all = getItem<Expense[]>(KEYS.expenses, []);
  const idx = all.findIndex((e) => e.id === expense.id);
  if (idx >= 0) {
    all[idx] = expense;
  } else {
    all.push(expense);
  }
  setItem(KEYS.expenses, all);
};

export const deleteExpense = (id: string): void => {
  const all = getItem<Expense[]>(KEYS.expenses, []);
  setItem(
    KEYS.expenses,
    all.filter((e) => e.id !== id)
  );
};

// see storage-neon.getAssets — depreciation runs past the year of purchase
export const getAssets = (fy?: FinancialYear): DepreciatingAsset[] => {
  const all = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  if (!fy) return all;
  return all.filter((a) => a.purchaseDate <= FY_DATE_RANGES[fy].end);
};

export const saveAsset = (asset: DepreciatingAsset): void => {
  const all = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  const idx = all.findIndex((a) => a.id === asset.id);
  if (idx >= 0) {
    all[idx] = asset;
  } else {
    all.push(asset);
  }
  setItem(KEYS.assets, all);
};

export const deleteAsset = (id: string): void => {
  const all = getItem<DepreciatingAsset[]>(KEYS.assets, []);
  setItem(
    KEYS.assets,
    all.filter((a) => a.id !== id)
  );
};

export const getWfhEntries = (fy?: FinancialYear): WfhEntry[] => {
  const all = getItem<WfhEntry[]>(KEYS.wfhEntries, []);
  if (!fy) return all;
  return all.filter((e) => e.financialYear === fy);
};

export const saveWfhEntry = (entry: WfhEntry): void => {
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
  const all = getRentalProperties();
  const index = all.findIndex((item) => item.id === property.id);
  if (index >= 0) all[index] = property;
  else all.push(property);
  setItem(KEYS.rentalProperties, all);
};

export const deleteRentalProperty = (id: string): void => {
  setItem(
    KEYS.rentalProperties,
    getRentalProperties().filter((property) => property.id !== id)
  );
  setItem(
    KEYS.rentalTransactions,
    getItem<RentalTransaction[]>(KEYS.rentalTransactions, []).filter(
      (transaction) => transaction.propertyId !== id
    )
  );
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
  setItem(KEYS.settings, settings);
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
    const data = JSON.parse(json);
    if (data.expenses) setItem(KEYS.expenses, data.expenses);
    if (data.assets) setItem(KEYS.assets, data.assets);
    if (data.wfhEntries) setItem(KEYS.wfhEntries, data.wfhEntries);
    if (data.wfhActualCosts) setItem(KEYS.wfhActualCosts, data.wfhActualCosts);
    if (data.cgtTransactions) setItem(KEYS.cgt, data.cgtTransactions);
    if (data.rentalProperties)
      setItem(KEYS.rentalProperties, data.rentalProperties);
    if (data.rentalTransactions)
      setItem(KEYS.rentalTransactions, data.rentalTransactions);
    if (data.settings) setItem(KEYS.settings, data.settings);
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
