"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Expense,
  DepreciatingAsset,
  WfhEntry,
  WfhActualCost,
  UserSettings,
  FinancialYear,
  TaxSummary,
  CgtTransaction,
  RentalProperty,
  RentalTransaction,
} from "@/lib/types";
import * as storage from "@/lib/storage";
import { calculateTaxSummary } from "@/lib/tax-calculator";
import { calculateCgt, type CgtSummary } from "@/lib/cgt";
import { calculateRentalSummary, type RentalSummary } from "@/lib/rental";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { useAuth } from "@/context/auth-context";

interface TaxState {
  settings: UserSettings;
  expenses: Expense[];
  assets: DepreciatingAsset[];
  wfhEntries: WfhEntry[];
  wfhActualCosts: WfhActualCost[];
  /** Every trade ever, not just this FY — FIFO needs the whole history. */
  cgtTransactions: CgtTransaction[];
  rentalProperties: RentalProperty[];
  rentalTransactions: RentalTransaction[];
  loaded: boolean;
}

type TaxAction =
  | { type: "LOAD_ALL"; payload: Omit<TaxState, "loaded"> }
  | { type: "SET_SETTINGS"; payload: UserSettings }
  | { type: "SET_EXPENSES"; payload: Expense[] }
  | { type: "SET_ASSETS"; payload: DepreciatingAsset[] }
  | { type: "SET_WFH_ENTRIES"; payload: WfhEntry[] }
  | { type: "SET_WFH_ACTUAL_COSTS"; payload: WfhActualCost[] }
  | { type: "SET_CGT"; payload: CgtTransaction[] }
  | { type: "SET_RENTAL_PROPERTIES"; payload: RentalProperty[] }
  | { type: "SET_RENTAL_TRANSACTIONS"; payload: RentalTransaction[] };

const taxReducer = (state: TaxState, action: TaxAction): TaxState => {
  switch (action.type) {
    case "LOAD_ALL":
      return { ...action.payload, loaded: true };
    case "SET_SETTINGS":
      return { ...state, settings: action.payload };
    case "SET_EXPENSES":
      return { ...state, expenses: action.payload };
    case "SET_ASSETS":
      return { ...state, assets: action.payload };
    case "SET_WFH_ENTRIES":
      return { ...state, wfhEntries: action.payload };
    case "SET_WFH_ACTUAL_COSTS":
      return { ...state, wfhActualCosts: action.payload };
    case "SET_CGT":
      return { ...state, cgtTransactions: action.payload };
    case "SET_RENTAL_PROPERTIES":
      return { ...state, rentalProperties: action.payload };
    case "SET_RENTAL_TRANSACTIONS":
      return { ...state, rentalTransactions: action.payload };
    default:
      return state;
  }
};

interface TaxContextValue {
  state: TaxState;
  summary: TaxSummary;
  updateSettings: (settings: UserSettings) => Promise<void>;
  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  addAsset: (asset: DepreciatingAsset) => Promise<void>;
  updateAsset: (asset: DepreciatingAsset) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  addWfhEntry: (entry: WfhEntry) => Promise<void>;
  addWfhEntries: (entries: WfhEntry[]) => Promise<void>;
  removeWfhEntry: (id: string) => Promise<void>;
  addWfhActualCost: (cost: WfhActualCost) => Promise<void>;
  updateWfhActualCost: (cost: WfhActualCost) => Promise<void>;
  removeWfhActualCost: (id: string) => Promise<void>;
  cgt: CgtSummary;
  addCgtTransaction: (tx: CgtTransaction) => Promise<void>;
  addCgtTransactions: (txs: CgtTransaction[]) => Promise<void>;
  removeCgtTransaction: (id: string) => Promise<void>;
  rental: RentalSummary;
  addRentalProperty: (property: RentalProperty) => Promise<void>;
  removeRentalProperty: (id: string) => Promise<void>;
  addRentalTransaction: (transaction: RentalTransaction) => Promise<void>;
  removeRentalTransaction: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  /** Expenses for an arbitrary FY — state.expenses only holds the active one. */
  getExpensesForFy: (fy: FinancialYear) => Promise<Expense[]>;
}

const TaxContext = createContext<TaxContextValue | null>(null);

const initialState: TaxState = {
  settings: DEFAULT_SETTINGS,
  expenses: [],
  assets: [],
  wfhEntries: [],
  wfhActualCosts: [],
  cgtTransactions: [],
  rentalProperties: [],
  rentalTransactions: [],
  loaded: false,
};

const emptySummary: TaxSummary = {
  totalExpenses: 0,
  totalFullClaims: 0,
  totalDepreciationClaims: 0,
  totalWfhDeduction: 0,
  totalDeductions: 0,
  estimatedTaxSaved: 0,
  netCapitalGain: 0,
  rentalIncome: 0,
  rentalDeductions: 0,
  netRentalResult: 0,
  taxableIncome: 0,
  taxPayable: 0,
  taxPayableWithoutDeductions: 0,
};

export const TaxProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(taxReducer, initialState);
  const { user, cloudEnabled } = useAuth();

  const loadAll = useCallback(async () => {
    if (cloudEnabled && !user) return;
    const settings = await storage.getSettings();
    const fy = settings.financialYear;
    const [
      expenses,
      assets,
      wfhEntries,
      wfhActualCosts,
      cgtTransactions,
      rentalProperties,
      rentalTransactions,
    ] =
      await Promise.all([
        storage.getExpenses(fy),
        storage.getAssets(fy),
        storage.getWfhEntries(fy),
        storage.getWfhActualCosts(fy),
        storage.getCgtTransactions(),
        storage.getRentalProperties(),
        storage.getRentalTransactions(fy),
      ]);
    dispatch({
      type: "LOAD_ALL",
      payload: {
        settings,
        expenses,
        assets,
        wfhEntries,
        wfhActualCosts,
        cgtTransactions,
        rentalProperties,
        rentalTransactions,
      },
    });
  }, [user, cloudEnabled]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const cgt = calculateCgt(
    state.cgtTransactions,
    state.settings.financialYear
  );
  const rental = calculateRentalSummary(
    state.rentalProperties,
    state.rentalTransactions
  );

  const summary = state.loaded
    ? calculateTaxSummary(
        state.expenses,
        state.assets,
        state.wfhEntries,
        state.wfhActualCosts,
        state.settings.annualIncome,
        state.settings.financialYear,
        state.settings.wfhMethod,
        state.settings.taxResidentStatus === "resident",
        {
          hasHelpDebt: state.settings.hasHelpDebt,
          hasPrivateHospitalCover: state.settings.hasPrivateHospitalCover,
        },
        cgt.netCapitalGain,
        rental.assessableIncome,
        rental.deductibleExpenses
      )
    : emptySummary;

  const updateSettings = useCallback(
    async (settings: UserSettings) => {
      await storage.saveSettings(settings);
      dispatch({ type: "SET_SETTINGS", payload: settings });
      const fy = settings.financialYear;
      const [
        expenses,
        assets,
        wfhEntries,
        wfhActualCosts,
        rentalTransactions,
      ] = await Promise.all([
        storage.getExpenses(fy),
        storage.getAssets(fy),
        storage.getWfhEntries(fy),
        storage.getWfhActualCosts(fy),
        storage.getRentalTransactions(fy),
      ]);
      dispatch({ type: "SET_EXPENSES", payload: expenses });
      dispatch({ type: "SET_ASSETS", payload: assets });
      dispatch({ type: "SET_WFH_ENTRIES", payload: wfhEntries });
      dispatch({ type: "SET_WFH_ACTUAL_COSTS", payload: wfhActualCosts });
      dispatch({ type: "SET_RENTAL_TRANSACTIONS", payload: rentalTransactions });
    },
    []
  );

  const fy = state.settings.financialYear;

  const addExpense = useCallback(
    async (expense: Expense) => {
      await storage.saveExpense(expense);
      dispatch({ type: "SET_EXPENSES", payload: await storage.getExpenses(fy) });
    },
    [fy]
  );

  const updateExpense = useCallback(
    async (expense: Expense) => {
      await storage.saveExpense(expense);
      dispatch({ type: "SET_EXPENSES", payload: await storage.getExpenses(fy) });
    },
    [fy]
  );

  const removeExpense = useCallback(
    async (id: string) => {
      await storage.deleteExpense(id);
      dispatch({ type: "SET_EXPENSES", payload: await storage.getExpenses(fy) });
    },
    [fy]
  );

  const addAsset = useCallback(
    async (asset: DepreciatingAsset) => {
      await storage.saveAsset(asset);
      dispatch({ type: "SET_ASSETS", payload: await storage.getAssets(fy) });
    },
    [fy]
  );

  const updateAsset = useCallback(
    async (asset: DepreciatingAsset) => {
      await storage.saveAsset(asset);
      dispatch({ type: "SET_ASSETS", payload: await storage.getAssets(fy) });
    },
    [fy]
  );

  const removeAsset = useCallback(
    async (id: string) => {
      await storage.deleteAsset(id);
      dispatch({ type: "SET_ASSETS", payload: await storage.getAssets(fy) });
    },
    [fy]
  );

  const addWfhEntry = useCallback(
    async (entry: WfhEntry) => {
      await storage.saveWfhEntry(entry);
      dispatch({ type: "SET_WFH_ENTRIES", payload: await storage.getWfhEntries(fy) });
    },
    [fy]
  );

  const addWfhEntries = useCallback(
    async (entries: WfhEntry[]) => {
      await Promise.all(entries.map((e) => storage.saveWfhEntry(e)));
      dispatch({ type: "SET_WFH_ENTRIES", payload: await storage.getWfhEntries(fy) });
    },
    [fy]
  );

  const removeWfhEntry = useCallback(
    async (id: string) => {
      await storage.deleteWfhEntry(id);
      dispatch({ type: "SET_WFH_ENTRIES", payload: await storage.getWfhEntries(fy) });
    },
    [fy]
  );

  const addWfhActualCost = useCallback(
    async (cost: WfhActualCost) => {
      await storage.saveWfhActualCost(cost);
      dispatch({
        type: "SET_WFH_ACTUAL_COSTS",
        payload: await storage.getWfhActualCosts(fy),
      });
    },
    [fy]
  );

  const updateWfhActualCost = useCallback(
    async (cost: WfhActualCost) => {
      await storage.saveWfhActualCost(cost);
      dispatch({
        type: "SET_WFH_ACTUAL_COSTS",
        payload: await storage.getWfhActualCosts(fy),
      });
    },
    [fy]
  );

  const removeWfhActualCost = useCallback(
    async (id: string) => {
      await storage.deleteWfhActualCost(id);
      dispatch({
        type: "SET_WFH_ACTUAL_COSTS",
        payload: await storage.getWfhActualCosts(fy),
      });
    },
    [fy]
  );

  const addCgtTransaction = useCallback(async (tx: CgtTransaction) => {
    await storage.saveCgtTransaction(tx);
    dispatch({ type: "SET_CGT", payload: await storage.getCgtTransactions() });
  }, []);

  // one refresh for a whole CSV import instead of one per row
  const addCgtTransactions = useCallback(async (txs: CgtTransaction[]) => {
    for (const tx of txs) await storage.saveCgtTransaction(tx);
    dispatch({ type: "SET_CGT", payload: await storage.getCgtTransactions() });
  }, []);

  const removeCgtTransaction = useCallback(async (id: string) => {
    await storage.deleteCgtTransaction(id);
    dispatch({ type: "SET_CGT", payload: await storage.getCgtTransactions() });
  }, []);

  const addRentalProperty = useCallback(async (property: RentalProperty) => {
    await storage.saveRentalProperty(property);
    dispatch({
      type: "SET_RENTAL_PROPERTIES",
      payload: await storage.getRentalProperties(),
    });
  }, []);

  const removeRentalProperty = useCallback(
    async (id: string) => {
      await storage.deleteRentalProperty(id);
      dispatch({
        type: "SET_RENTAL_PROPERTIES",
        payload: await storage.getRentalProperties(),
      });
      dispatch({
        type: "SET_RENTAL_TRANSACTIONS",
        payload: await storage.getRentalTransactions(fy),
      });
    },
    [fy]
  );

  const addRentalTransaction = useCallback(
    async (transaction: RentalTransaction) => {
      await storage.saveRentalTransaction(transaction);
      dispatch({
        type: "SET_RENTAL_TRANSACTIONS",
        payload: await storage.getRentalTransactions(fy),
      });
    },
    [fy]
  );

  const removeRentalTransaction = useCallback(
    async (id: string) => {
      await storage.deleteRentalTransaction(id);
      dispatch({
        type: "SET_RENTAL_TRANSACTIONS",
        payload: await storage.getRentalTransactions(fy),
      });
    },
    [fy]
  );

  return (
    <TaxContext.Provider
      value={{
        state,
        summary,
        cgt,
        rental,
        addCgtTransaction,
        addCgtTransactions,
        removeCgtTransaction,
        addRentalProperty,
        removeRentalProperty,
        addRentalTransaction,
        removeRentalTransaction,
        updateSettings,
        addExpense,
        updateExpense,
        removeExpense,
        addAsset,
        updateAsset,
        removeAsset,
        addWfhEntry,
        addWfhEntries,
        removeWfhEntry,
        addWfhActualCost,
        updateWfhActualCost,
        removeWfhActualCost,
        refreshData: loadAll,
        getExpensesForFy: storage.getExpenses,
      }}
    >
      {children}
    </TaxContext.Provider>
  );
};

export const useTax = (): TaxContextValue => {
  const ctx = useContext(TaxContext);
  if (!ctx) throw new Error("useTax must be used within TaxProvider");
  return ctx;
};
